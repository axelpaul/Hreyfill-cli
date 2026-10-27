import Ajv from 'ajv';
import { OPERATIONS, type Operation } from './operations';
import { loadSession, importSession, type Session } from './auth';
export class SafeError extends Error {}
const SECRET=/token|password|passcode|secret|authorization|api.?key|phoneid|phonenum|subscriptionalias|ticket|card.?number|cvv|cvc|^pan$|^code$/i;
export function redact(value: unknown): unknown {
  if(Array.isArray(value))return value.map((item:unknown)=>redact(item));
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item]:[string,unknown])=>[key,SECRET.test(key)?'[redacted]':redact(item)]));
  if(typeof value==='string' && /^https?:\/\//i.test(value)){try{const url=new URL(value);for(const key of [...url.searchParams.keys()])if(SECRET.test(key))url.searchParams.set(key,'[redacted]');return url.toString();}catch{return '[redacted URL]';}}
  return value;
}
export type ExecuteArgs={params?:Record<string,unknown>;body?:Record<string,unknown>;confirm?:boolean;allowAuth?:boolean;timeoutSeconds?:number};
type Options={fetch?:typeof fetch;session?:()=>Promise<Session|null>;saveSession?:typeof importSession};
const ajv=new Ajv({allErrors:false,strict:false,validateFormats:false});
function validate(schema:Record<string,unknown>,value:unknown,label:string):void {
  if(!ajv.validate(schema,value))throw new SafeError(`Invalid ${label}; consult schema for accepted fields and types`);
}
export class Client {
  private http:typeof fetch;
  private session:()=>Promise<Session|null>;
  private saveSession:typeof importSession;
  constructor(options:Options={}){this.http=options.fetch??fetch;this.session=options.session??loadSession;this.saveSession=options.saveSession??importSession;}
  async execute(name:string,args:ExecuteArgs={}):Promise<unknown>{
    const operation=OPERATIONS.find((item:Operation)=>item.name===name);
    if(!operation)throw new SafeError('Unknown operation; run schema');
    if(!args || typeof args!=='object'||Array.isArray(args)||Object.keys(args).some((key:string)=>!['params','body','confirm','allowAuth','timeoutSeconds'].includes(key)))throw new SafeError('Invalid operation arguments');
    for(const key of ['confirm','allowAuth'] as const)if(args[key]!==undefined&&typeof args[key]!=='boolean')throw new SafeError('Confirmation flags must be boolean');
    const timeout=args.timeoutSeconds??10;if(!Number.isInteger(timeout)||timeout<1||timeout>30)throw new SafeError('timeoutSeconds must be an integer from 1 to 30');
    const params=args.params??{};validate(operation.paramsSchema,params,'params');
    if(args.body!==undefined&&!operation.bodySchema)throw new SafeError('This operation accepts no body');
    let body=args.body===undefined?undefined:structuredClone(args.body);
    if(operation.bodySchema){if(body===undefined)throw new SafeError('This operation requires body; consult schema');validate(operation.bodySchema,body,'body');}
    if(operation.effect!=='read'&&!args.confirm)return {dryRun:true,operation:name,effect:operation.effect,params:redact(params),body:redact(body),coverage:operation.coverage,executed:false};
    if(operation.effect==='auth'&&args.allowAuth!==true)throw new SafeError('Authentication operation requires explicit allowAuth and confirmation');
    let session:Session|null=null;
    if(operation.authRequired||operation.bodySchema){try{session=await this.session();}catch{throw new SafeError('Saved session unavailable; import a valid session');}}
    if(operation.authRequired&&!session?.accessToken)throw new SafeError('No saved session; use auth import');
    if(body && session){for(const key of ['phoneId','firebaseToken'] as const)if((operation.bodySchema?.properties as Record<string,unknown>|undefined)?.[key] && body[key]===undefined && session[key])body[key]=session[key];validate(operation.bodySchema!,body,'body');}
    if(body && (name==='get-quote'||name==='create-order')){
      const addresses=body.addresses as Record<string,{coord:number[]}|undefined>;
      for(const address of [addresses.pickup,addresses.destination,addresses.via])if(address && (Math.abs(address.coord[0])>90||Math.abs(address.coord[1])>180))throw new SafeError('Coordinates must be latitude, longitude within valid bounds');
      if(!body.phoneId)throw new SafeError('phoneId required; import a session with device identity');
    }
    let path=operation.path;
    for(const [key,value] of Object.entries(params))path=path.replace(`{${key}}`,encodeURIComponent(String(value)));
    const url=new URL(path);
    if(!['infinity.frogne.dk','maps.googleapis.com'].includes(url.hostname)||url.protocol!=='https:'||url.username||url.password)throw new SafeError('Unsupported endpoint');
    for(const [key,value] of Object.entries(params))if(!operation.path.includes(`{${key}}`)&&!(operation.method==='WS'))url.searchParams.set(key,String(value));
    const headers:Record<string,string>={Accept:operation.responseType==='binary'?'*/*':'application/json'};
    if(session?.accessToken&&url.hostname==='infinity.frogne.dk')headers.Authorization=session.accessToken;
    if(operation.google){const key=process.env.HREYFILL_GOOGLE_API_KEY;if(!key)throw new SafeError('Google Maps operations require your own HREYFILL_GOOGLE_API_KEY');url.searchParams.set('key',key);}
    if(operation.method==='WS')return this.stream(operation,url,params,headers,timeout);
    if(body!==undefined)headers['Content-Type']='application/json';
    let response:Response;
    try{response=await this.http(url,{method:operation.method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(timeout*1000)});}catch{throw new SafeError(operation.effect==='read'?'Hreyfill request failed or timed out; no automatic retry attempted':'Request failed or timed out; server outcome may be unknown. Check current state before retrying');}
    if(!response.ok)throw new SafeError(`Hreyfill HTTP ${response.status}; ${operation.effect==='read'?'no automatic retry attempted':'server outcome may be unknown; check state before retrying'}`);
    const bytes=await readBounded(response,10*1024*1024);
    if(operation.responseType==='binary')return {base64:Buffer.from(bytes).toString('base64'),contentType:response.headers.get('content-type')??'application/octet-stream'};
    let result:unknown;
    try{result=bytes.length?JSON.parse(new TextDecoder().decode(bytes)):{};}catch{throw new SafeError(operation.effect==='read'?'Hreyfill returned a non-JSON response':'Unexpected response; server outcome may be unknown. Check state before retrying');}
    const object=result as Record<string,unknown>|null;
    if(object && typeof object==='object' && typeof object.status==='string' && !['ok','OK','ZERO_RESULTS'].includes(object.status))throw new SafeError('Service rejected operation; private error response suppressed');
    if(operation.effect==='auth' && object && typeof object.accessToken==='string'){
      await this.saveSession({accessToken:object.accessToken,phoneId:body?.phoneId??session?.phoneId,firebaseToken:body?.firebaseToken??session?.firebaseToken});
      return {authenticated:true,stored:true};
    }
    return redact(result);
  }
  private async stream(operation:Operation,url:URL,params:Record<string,unknown>,headers:Record<string,string>,seconds:number):Promise<unknown>{
    url.protocol='wss:';
    return new Promise((resolve,reject)=>{
      let settled=false;const messages:unknown[]=[];let size=0;
      // Bun supports authenticated WebSocket options; DOM lib only declares browser protocols.
      const Socket = WebSocket as unknown as {new(url: URL, options:{headers:Record<string,string>}):WebSocket};
      const socket=new Socket(url,{headers});
      const timer=setTimeout(()=>finish(),seconds*1000);
      const finish=(failed=false):void=>{if(settled)return;settled=true;clearTimeout(timer);socket.close(1000);if(failed)reject(new SafeError('Live feed unavailable; no reconnect attempted'));else resolve({operation:operation.name,messages:redact(messages),boundedSeconds:seconds});};
      socket.addEventListener('open',()=>{if(operation.name==='nearby')socket.send(JSON.stringify({center:[params.latitude,params.longitude]}));});
      socket.addEventListener('message',(event:MessageEvent)=>{if(typeof event.data!=='string')return;size+=event.data.length;if(size>1024*1024){finish();return;}try{messages.push(JSON.parse(event.data));}catch{finish(true);return;}if(messages.length>=100)finish();});
      socket.addEventListener('error',()=>finish(true));socket.addEventListener('close',()=>finish());
    });
  }
}
async function readBounded(response:Response,max:number):Promise<Uint8Array>{
  if(!response.body)return new Uint8Array();const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>max){await reader.cancel();throw new SafeError('Response exceeds size limit');}chunks.push(item.value);}}finally{reader.releaseLock();}
  return new Uint8Array(Buffer.concat(chunks));
}
