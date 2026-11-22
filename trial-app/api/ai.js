// Netlify/Vercel server endpoint: Cloudflare is never called from the browser.
// POST screen: live inference + server-only Supabase cache; return ONLY safety advice.
// POST review: return AI classification / reasoning only AFTER initial human label.
import {MODEL,getTrial,inferTrial} from './cloudflare.js';

const getUrl=()=>process.env.SUPABASE_URL?.trim().replace(/\/$/,'');
const getKey=()=>process.env.SUPABASE_SECRET_KEY?.trim()||process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const modelReady=()=>!!(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()&&process.env.CLOUDFLARE_API_TOKEN?.trim());
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const inflight=new Map();
function allowed(origin){
 const list=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean);
 return !origin||!list.length||list.includes(origin);
}
function headers(origin){
 const h={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
 if(origin&&allowed(origin))h['Access-Control-Allow-Origin']=origin;
 return h;
}
function respond(status,data,origin){return new Response(JSON.stringify(data),{status,headers:headers(origin)});}
function dbHeaders(){
 const key=getKey();const out={'apikey':key,'Accept':'application/json'};
 if(!key.startsWith('sb_secret_'))out.Authorization='Bearer '+key;
 return out;
}
const dbPath='task_trial_ai_outputs';
function dbUrl(q=''){return getUrl()+'/rest/v1/'+dbPath+q;}
async function readCached(sessionId,trialId){
 const q='?select=output,model,created_at&session_id=eq.'+sessionId+'&trial_id=eq.'+encodeURIComponent(trialId)+'&limit=1';
 const r=await fetch(dbUrl(q),{headers:dbHeaders(),signal:AbortSignal.timeout(7000)});
 if(!r.ok){console.error('AI cache read failed',r.status);throw Error(r.status===404?'AI_CACHE_TABLE_MISSING':'AI_CACHE_READ_ERROR');}
 const rows=await r.json();return rows[0]||null;
}
async function countSession(sessionId){
 const q='?select=trial_id&session_id=eq.'+sessionId+'&limit=13';
 const r=await fetch(dbUrl(q),{headers:dbHeaders(),signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw Error('AI_CACHE_READ_ERROR');
 return (await r.json()).length;
}
async function storeCached(sessionId,trialId,output,usage){
 const rows=[{session_id:sessionId,trial_id:trialId,model:MODEL,output,usage}];
 const r=await fetch(dbUrl('?on_conflict=session_id,trial_id'),{
  method:'POST',headers:{...dbHeaders(),'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates,return=minimal'},
  body:JSON.stringify(rows),signal:AbortSignal.timeout(7000)
 });
 if(!r.ok){console.error('AI cache insert failed',r.status);throw Error('AI_CACHE_WRITE_ERROR');}
}
function publicScreen(row,cacheHit){
 const e=row.output.exposure;
 return {screen:{
   potentially_distressing:e.potentially_distressing,
   categories:e.categories,
   neutral_exposure_notice:e.neutral_exposure_notice,
   euphemized_caption:e.euphemized_caption,
   image_description:e.image_description
  },source:'cloudflare_live',model:row.model||MODEL,
  generated_at:row.created_at||null,cached:cacheHit};
}
function publicReview(row,initial){
 const c=row.output.classification;
 const label=c.hateful?1:0,disagreement=label!==initial;
 return {disagreement,ai_hateful_prediction:label,
  // Return explanations only after a committed initial answer, on disagreement.
  ai_explanation:disagreement?c.explanation:null,
  ai_evidence:disagreement?c.evidence:null,
  ai_alternative_interpretation:disagreement?c.alternative_interpretation:null,
  ai_confidence:c.subjective_confidence,
  source:'cloudflare_live',model:row.model||MODEL,
  generated_at:row.created_at||null};
}
async function cachedOrLive(sessionId,trial){
 const key=sessionId+'|'+trial.trial_id;
 const prior=await readCached(sessionId,trial.trial_id);
 if(prior)return {row:prior,hit:true};
 if(inflight.has(key))return {row:await inflight.get(key),hit:true};
 const work=(async()=>{
  if(await countSession(sessionId)>=12)throw Error('AI_SESSION_LIMIT');
  const {result,usage}=await inferTrial(trial);
  await storeCached(sessionId,trial.trial_id,result,usage);
  return {output:result,model:MODEL,created_at:new Date().toISOString()};
 })();
 inflight.set(key,work);
 try{return {row:await work,hit:false};}finally{inflight.delete(key);}
}
const HTTP_ERROR={
 CLOUDFLARE_NOT_CONFIGURED:503,
 AI_CACHE_TABLE_MISSING:503,
 AI_CACHE_READ_ERROR:503,
 AI_CACHE_WRITE_ERROR:503,
 AI_SESSION_LIMIT:429,
 CLOUDFLARE_RATE_LIMITED:503,
 CLOUDFLARE_AUTH_FAILED:503,
 IMAGE_NOT_ALLOWLISTED:422,
 IMAGE_FETCH_404:502,
 IMAGE_TOO_LARGE:502
};
export async function handle(request){
 const origin=request.headers.get('origin');
 if(!allowed(origin))return respond(403,{ok:false,code:'ORIGIN_NOT_ALLOWED'},origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 const url=new URL(request.url);
 if(request.method==='GET'&&url.searchParams.get('health')==='1')return respond(200,{
  ok:!!(modelReady()&&getUrl()&&getKey()),
  model:MODEL,
  cloudflare_configured:modelReady(),
  database_configured:!!(getUrl()&&getKey())
 },origin);
 if(request.method!=='POST')return respond(405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin);
 if(!modelReady()||!getUrl()||!getKey())return respond(503,{ok:false,code:'LIVE_AI_NOT_CONFIGURED',
  missing:[!process.env.CLOUDFLARE_ACCOUNT_ID?.trim()?'CLOUDFLARE_ACCOUNT_ID':null,
   !process.env.CLOUDFLARE_API_TOKEN?.trim()?'CLOUDFLARE_API_TOKEN':null,
   !getUrl()?'SUPABASE_URL':null,!getKey()?'SUPABASE_SECRET_KEY':null].filter(Boolean)},origin);
 let payload;
 try{
  const raw=await request.text();
  if(raw.length>1500)return respond(413,{ok:false,code:'REQUEST_TOO_LARGE'},origin);
  payload=JSON.parse(raw);
 }catch{return respond(400,{ok:false,code:'INVALID_JSON'},origin);}
 const {phase,session_id,trial_id,condition,initial_classification}=payload||{};
 if(condition!=='assisted'||!['screen','review'].includes(phase)||!uuid(session_id)||typeof trial_id!=='string'||!getTrial(trial_id))
  return respond(422,{ok:false,code:'INVALID_AI_REQUEST'},origin);
 if(phase==='review'&&![0,1].includes(initial_classification))
  return respond(422,{ok:false,code:'INITIAL_LABEL_REQUIRED'},origin);
 const trial=getTrial(trial_id);
 try{
  if(phase==='review'){
   // Review never calls Cloudflare again: must use the full earlier screening
   // output securely cached server-side; no precomputed prediction is used.
   const row=await readCached(session_id,trial_id);
   if(!row)return respond(409,{ok:false,code:'SCREEN_FIRST'},origin);
   return respond(200,{ok:true,...publicReview(row,initial_classification)},origin);
  }
  const {row,hit}=await cachedOrLive(session_id,trial);
  return respond(200,{ok:true,...publicScreen(row,hit)},origin);
 }catch(e){
  const code=String(e?.message||'LIVE_AI_FAILED');
  const known=HTTP_ERROR[code]||(/^(IMAGE_FETCH_|CLOUDFLARE_HTTP_)/.test(code)?502:503);
  console.error('Live AI request error:',code);
  return respond(known,{ok:false,code:code.startsWith('MODEL_')?'AI_MODEL_OUTPUT_INVALID':code},origin);
 }
}
export default async function handler(req,res){
 const body=req.method==='POST'?JSON.stringify(req.body??{}):undefined;
 const request=new Request('https://'+(req.headers.host||'localhost')+(req.url||'/api/ai'),{method:req.method,headers:req.headers,body});
 const response=await handle(request);res.status(response.status);response.headers.forEach((v,k)=>res.setHeader(k,v));res.send(await response.text());
}
