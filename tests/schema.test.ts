// Synthetic fixtures only; no captured personal data or live service writes.
import {test,expect} from 'bun:test';import {Client} from '../src/client';
const client=new Client({session:async()=>({accessToken:'x',phoneId:'device'}),fetch:(async()=>Response.json({status:'ok'})) as unknown as typeof fetch});
test('pickup-only create and nullable optional fields are representable',async()=>{
 const value=await client.execute('create-order',{body:{pickupTime:'2026-10-27T22:00:00Z',numPassengers:1,addresses:{pickup:{coord:[0,0],letter:null},destination:null,via:null},payment:null,references:null}});expect((value as any).dryRun).toBe(true);
});
test('via coordinate arrays accepted and invalid latitude refused',async()=>{
 const body={quoteType:'fixedPrice',pickupTime:'2026-10-27T22:00:00Z',numPassengers:1,addresses:{pickup:{coord:[0,0]},destination:{coord:[0,0]},via:{coord:[0,0]}}};
 await expect(client.execute('get-quote',{body})).resolves.toEqual({status:'ok'});body.addresses.via.coord=[100,0];await expect(client.execute('get-quote',{body})).rejects.toThrow('Coordinates');
});
test('SMS previews redact code and phone; payment identifiers remain opaque strings',async()=>{
 const preview=await client.execute('send-validationcode',{params:{type:'phone',phoneNum:'PHONE_NUMBER_PLACEHOLDER',code:'SMS_CODE_PLACEHOLDER'}});expect(JSON.stringify(preview)).not.toContain('SMS_CODE_PLACEHOLDER');expect(JSON.stringify(preview)).not.toContain('PHONE_NUMBER_PLACEHOLDER');
 await expect(client.execute('delete-payment',{params:{id:'opaque-payment-id'}})).resolves.toMatchObject({dryRun:true});
});
