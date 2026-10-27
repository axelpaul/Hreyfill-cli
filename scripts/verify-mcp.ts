import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {resolve} from 'node:path';
import {OPERATIONS} from '../src/operations';
const environment=Object.fromEntries(Object.entries(process.env).filter((entry:[string,string|undefined]):entry is [string,string]=>entry[1]!==undefined));
for(const enabled of [false,true]){
 const client=new Client({name:'hreyfill-smoke',version:'1'});
 const transport=new StdioClientTransport({command:resolve(import.meta.dir,'../hreyfill'),args:['serve'],env:{...environment,HREYFILL_MCP_ENABLE_WRITES:enabled?'1':'0'}});
 try{
  await client.connect(transport);const {tools}=await client.listTools();const expected=OPERATIONS.filter(op=>enabled||op.effect==='read').length;
  if(tools.length!==expected)throw new Error('Wrong tool count');
  if(enabled){const result=await client.callTool({name:'hreyfill_cancel_order',arguments:{params:{orderId:123}}});const content=result.content as Array<{type:string;text?:string}>;const text=content.find(item=>item.type==='text')?.text;if(result.isError||!text||JSON.parse(text).dryRun!==true)throw new Error('Preview failed');}
  console.log(JSON.stringify({mcpInitialize:true,writesEnabled:enabled,tools:tools.length,...(enabled?{writePreview:true}:{})}));
 }finally{await client.close();}
}
