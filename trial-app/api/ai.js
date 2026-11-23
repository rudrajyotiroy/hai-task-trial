// Stateless Netlify/Vercel endpoint. Every assisted AI request invokes Cloudflare.
// NO Supabase model-output table, in-memory result cache or historical predictions.
import {MODEL,getTrial,inferTrial} from './cloudflare.js';

const modelReady=()=>!!(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()&&process.env.CLOUDFLARE_API_TOKEN?.trim());
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
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
function publicScreen(result){
 const e=result.exposure;
 return {screen:{
  potentially_distressing:e.potentially_distressing,
  categories:e.categories,
  neutral_exposure_notice:e.neutral_exposure_notice,
  euphemized_caption:e.euphemized_caption,
  image_description:e.image_description
 },source:'cloudflare_live',model:MODEL,generated_at:new Date().toISOString()};
}
function publicReview(result,initial){
 const c=result.classification,label=c.hateful?1:0,disagreement=label!==initial;
 return {disagreement,ai_hateful_prediction:label,
  ai_explanation:disagreement?c.explanation:null,
  ai_evidence:disagreement?c.evidence:null,
  ai_alternative_interpretation:disagreement?c.alternative_interpretation:null,
  ai_confidence:c.subjective_confidence,
  source:'cloudflare_live',model:MODEL,generated_at:new Date().toISOString()};
}
const HTTP_ERROR={
 CLOUDFLARE_NOT_CONFIGURED:503,CLOUDFLARE_RATE_LIMITED:503,
 CLOUDFLARE_AUTH_FAILED:503,IMAGE_NOT_ALLOWLISTED:422,
 IMAGE_FETCH_404:502,IMAGE_TOO_LARGE:502
};
export async function handle(request){
 const origin=request.headers.get('origin');
 if(!allowed(origin))return respond(403,{ok:false,code:'ORIGIN_NOT_ALLOWED'},origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 const url=new URL(request.url);
 if(request.method==='GET'&&url.searchParams.get('health')==='1')return respond(200,{
  ok:modelReady(),model:MODEL,cloudflare_configured:modelReady()
 },origin);
 if(request.method!=='POST')return respond(405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin);
 if(!modelReady())return respond(503,{ok:false,code:'LIVE_AI_NOT_CONFIGURED',
  missing:[!process.env.CLOUDFLARE_ACCOUNT_ID?.trim()?'CLOUDFLARE_ACCOUNT_ID':null,
   !process.env.CLOUDFLARE_API_TOKEN?.trim()?'CLOUDFLARE_API_TOKEN':null].filter(Boolean)},origin);
 let payload;
 try{
  const raw=await request.text();
  if(raw.length>1500)return respond(413,{ok:false,code:'REQUEST_TOO_LARGE'},origin);
  payload=JSON.parse(raw);
 }catch{return respond(400,{ok:false,code:'INVALID_JSON'},origin);}
 const {phase,session_id,trial_id,condition,initial_classification}=payload||{};
 if(condition!=='assisted'||!['screen','review'].includes(phase)||!uuid(session_id)||
    typeof trial_id!=='string'||!getTrial(trial_id))
  return respond(422,{ok:false,code:'INVALID_AI_REQUEST'},origin);
 if(phase==='review'&&![0,1].includes(initial_classification))
  return respond(422,{ok:false,code:'INITIAL_LABEL_REQUIRED'},origin);
 try{
  // Each POST is a new, independent model inference. No output is cached.
  const {result}=await inferTrial(getTrial(trial_id));
  return respond(200,{ok:true,...(phase==='screen'?publicScreen(result):publicReview(result,initial_classification))},origin);
 }catch(e){
  const code=String(e?.message||'LIVE_AI_FAILED');
  const status=HTTP_ERROR[code]||(/^(IMAGE_FETCH_|CLOUDFLARE_HTTP_)/.test(code)?502:503);
  console.error('Live AI request error:',code);
  return respond(status,{ok:false,code:code.startsWith('MODEL_')?'AI_MODEL_OUTPUT_INVALID':code},origin);
 }
}
export default async function handler(req,res){
 const body=req.method==='POST'?JSON.stringify(req.body??{}):undefined;
 const request=new Request('https://'+(req.headers.host||'localhost')+(req.url||'/api/ai'),{method:req.method,headers:req.headers,body});
 const response=await handle(request);res.status(response.status);response.headers.forEach((v,k)=>res.setHeader(k,v));res.send(await response.text());
}
