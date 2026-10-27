import {test,expect} from 'bun:test';import {Client} from '../src/client';
const client=new Client({session:async()=>({accessToken:'x',phoneId:'device'}),fetch:(async()=>Response.json({status:'ok'})) as unknown as typeof fetch});
test('pickup-only create and nullable optional fields are representable',async()=>{
 const value=await client.execute('create-order',{body:{pickupTime:'2026-10-27T22:00:00Z',numPassengers:1,addresses:{pickup:{coord:[64,-21],letter:null},destination:null,via:null},payment:null,references:null}});expect((value as any).dryRun).toBe(true);
});
test('via coordinate arrays accepted and invalid latitude refused',async()=>{
 const body={quoteType:'fixedPrice',pickupTime:'2026-10-27T22:00:00Z',numPassengers:1,addresses:{pickup:{coord:[64,-21]},destination:{coord:[64,-21]},via:{coord:[64,-21]}}};
 await expect(client.execute('get-quote',{body})).resolves.toEqual({status:'ok'});body.addresses.via.coord=[100,-21];await expect(client.execute('get-quote',{body})).rejects.toThrow('Coordinates');
});
test('SMS previews redact code and phone; payment identifiers remain opaque strings',async()=>{
 const preview=await client.execute('send-validationcode',{params:{type:'phone',phoneNum:'5551234',code:'123456'}});expect(JSON.stringify(preview)).not.toContain('123456');expect(JSON.stringify(preview)).not.toContain('5551234');
 await expect(client.execute('delete-payment',{params:{id:'opaque-payment-id'}})).resolves.toMatchObject({dryRun:true});
});
