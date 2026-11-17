import * as z from 'zod/v4';
import type { AppConfig, SapDestination } from '../config.js';
import { destinationFor } from '../config.js';
import { FormSummary, FormMetadata, FormInterface, FormContext, FormLayout } from '../types.js';
import type { FormProvider, Summary, Metadata, Interface, Context, Layout } from '../types.js';

/** Only talks to an explicitly installed custom read-only SAP ICF/OData facade.
 *  The routes below are OUR integration contract; they are NOT standard SAP ADT paths. */
export class SapBridgeProvider implements FormProvider {
  constructor(private readonly config: AppConfig, private readonly env: NodeJS.ProcessEnv = process.env) {}

  private getHeaders(d: SapDestination): Headers {
    const prefix = d.credentialPrefix;
    const token = this.env[`${prefix}_TOKEN`];
    const headers = new Headers({ 'Accept': 'application/json' });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    else {
      const user = this.env[`${prefix}_USER`];
      const pass = this.env[`${prefix}_PASSWORD`];
      if (!user || !pass) throw new Error(`No credentials configured for ${d.id}`);
      headers.set('Authorization', `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`);
    }
    return headers;
  }

  private async read<T>(id: string, route: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    const d = destinationFor(this.config, id);
    const url = new URL(d.apiPath.replace(/\/$/, '') + route, d.baseUrl);
    url.searchParams.set('sap-client', d.client);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(d),
      signal: AbortSignal.timeout(this.config.SAP_TIMEOUT_MS),
      redirect: 'error',
      cache: 'no-store'
    });
    const limit = Math.ceil(this.config.MAX_XDP_BYTES * 1.5) + 1048576;
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (contentLength > limit) throw new Error('SAP response exceeds configured limit');
    if (!response.ok) throw new Error(`SAP bridge ${d.id} returned HTTP ${response.status}`);
    if (!(response.headers.get('content-type') ?? '').includes('json')) throw new Error('SAP bridge must return JSON');
    if (!response.body) throw new Error('SAP bridge returned empty body');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) throw new Error('SAP response exceeded size limit');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const text = Buffer.concat(chunks).toString('utf8');
    let json: unknown;
    try { json = JSON.parse(text); }
    catch { throw new Error(`Malformed JSON from SAP bridge ${d.id}`); }
    return schema.parse(json);
  }
  listCustomForms(id: string, pattern: string, limit: number): Promise<Summary[]> {
    return this.read(id, '/forms', { pattern, limit: String(limit) }, z.array(FormSummary).max(100));
  }
  getFormMetadata(id: string, name: string): Promise<Metadata> {
    return this.read(id, '/metadata', { name }, FormMetadata);
  }
  getFormInterface(id: string, name: string): Promise<Interface> {
    return this.read(id, '/interface', { name }, FormInterface);
  }
  getFormContext(id: string, name: string): Promise<Context> {
    return this.read(id, '/context', { name }, FormContext);
  }
  getFormLayout(id: string, name: string): Promise<Layout> {
    return this.read(id, '/layout', { name }, FormLayout);
  }
}
