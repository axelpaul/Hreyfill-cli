// Synthetic fixtures only; network transport is a mock for every case.
import {test,expect} from 'bun:test';
import {Client as ServiceClient} from '../src/client';
import {createMcpServer,toolName} from '../src/mcp';
import {OPERATIONS} from '../src/operations';
import {Client as McpClient} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';

const cases=[
 {name:'create-order',args:{body:{pickupTime:'2030-01-01T00:00:00Z',numPassengers:1,addresses:{pickup:{coord:[0,0]}}}}},
 {name:'cancel-order',args:{params:{orderId:1}}},
 {name:'get-payment-windows',args:{}},
 {name:'cc-check-auth',args:{params:{token:'PAYMENT_TOKEN_PLACEHOLDER'}}},
 {name:'cc-auth-failed',args:{params:{token:'PAYMENT_TOKEN_PLACEHOLDER'}}},
];
async function harness(enabled:boolean){
 const calls:string[]=[];
 const service=new ServiceClient({session:async()=>({accessToken:'TEST_TOKEN_NOT_REAL',phoneId:'DEVICE_PLACEHOLDER'}),fetch:(async(url:URL|RequestInfo)=>{calls.push(String(url));return Response.json({status:'ok'});}) as unknown as typeof fetch});
 const server=createMcpServer(service,enabled);const client=new McpClient({name:'confirmation-tests',version:'1'});const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b);
 return {calls,client,close:async()=>{await client.close();await server.close();}};
}
test('booking, cancellation and payment calls never execute without explicit true confirmation',async()=>{
 const h=await harness(true);
 try{
  for(const operation of cases){
   for(const confirm of [undefined,false,'true',1]){
    const result=await h.client.callTool({name:toolName(operation.name),arguments:{...operation.args,...(confirm===undefined?{}:{confirm})}});
    if(confirm===false){expect(result.isError).not.toBe(true);expect(JSON.stringify(result)).toContain('dryRun');}else expect(result.isError).toBe(true);
    expect(h.calls).toHaveLength(0);
   }
  }
  for(const operation of cases){const before=h.calls.length;const result=await h.client.callTool({name:toolName(operation.name),arguments:{...operation.args,confirm:true}});expect(result.isError).not.toBe(true);expect(h.calls).toHaveLength(before+1);}
 }finally{await h.close();}
});
test('disabled writes cannot be called by name, even with confirmation',async()=>{
 const h=await harness(false);
 try{for(const operation of cases){const result=await h.client.callTool({name:toolName(operation.name),arguments:{...operation.args,confirm:true}});expect(result.isError).toBe(true);}expect(h.calls).toHaveLength(0);}finally{await h.close();}
});
test('every authentication operation stays CLI-only even with write opt-in',async()=>{
 const h=await harness(true);
 try{const {tools}=await h.client.listTools();for(const operation of OPERATIONS.filter(op=>op.effect==='auth')){expect(tools.some(tool=>tool.name===toolName(operation.name))).toBe(false);const result=await h.client.callTool({name:toolName(operation.name),arguments:{confirm:true,allowAuth:true}});expect(result.isError).toBe(true);}expect(h.calls).toHaveLength(0);}finally{await h.close();}
});
