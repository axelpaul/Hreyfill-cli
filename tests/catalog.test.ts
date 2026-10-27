// Synthetic fixtures only; no captured personal data or live service writes.
import {test,expect} from 'bun:test';
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../schemas/catalog.schema.json';
import catalog from '../mcp-catalog.json';
import {listServerTools} from '../scripts/list-tools';

test('catalogue validates against the site’s draft 2020-12 schema',()=>{
 const validator=new Ajv2020({allErrors:true}).compile(schema);
 expect(validator(catalog),JSON.stringify(validator.errors)).toBe(true);
 expect(catalog.repo).toBe('axelpaul/Hreyfill-cli');
 expect(catalog.category).toBe('Transport & energy');
});
test('catalogue names and read/write effects match a real stdio tools/list',async()=>{
 const tools=await listServerTools(true);
 const expected=catalog.tools.map((tool:{name:string;write:boolean})=>({name:tool.name,write:tool.write})).sort((a,b)=>a.name.localeCompare(b.name));
 const actual=tools.map(tool=>({name:tool.name,write:tool.annotations?.readOnlyHint!==true})).sort((a,b)=>a.name.localeCompare(b.name));
 expect(actual).toEqual(expected);
 expect(new Set(tools.map(tool=>tool.name)).size).toBe(tools.length);
 for(const tool of tools.filter(tool=>!tool.annotations?.readOnlyHint)){
  expect(tool.inputSchema.required).toContain('confirm');
  expect(tool.inputSchema.properties?.confirm).toMatchObject({type:'boolean'});
 }
 expect(tools.some(tool=>/login|signin|sms|validationcode|auth_import/.test(tool.name))).toBe(false);
},15000);
