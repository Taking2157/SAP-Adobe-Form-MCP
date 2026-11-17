import 'dotenv/config';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
const url = new URL(process.env.MCP_URL ?? 'http://127.0.0.1:3000/mcp');
const token = process.env.MCP_AUTH_TOKEN;
if (!token) throw new Error('Set MCP_AUTH_TOKEN in .env');
const client = new Client({ name: 'sap-form-smoke', version: '0.1.0' });
const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
try {
  await client.connect(transport);
  const tools = await client.listTools();
  console.log('Discovered MCP tools:', tools.tools.map((x) => x.name));
  const response = await client.callTool({ name: 'list_custom_forms', arguments: { pattern: 'Z*' } });
  console.log('list_custom_forms:', JSON.stringify(response, null, 2));
} finally { await client.close(); }
