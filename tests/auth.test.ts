import {test,expect} from 'bun:test';
import {mkdtemp,rm,stat,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {importSession,loadSession,logout} from '../src/auth';
test('sessions are private, whitelisted and removable; unsafe links refused',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hreyfill-auth-'));const old=process.env.HREYFILL_CONFIG_DIR;const envToken=process.env.HREYFILL_ACCESS_TOKEN;delete process.env.HREYFILL_ACCESS_TOKEN;process.env.HREYFILL_CONFIG_DIR=join(dir,'config');
 try{
  await importSession({accessToken:'test-token',phoneId:'device',unrelated:'not copied'});
  expect((await stat(join(dir,'config'))).mode&0o777).toBe(0o700);expect((await stat(join(dir,'config','auth.json'))).mode&0o777).toBe(0o600);expect(await loadSession()).toEqual({accessToken:'test-token',phoneId:'device'});
  expect(await logout()).toEqual({removed:true});expect(await loadSession()).toBeNull();
  await writeFile(join(dir,'target'),JSON.stringify({accessToken:'x'}),{mode:0o600});await symlink(join(dir,'target'),join(dir,'config','auth.json'));await expect(loadSession()).rejects.toThrow('Saved session unavailable');
 }finally{if(old===undefined)delete process.env.HREYFILL_CONFIG_DIR;else process.env.HREYFILL_CONFIG_DIR=old;if(envToken!==undefined)process.env.HREYFILL_ACCESS_TOKEN=envToken;await rm(dir,{recursive:true,force:true});}
});
