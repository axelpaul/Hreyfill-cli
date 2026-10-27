import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
/** Launch a real stdio server without inheriting credentials or contacting Hreyfill. */
export async function listServerTools(writes=true,command=process.execPath,args=[resolve(import.meta.dir,'../src/index.ts'),'serve']){
 const dir=await mkdtemp(join(tmpdir(),'hreyfill-mcp-list-'));
 const env:Record<string,string>={PATH:process.env.PATH??'',HOME:dir,HREYFILL_CONFIG_DIR:join(dir,'config'),HREYFILL_MCP_ENABLE_WRITES:writes?'1':'0'};
 const client=new Client({name:'catalogue-verifier',version:'1'});
 try{await client.connect(new StdioClientTransport({command,args,env}));return (await client.listTools()).tools;}
 finally{await client.close();await rm(dir,{recursive:true,force:true});}
}
if(import.meta.main)console.log(JSON.stringify(await listServerTools(true),null,2));
