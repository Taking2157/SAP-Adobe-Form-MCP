import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as z from 'zod/v4';
import { destinationIdSchema } from './types.js';

const destinationSchema = z.object({
  id: destinationIdSchema,
  description: z.string().max(200),
  baseUrl: z.url().refine((u) => new URL(u).protocol === 'https:', 'SAP baseUrl must use HTTPS'),
  client: z.string().regex(/^\d{3}$/),
  apiPath: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_-]+$/),
  credentialPrefix: z.string().regex(/^[A-Z][A-Z0-9_]*$/)
});
export type SapDestination = z.infer<typeof destinationSchema>;

const envSchema = z.object({
  PROVIDER: z.enum(['MOCK', 'SAP_BRIDGE']).default('MOCK'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MCP_AUTH_TOKEN: z.string().min(24, 'MCP_AUTH_TOKEN must contain at least 24 characters'),
  DEFAULT_DESTINATION: destinationIdSchema.default('DEV100'),
  DESTINATIONS_FILE: z.string().default('config/destinations.json'),
  SAP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  MAX_XDP_BYTES: z.coerce.number().int().min(1024).max(5242880).default(1048576)
});
export type AppConfig = z.infer<typeof envSchema> & { destinations: SapDestination[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const vars = envSchema.parse(env);
  if (vars.MCP_AUTH_TOKEN.startsWith('replace-with-')) throw new Error('Replace the sample MCP_AUTH_TOKEN with a real random token');
  const raw = JSON.parse(readFileSync(resolve(vars.DESTINATIONS_FILE), 'utf8')) as unknown;
  const destinations = z.array(destinationSchema).min(1).parse(raw);
  if (new Set(destinations.map((d) => d.id)).size !== destinations.length) throw new Error('Duplicate SAP destination ID');
  if (!destinations.some((d) => d.id === vars.DEFAULT_DESTINATION)) throw new Error('DEFAULT_DESTINATION not found');
  if (vars.HOST !== '127.0.0.1' && vars.HOST !== 'localhost' && vars.HOST !== '::1') {
    throw new Error('Non-loopback bind is disabled in this starter. Deploy behind a configured authenticated HTTPS reverse proxy after security review.');
  }
  if (vars.PROVIDER === 'SAP_BRIDGE') {
    for (const destination of destinations) {
      const prefix = destination.credentialPrefix;
      if (!env[`${prefix}_TOKEN`] && !(env[`${prefix}_USER`] && env[`${prefix}_PASSWORD`])) {
        throw new Error(`Missing read-only SAP credentials for ${destination.id}: ${prefix}_TOKEN or ${prefix}_USER/${prefix}_PASSWORD`);
      }
    }
  }
  return { ...vars, destinations };
}

export function destinationFor(config: AppConfig, id: string): SapDestination {
  const found = config.destinations.find((destination) => destination.id === id);
  if (!found) throw new Error(`Unknown destination: ${id}`);
  return found;
}
