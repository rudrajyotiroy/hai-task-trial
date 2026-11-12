// Backend shared by Netlify Functions and Vercel. Never send database credentials to the browser.
const getKey=()=>process.env.SUPABASE_SECRET_KEY?.trim()||process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const getUrl=()=>process.env.SUPABASE_URL?.trim().replace(/\/$/,'');
const eventTypes=new Set(['start','response','finish']);
function allowed(origin){const list=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean);return !origin||!list.length||list.includes(origin);}
function headers(origin){const h={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};if(origin&&allowed(origin))h['Access-Control-Allow-Origin']=origin;return h;}
function response(code,value,origin){return new Response(JSON.stringify(value),{status:code,headers:headers(origin)});}
function validId(id){return typeof id==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id);}
function validEvent(e){return e&&typeof e==='object'&&!Array.isArray(e)&&validId(e.event_id)&&validId(e.session_id)&&typeof e.study_id==='string'&&e.study_id.length>0&&e.study_id.length<=100&&eventTypes.has(e.event_type)&&['assisted','independent'].includes(e.condition)&&(e.trial_id==null||(typeof e.trial_id==='string'&&e.trial_id.length<=100))&&typeof e.occurred_at==='string'&&!Number.isNaN(Date.parse(e.occurred_at))&&e.payload&&typeof e.payload==='object'&&!Array.isArray(e.payload);}
function missing(){const arr=[];if(!getUrl())arr.push('SUPABASE_URL');if(!getKey())arr.push('SUPABASE_SECRET_KEY');return arr;}
function credentialHeaders(){const key=getKey();const result={'apikey':key,'Accept':'application/json'};if(!key.startsWith('sb_secret_'))result.Authorization='Bearer '+key;return result;}
function dbUrl(query){return getUrl()+'/rest/v1/task_trial_events'+query;}
async function diagnostic(){const absent=missing();if(absent.length)return {http:503,body:{ok:false,storage:'not_configured',missing_environment:absent}};
 try{const r=await fetch(dbUrl('?select=event_id&limit=1'),{headers:credentialHeaders(),signal:AbortSignal.timeout(9000)});if(!r.ok){console.error('Supabase health failed; HTTP',r.status);return {http:503,body:{ok:false,storage:'unavailable',code:'SUPABASE_'+r.status,hint:r.status===401||r.status===403?'Check the Supabase secret key and project URL.':r.status===404?'Run supabase/schema.sql and confirm the table exists.':'Inspect Netlify function logs and Supabase project status.'}};}return {http:200,body:{ok:true,storage:'ready',checked_at:new Date().toISOString()}};
 }catch(e){console.error('Supabase health network failure:',e?.name||'Error');return {http:503,body:{ok:false,storage:'unavailable',code:'NETWORK_ERROR',hint:'Check Supabase project status and Netlify function logs.'}};}
}
export async function handle(request){const origin=request.headers.get('origin')||null;if(!allowed(origin))return response(403,{ok:false,code:'ORIGIN_NOT_ALLOWED',hint:'Add this exact site origin to ALLOWED_ORIGINS.'},origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 const url=new URL(request.url);
 if(request.method==='GET'&&url.searchParams.get('health')==='1'){const status=await diagnostic();return response(status.http,status.body,origin);}
 if(missing().length)return response(503,{ok:false,code:'BACKEND_NOT_CONFIGURED',missing_environment:missing()},origin);
 if(request.method==='GET'){const candidate=request.headers.get('authorization')||'';const expected=process.env.ADMIN_EXPORT_TOKEN?.trim();if(!expected||candidate!=='Bearer '+expected)return response(401,{ok:false,code:'EXPORT_NOT_AUTHORIZED'},origin);
 const limit=Math.min(1000,Math.max(1,Number(url.searchParams.get('limit'))||1000));const offset=Math.max(0,Number(url.searchParams.get('offset'))||0);
 try{const r=await fetch(dbUrl('?select=*&order=received_at.asc&limit='+limit+'&offset='+offset),{headers:credentialHeaders()});return new Response(await r.text(),{status:r.status,headers:headers(origin)});}catch{return response(503,{ok:false,code:'EXPORT_STORAGE_UNAVAILABLE'},origin);}}
 if(request.method!=='POST')return response(405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin);
 let input;try{const body=await request.text();if(body.length>120000)return response(413,{ok:false,code:'PAYLOAD_TOO_LARGE'},origin);input=JSON.parse(body);}catch{return response(400,{ok:false,code:'INVALID_JSON'},origin);}
 if(!Array.isArray(input?.events)||input.events.length<1||input.events.length>20||!input.events.every(validEvent))return response(422,{ok:false,code:'INVALID_EVENTS',hint:'Expected 1-20 valid study events.'},origin);
 const rows=input.events.map(e=>({event_id:e.event_id,study_id:e.study_id,session_id:e.session_id,event_type:e.event_type,trial_id:e.trial_id||null,condition:e.condition,occurred_at:e.occurred_at,payload:e.payload}));
 try{const r=await fetch(dbUrl('?on_conflict=event_id'),{method:'POST',headers:{...credentialHeaders(),'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(rows),signal:AbortSignal.timeout(12000)});
 if(!r.ok){const detail=await r.text();console.error('Supabase insert rejected:',r.status,detail.slice(0,300));return response(502,{ok:false,code:'SUPABASE_'+r.status,hint:r.status===401||r.status===403?'Confirm the server-side secret key is correct.':r.status===404?'Create the table with the included SQL file.':'See Netlify function logs for insert details.'},origin);}
 return response(200,{ok:true,stored:rows.length},origin);
 }catch(e){console.error('Supabase write error:',e?.name||'Error');return response(502,{ok:false,code:'STORAGE_NETWORK_ERROR'},origin);}
}
// Vercel Node adapter.
export default async function handler(req,res){const body=req.method==='POST'?JSON.stringify(req.body??{}):undefined;const request=new Request('https://'+(req.headers.host||'localhost')+(req.url||'/api/trials'),{method:req.method,headers:req.headers,body});const result=await handle(request);res.status(result.status);result.headers.forEach((v,k)=>res.setHeader(k,v));res.send(await result.text());}
