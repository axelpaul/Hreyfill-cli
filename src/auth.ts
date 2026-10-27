import { mkdir, readFile, writeFile, rename, chmod, lstat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
export type Session = { accessToken: string; phoneId?: string; firebaseToken?: string };
export function configDir(): string { return process.env.HREYFILL_CONFIG_DIR ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'hreyfill'); }
export async function loadSession(): Promise<Session | null> {
  if (process.env.HREYFILL_ACCESS_TOKEN) return {accessToken:process.env.HREYFILL_ACCESS_TOKEN, phoneId:process.env.HREYFILL_PHONE_ID, firebaseToken:process.env.HREYFILL_FIREBASE_TOKEN};
  try {
    const file = join(configDir(),'auth.json');
    const info=await lstat(file); if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077)) throw new Error('Unsafe session permissions');
    const data: unknown=JSON.parse(await readFile(file,'utf8'));
    return validateSession(data);
  } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new Error('Saved session unavailable; check permissions or import again'); }
}
function validateSession(input: unknown): Session {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Session must be an object');
  const obj=input as Record<string,unknown>;
  if(typeof obj.accessToken!=='string'||!obj.accessToken.trim()||/[\r\n]/.test(obj.accessToken))throw new Error('A valid accessToken is required');
  const session:Session={accessToken:obj.accessToken};
  for(const key of ['phoneId','firebaseToken'] as const)if(obj[key]!==undefined){if(typeof obj[key]!=='string'||!obj[key])throw new Error('Invalid session field');session[key]=obj[key];}
  return session;
}
export async function importSession(input: unknown): Promise<{stored:true}> {
  const data=validateSession(input); const dir=configDir();
  await mkdir(dir,{recursive:true,mode:0o700});const stat=await lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe config directory');await chmod(dir,0o700);
  const tmp=join(dir,`.auth-${randomUUID()}.tmp`);
  try{await writeFile(tmp,JSON.stringify(data),{mode:0o600,flag:'wx'});await rename(tmp,join(dir,'auth.json'));}finally{await unlink(tmp).catch(()=>{});}
  return {stored:true};
}
export async function sessionStatus(): Promise<{authenticated:boolean}> { return {authenticated:!!(await loadSession())}; }
export async function logout(): Promise<{removed:boolean}> {try{await unlink(join(configDir(),'auth.json'));return {removed:true};}catch(error:unknown){if((error as NodeJS.ErrnoException).code==='ENOENT')return {removed:false};throw new Error('Could not remove session');}}
