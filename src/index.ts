import { timingSafeEqual } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { Request, Response, NextFunction } from 'express';
import { loadConfig } from './config.js';
import { MockProvider } from './providers/mock.js';
import { SapBridgeProvider } from './providers/sap-bridge.js';
import { createFormMcpServer } from './server.js';

const config = loadConfig();
const provider = config.PROVIDER === 'MOCK' ? new MockProvider() : new SapBridgeProvider(config);
const handler = createMcpHandler(() => createFormMcpServer(config, provider));
const app = createMcpExpressApp({ host: config.HOST });
app.disable('x-powered-by');

function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization ?? '';
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = Buffer.from(config.MCP_AUTH_TOKEN, 'utf8');
  const actual = Buffer.from(supplied, 'utf8');
  if (!supplied || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.get('/health', (_req, res) => res.json({ status: 'ok', provider: config.PROVIDER }));
const nodeHandler = toNodeHandler(handler);
app.all('/mcp', bearerAuth, (req, res) => void nodeHandler(req, res, req.body));
app.listen(config.PORT, config.HOST, () => {
  console.log(`[sap-adobe-form-mcp] http://${config.HOST}:${config.PORT}/mcp (mode=${config.PROVIDER}, read-only)`);
});
