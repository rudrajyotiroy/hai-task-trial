import test from 'node:test';
import assert from 'node:assert/strict';
import trials from '../data/trials-public.js';
import {MODEL,getTrial,parseCloudflare} from '../api/cloudflare.js';
import {handle} from '../api/ai.js';

const example={
 exposure:{
  potentially_distressing:true,categories:['profanity'],
  potentially_affected_viewers:['people who prefer to avoid strong language'],
  concrete_cues:['one harsh expression'],
  neutral_exposure_notice:'Some harsh language may appear.',
  image_description:'A person beside a sign.',
  euphemized_caption:'A softened paraphrase.'
 },
 classification:{
  hateful:true,evidence:['identity-based exclusion'],
  explanation:'The combined image and text exclude an identity group.',
  alternative_interpretation:'Could be a quoted criticism.',
  subjective_confidence:0.77
 }
};
test('public trial manifest contains no historical model prediction',()=>{
 assert.equal(trials.length,200);
 assert.equal(new Set(trials.map(t=>t.trial_id)).size,200);
 for(const item of trials){
  assert.deepEqual(Object.keys(item).sort(),['image_url','meme_text','trial_id']);
  assert.deepEqual(getTrial(item.trial_id),item);
  assert.ok(item.image_url.startsWith('https://huggingface.co/datasets/limjiayi/hateful_memes_expanded/resolve/main/img/'));
 }
 assert.equal(getTrial('A2_UNKNOWN'),undefined);
});
test('validates Cloudflare JSON format and schemas',()=>{
 const out=parseCloudflare(JSON.stringify(example));
 assert.equal(out.exposure.potentially_distressing,true);
 assert.equal(out.classification.hateful,true);
 assert.equal(out.classification.subjective_confidence,0.77);
 assert.equal(MODEL,'@cf/google/gemma-4-26b-a4b-it');
 assert.throws(()=>parseCloudflare('not json'),/MODEL_FORMAT/);
 assert.throws(()=>parseCloudflare('{"exposure":{},"classification":{}}'),/MODEL_SCHEMA_INVALID/);
});
test('every assisted screen and review call triggers fresh model inference; no database/cache',async()=>{
 const oldFetch=globalThis.fetch;
 const keys=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','SUPABASE_URL','SUPABASE_SECRET_KEY','ALLOWED_ORIGINS'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 let aiCalls=0,images=0;
 try{
  Object.assign(process.env,{
   CLOUDFLARE_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',
   CLOUDFLARE_API_TOKEN:'test-only-not-a-real-secret',
   ALLOWED_ORIGINS:'https://example.com'
  });
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  globalThis.fetch=async(url,opts)=>{
   const dest=String(url);
   assert.doesNotMatch(dest,/supabase|task_trial_ai_outputs/);
   if(dest.startsWith('https://huggingface.co/')){
    images++;
    return new Response(image,{status:200,headers:{'Content-Type':'image/png'}});
   }
   assert.match(dest,/api\.cloudflare\.com/);
   assert.equal(opts.method,'POST');
   const p=JSON.parse(opts.body);
   assert.equal(p.store,false);
   aiCalls++;
   return Response.json({choices:[{message:{content:JSON.stringify(example)}}],usage:{}});
  };
  const session_id='00000000-0000-4000-8000-000000000001',trial_id=trials[0].trial_id;
  const call=async (body,condition='assisted')=>{
   const r=await handle(new Request('https://example.com/api/ai',{
    method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},
    body:JSON.stringify({...body,session_id,trial_id,condition})
   }));
   return {status:r.status,body:await r.json()};
  };
  const health=await handle(new Request('https://example.com/api/ai?health=1'));
  assert.equal((await health.json()).ok,true);
  const screen=await call({phase:'screen'});
  assert.equal(screen.status,200);
  assert.equal(screen.body.screen.potentially_distressing,true);
  assert.equal(screen.body.source,'cloudflare_live');
  assert.equal(JSON.stringify(screen.body).includes('classification'),false);
  assert.equal(JSON.stringify(screen.body).includes('identity-based exclusion'),false);
  assert.equal(Object.hasOwn(screen.body,'cached'),false);
  assert.equal(aiCalls,1);

  const screenAgain=await call({phase:'screen'});
  assert.equal(screenAgain.status,200);
  assert.equal(aiCalls,2,'repeat request must be new inference, not cache hit');

  const missing=await call({phase:'review'});
  assert.equal(missing.status,422);
  assert.equal(aiCalls,2);
  const review=await call({phase:'review',initial_classification:0});
  assert.equal(review.status,200);
  assert.equal(review.body.disagreement,true);
  assert.equal(review.body.ai_hateful_prediction,1);
  assert.match(review.body.ai_explanation,/combined image and text/);
  assert.equal(aiCalls,3);

  const agree=await call({phase:'review',initial_classification:1});
  assert.equal(agree.status,200);
  assert.equal(agree.body.disagreement,false);
  assert.equal(agree.body.ai_explanation,null);
  assert.equal(aiCalls,4);

  const reject=await call({phase:'screen'},'independent');
  assert.equal(reject.status,422);
  assert.equal(aiCalls,4);
  assert.equal(images,4);
 }finally{
  globalThis.fetch=oldFetch;
  for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
 }
});
