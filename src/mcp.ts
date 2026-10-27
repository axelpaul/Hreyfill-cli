import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { OPERATIONS } from './operations';
import { Client, SafeError } from './client';

export function toolName(name: string): string { return `hreyfill_${name.replace(/[.-]/g, '_')}`; }
export function validateArguments(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SafeError('Arguments must be an object');
  const args = value as Record<string, unknown>;
  for (const key of Object.keys(args)) if (!['params', 'body', 'confirm', 'allowAuth', 'timeoutSeconds'].includes(key)) throw new SafeError('Unknown argument');
  for (const key of ['params', 'body']) if (key in args && (!args[key] || typeof args[key] !== 'object' || Array.isArray(args[key]))) throw new SafeError(`${key} must be an object`);
  for (const key of ['confirm', 'allowAuth']) if (key in args && typeof args[key] !== 'boolean') throw new SafeError(`${key} must be boolean`);
  if ('timeoutSeconds' in args && (typeof args.timeoutSeconds !== 'number' || !Number.isInteger(args.timeoutSeconds) || args.timeoutSeconds < 1 || args.timeoutSeconds > 30)) throw new SafeError('timeoutSeconds must be an integer from 1 to 30');
  return args;
}

export function createMcpServer(client = new Client(), enableWrites = process.env.HREYFILL_MCP_ENABLE_WRITES === '1'): Server {
  const server = new Server({ name: 'hreyfill', version: '0.1.0' }, { capabilities: { tools: {} } });
  const operations = OPERATIONS.filter(op => op.effect === 'read' || enableWrites);
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: operations.map(op => ({
    name: toolName(op.name), description: op.description,
    inputSchema: { type: 'object' as const, additionalProperties: false, properties: {
      params: op.paramsSchema, ...(op.bodySchema ? { body: op.bodySchema } : {}),
      confirm: { type: 'boolean', description: 'Explicit approval for this write operation.' },
      ...(op.effect === 'auth' ? { allowAuth: { type: 'boolean', description: 'Explicit approval to initiate authentication.' } } : {}),
      timeoutSeconds: { type: 'integer', minimum: 1, maximum: 30 },
    } }, annotations: { readOnlyHint: op.effect === 'read', destructiveHint: op.effect !== 'read', openWorldHint: true },
  })) }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const op = operations.find(candidate => toolName(candidate.name) === request.params.name);
      if (!op) throw new SafeError('Unknown or disabled tool');
      const args = validateArguments(request.params.arguments ?? {});
      if ('allowAuth' in args && op.effect !== 'auth') throw new SafeError('allowAuth is only valid for authentication operations');
      if ('body' in args && !op.bodySchema) throw new SafeError('This operation does not accept a body');
      const result = await client.execute(op.name, args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: error instanceof SafeError ? error.message : 'Operation failed; private error details suppressed' }] };
    }
  });
  return server;
}

export async function serveMcp(): Promise<void> { await createMcpServer().connect(new StdioServerTransport()); }
