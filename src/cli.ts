import { readFile, writeFile } from 'node:fs/promises';
import { OPERATIONS } from './operations';
import { VERSION } from './version';
import { Client, SafeError } from './client';
import { importSession, sessionStatus, logout } from './auth';
import { serveMcp } from './mcp';
export { serveMcp } from './mcp';

function print(value: unknown): void { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function objectJson(text: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new SafeError('Invalid JSON; expected an object'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SafeError('Expected a JSON object');
  return value as Record<string, unknown>;
}
export async function main(argv: string[]): Promise<void> {
  try { await run(argv); } catch (error) { if (error instanceof SafeError) throw error; throw new SafeError('Command failed; check input files, session permissions, and schema'); }
}
async function run(argv: string[]): Promise<void> {
  if (argv.filter(arg => arg === '--json').length > 1) throw new SafeError('Duplicate option: --json');
  const args = argv.filter(arg => arg !== '--json');
  let command = args.shift() ?? 'help';
  const aliases: Record<string, string | Record<string, string>> = {
    orders: { upcoming: 'get-order-upcoming', history: 'get-order-history', get: 'get-order', recent: 'get-most-recent-order-today', cancel: 'cancel-order', remove: 'remove-order', create: 'create-order' },
    profile: { get: 'get-user', edit: 'update-attributes', delete: 'delete-user' },
    quote: 'get-quote', contacts: 'get-call-list', 'transport-options': 'get-transportation-options',
    trip: { path: 'get-trip-path', rate: 'send-rating', image: 'get-driver-image' },
    receipt: 'get-receipt', sms: { send: 'send-sms-validation-request', verify: 'send-validationcode' }, login: 'send-login-request',
  };
  const alias = aliases[command];
  if (typeof alias === 'string') command = alias;
  else if (alias) { const subcommand = args.shift(); if (!subcommand || !alias[subcommand]) throw new SafeError('Unknown subcommand; run hreyfill help'); command = alias[subcommand]!; }
  if (command === 'help' || command === '--help') {
    if (args.length) throw new SafeError('Unexpected help arguments');
    print({ name: 'hreyfill', version: VERSION, usage: 'hreyfill <operation> [--params JSON] [--data JSON|@file] [--yes] [--allow-auth] [--timeout SECONDS] [--output PATH]', aliases, commands: ['help', 'schema', 'doctor', 'version', 'serve', 'auth status', 'auth import --file PATH (or stdin)', 'auth logout'], operations: OPERATIONS.map(op => ({ name: op.name, description: op.description, effect: op.effect })) }); return;
  }
  if (command === 'version' || command === '--version') { if (args.length) throw new SafeError('Unexpected version arguments'); if(command === '--version' && !argv.includes('--json'))process.stdout.write(`${VERSION}\n`);else print({ version: VERSION }); return; }
  if (command === 'schema') { if (args.length > 1) throw new SafeError('Expected at most one operation'); const op = args[0] ? OPERATIONS.find(op => op.name === args[0]) : undefined; if (args[0] && !op) throw new SafeError('Unknown operation'); print(op ?? OPERATIONS); return; }
  if (command === 'doctor') { if (args.length) throw new SafeError('Unexpected doctor arguments'); print({ sessionStored: (await sessionStatus()).authenticated, version: VERSION, networkChecked: false }); return; }
  if (command === 'serve') { if (args.length) throw new SafeError('Unexpected serve arguments'); await serveMcp(); return; }
  if (command === 'auth') {
    const sub = args.shift();
    if (sub === 'status' || sub === 'logout') { if (args.length) throw new SafeError('Unexpected auth arguments'); print(sub === 'status' ? await sessionStatus() : await logout()); return; }
    if (sub === 'import') {
      if (args.length && (args.length !== 2 || args[0] !== '--file')) throw new SafeError('Usage: auth import [--file PATH]');
      const input = args.length ? await readFile(args[1]!, 'utf8') : await Bun.stdin.text(); print(await importSession(JSON.parse(input))); return;
    }
    throw new SafeError('Expected auth import, status, or logout');
  }
  const op = OPERATIONS.find(op => op.name === command);
  if (!op) throw new SafeError('Unknown operation; run hreyfill help');
  const options: { params?: Record<string, unknown>; body?: Record<string, unknown>; confirm?: boolean; allowAuth?: boolean; timeoutSeconds?: number } = {};
  let output: string | undefined;
  const seen = new Set<string>();
  while (args.length) {
    const flag = args.shift()!;
    if (seen.has(flag)) throw new SafeError('Duplicate option');
    seen.add(flag);
    if (flag === '--yes') { options.confirm = true; continue; }
    if (flag === '--allow-auth') { options.allowAuth = true; continue; }
    if (!['--params', '--data', '--output', '--timeout'].includes(flag)) throw new SafeError('Unknown option; run hreyfill help');
    const value = args.shift();
    if (!value || value.startsWith('--')) throw new SafeError('Missing option value');
    if (flag === '--params') options.params = objectJson(value);
    if (flag === '--data') options.body = objectJson(value.startsWith('@') ? await readFile(value.slice(1), 'utf8') : value);
    if (flag === '--output') output = value;
    if (flag === '--timeout') { const seconds = Number(value); if (!Number.isInteger(seconds) || seconds < 1 || seconds > 30) throw new SafeError('Timeout must be an integer from 1 to 30 seconds'); options.timeoutSeconds = seconds; }
  }
  if (options.allowAuth && op.effect !== 'auth') throw new SafeError('--allow-auth is only valid for authentication operations');
  if (output && op.responseType !== 'binary') throw new SafeError('--output is only valid for binary operations');
  if (op.responseType === 'binary' && !output) throw new SafeError('Binary operations require --output PATH');
  const result = await new Client().execute(op.name, options);
  if (output) {
    if (!result || typeof result !== 'object' || !('base64' in result) || typeof result.base64 !== 'string') throw new SafeError('Operation did not return binary data');
    await writeFile(output, Buffer.from(result.base64, 'base64'), { flag: 'wx', mode: 0o600 }); print({ saved: output });
  } else print(result);
}
