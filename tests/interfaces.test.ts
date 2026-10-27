// Synthetic fixtures only; no captured personal data or live service writes.
import { describe, expect, test } from 'bun:test';
import { createMcpServer, toolName, validateArguments } from '../src/mcp';
import { Client as ServiceClient } from '../src/client';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const entry = join(import.meta.dir, '../src/index.ts');
function cli(args: string[], dir: string, input?: string) {
  const env: Record<string, string | undefined> = { ...process.env, HREYFILL_CONFIG_DIR: dir };
  delete env.HREYFILL_ACCESS_TOKEN;
  return Bun.spawnSync([process.execPath, entry, ...args], { env, stdin: input === undefined ? undefined : Buffer.from(input), stdout: 'pipe', stderr: 'pipe' });
}

describe('interface input boundaries', () => {
  test('maps operation names to MCP names', () => { expect(toolName('orders.get-one')).toBe('hreyfill_orders_get_one'); });
  test('rejects unexpected wrapper properties', () => { expect(() => validateArguments({ yes: true })).toThrow(); });
  test('rejects non-object and invalid wrapper types', () => {
    for (const input of [null, [], { params: [] }, { body: 'secret' }, { confirm: 'true' }, { allowAuth: 1 }, { timeoutSeconds: Infinity }, { timeoutSeconds: 31 }, { timeoutSeconds: 0 }, { timeoutSeconds: 1.5 }]) expect(() => validateArguments(input)).toThrow();
  });
  test('accepts well-shaped wrapper', () => { expect(validateArguments({ params: {}, body: {}, confirm: true, timeoutSeconds: 5 })).toEqual({ params: {}, body: {}, confirm: true, timeoutSeconds: 5 }); });
});

describe('CLI offline safety', () => {
  test('write alias defaults to a dry run without session or network', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hreyfill-cli-'));
    try {
      const result = cli(['orders', 'cancel', '--params', '{"orderId":123}'], dir);
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.toString())).toMatchObject({ dryRun: true, executed: false, operation: 'cancel-order' });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('imports stdin session privately and doctor does not claim verified authentication', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hreyfill-cli-'));
    try {
      const imported = cli(['auth', 'import'], dir, '{"accessToken":"test-session-secret"}');
      expect(imported.exitCode).toBe(0);
      expect(imported.stdout.toString()).not.toContain('test-session-secret');
      expect(statSync(join(dir, 'auth.json')).mode & 0o777).toBe(0o600);
      const doctor = JSON.parse(cli(['doctor'], dir).stdout.toString());
      expect(doctor).toMatchObject({ sessionStored: true, networkChecked: false });
      expect(doctor.authenticated).toBeUndefined();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('unknown flags and malformed JSON do not echo secrets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hreyfill-cli-'));
    try {
      for (const args of [['orders', 'cancel', '--secret-token'], ['quote', '--data', 'private-token-invalid-json']]) {
        const result = cli(args, dir);
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr.toString()).not.toContain('secret-token');
        expect(result.stderr.toString()).not.toContain('private-token');
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('MCP exposure', () => {
  test('default tool list is read-only and hides authentication administration', async () => {
    const server = createMcpServer(new ServiceClient(), false);
    const client = new McpClient({ name: 'test', version: '1' });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const { tools } = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(tool => tool.annotations?.readOnlyHint === true)).toBe(true);
      expect(tools.some(tool => tool.name.includes('cancel_order') || tool.name.includes('login') || tool.name.includes('auth_import'))).toBe(false);
    } finally { await client.close(); await server.close(); }
  });
  test('unknown exceptions are suppressed rather than echoed to the caller', async () => {
    const service = new ServiceClient();
    service.execute = async () => { throw new Error('private-secret-exception'); };
    const server = createMcpServer(service, false);
    const client = new McpClient({ name: 'test', version: '1' });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const result = await client.callTool({ name: 'hreyfill_get_user', arguments: {} });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).not.toContain('private-secret-exception');
    } finally { await client.close(); await server.close(); }
  });
});
