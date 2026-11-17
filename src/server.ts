import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { AppConfig } from './config.js';
import { destinationFor } from './config.js';
import { FormName, FormPattern, destinationIdSchema } from './types.js';
import type { FormProvider } from './types.js';
import { analyzeXdp, decodeAndValidateXdp } from './core/xdp.js';

function asToolResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}
function errorResult(error: unknown) {
  const msg = error instanceof Error ? error.message : 'Unexpected error';
  // Do not surface upstream credentials, URLs with userinfo, or HTTP response bodies.
  return { isError: true, content: [{ type: 'text' as const, text: `Read-only operation failed: ${msg.slice(0, 400)}` }] };
}

export function createFormMcpServer(config: AppConfig, provider: FormProvider): McpServer {
  const server = new McpServer({ name: 'sap-adobe-form-reader', version: '0.1.0' });
  const destinationInput = destinationIdSchema.optional().describe('Configured destination ID, defaults to DEFAULT_DESTINATION');
  const nameInput = FormName.describe('SFP form name, e.g. ZMY_FORM');
  const resolve = (id?: string) => {
    const selected = id ?? config.DEFAULT_DESTINATION;
    destinationFor(config, selected);
    return selected;
  };
  // Every operation registered here is read-only. There are intentionally no write/edit tools.
  server.registerTool('list_custom_forms', {
    description: 'List custom SFP Adobe Forms matching a name pattern (read only).',
    inputSchema: z.object({ destination: destinationInput, pattern: FormPattern.default('Z*'), limit: z.number().int().min(1).max(100).default(50) }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ destination, pattern, limit }) => {
    try { const id = resolve(destination); return asToolResult({ destination: id, source: config.PROVIDER, forms: await provider.listCustomForms(id, pattern, limit) }); }
    catch (e) { return errorResult(e); }
  });
  server.registerTool('get_form_metadata', {
    description: 'Read form name, description, package, interface name and version metadata.',
    inputSchema: z.object({ destination: destinationInput, name: nameInput }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ destination, name }) => {
    try { const id = resolve(destination); return asToolResult({ destination: id, source: config.PROVIDER, metadata: await provider.getFormMetadata(id, name) }); }
    catch (e) { return errorResult(e); }
  });
  server.registerTool('get_form_interface', {
    description: 'Read SFP form interface parameters and interface type.',
    inputSchema: z.object({ destination: destinationInput, name: nameInput }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ destination, name }) => {
    try { const id = resolve(destination); return asToolResult({ destination: id, source: config.PROVIDER, formInterface: await provider.getFormInterface(id, name) }); }
    catch (e) { return errorResult(e); }
  });
  server.registerTool('get_form_context', {
    description: 'Read the form context hierarchy, fields and bindings.',
    inputSchema: z.object({ destination: destinationInput, name: nameInput }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ destination, name }) => {
    try { const id = resolve(destination); return asToolResult({ destination: id, source: config.PROVIDER, context: await provider.getFormContext(id, name) }); }
    catch (e) { return errorResult(e); }
  });
  server.registerTool('get_form_layout', {
    description: 'Read a validated XDP layout; XML content is omitted unless includeXml=true.',
    inputSchema: z.object({ destination: destinationInput, name: nameInput, includeXml: z.boolean().default(false) }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ destination, name, includeXml }) => {
    try {
      const id = resolve(destination);
      const layout = await provider.getFormLayout(id, name);
      const xml = decodeAndValidateXdp(layout.xdpBase64, config.MAX_XDP_BYTES);
      const analysis = analyzeXdp(xml);
      return asToolResult({ destination: id, source: config.PROVIDER, formName: layout.formName, validated: true, root: analysis.root, sizeBytes: analysis.sizeBytes, elementCount: analysis.elements, fields: analysis.fieldNames, scriptCount: analysis.scripts.length, ...(includeXml ? { xdpXml: xml } : {}) });
    } catch (e) { return errorResult(e); }
  });
  server.registerTool('analyze_form_scripts', {
    description: 'Statically analyze FormCalc/JavaScript XFA event scripts; never executes code.',
    inputSchema: z.object({ destination: destinationInput, name: nameInput, includeSnippets: z.boolean().default(false) }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ destination, name, includeSnippets }) => {
    try {
      const id = resolve(destination);
      const layout = await provider.getFormLayout(id, name);
      const xml = decodeAndValidateXdp(layout.xdpBase64, config.MAX_XDP_BYTES);
      return asToolResult({ destination: id, source: config.PROVIDER, formName: layout.formName, analysisType: 'static', ...analyzeXdp(xml, includeSnippets) });
    } catch (e) { return errorResult(e); }
  });
  return server;
}
