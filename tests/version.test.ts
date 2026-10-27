// Version checks use isolated empty session storage and never contact the service.
import {test,expect} from 'bun:test';
import metadata from '../package.json';
import {VERSION} from '../src/version';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('CLI version, help and doctor use package.json version',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hreyfill-version-'));
 try{
  expect(VERSION).toBe(metadata.version);
  for(const command of ['--version','help','doctor']){
   const p=Bun.spawnSync([process.execPath,join(import.meta.dir,'../src/index.ts'),command],{env:{PATH:process.env.PATH,HOME:dir,HREYFILL_CONFIG_DIR:dir},stdout:'pipe',stderr:'pipe'});
   expect(p.exitCode).toBe(0);expect(command==='--version'?p.stdout.toString().trim():JSON.parse(p.stdout.toString()).version).toBe(metadata.version);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
