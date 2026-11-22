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

test('public trial manifest includes no archived AI predictions',()=>{
 assert.equal(trials.length,200);
 assert.equal(new Set(trials.map(t=>t.trial_id)).size,200);
 for(const item of trials){
  assert.deepEqual(Object.keys(item).sort(),['image_url','meme_text','trial_id']);
  assert.deepEqual(getTrial(item.trial_id),item);
  assert.ok(item.image_url.startsWith('https://huggingface.co/datasets/limjiayi/hateful_memes_expanded/resolve/main/img/'));
 }
 assert.equal(getTrial('A2_UNKNOWN'),undefined);
});
test('model JSON parsed with explicit exposure/classification schemas',()=>{
 const r=parseCloudflare(JSON.stringify(example));
 assert.equal(r.exposure.potentially_distressing,true);
 assert.equal(r.classification.hateful,true);
 assert.equal(r.classification.subjective_confidence,.77);
 assert.equal(MODEL,'@cf/google/gemma-4-26b-a4b-it');
 assert.throws(()=>parseCloudflare('not json'),/MODEL_FORMAT/);
 assert.throws(()=>parseCloudflare('{"exposure":{},"classification":{}}'),/MODEL_SCHEMA_INVALID/);
});
test('live API cache hides classification on screen, reveals it only after first label',async()=>{
 const oldFetch=globalThis.fetch,keys=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','SUPABASE_URL','SUPABASE_SECRET_KEY','ALLOWED_ORIGINS'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const sample={output:example,model:MODEL,created_at:'2026-11-22T12:00:00Z'};
 try{
  Object.assign(process.env,{
   CLOUDFLARE_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',
   CLOUDFLARE_API_TOKEN:'test-only-not-a-real-secret',
   SUPABASE_URL:'https://fake.supabase.co',
   SUPABASE_SECRET_KEY:'sb_secret_test_only',
   ALLOWED_ORIGINS:'https://example.com'
  });
  const fetched=[];
  globalThis.fetch=async(url,opts)=>{
   fetched.push({url:String(url),opts});
   assert.match(String(url),/fake\.supabase\.co\/rest\/v1\/task_trial_ai_outputs/);
   return Response.json([sample]);
  };
  const session_id='00000000-0000-4000-8000-000000000001',trial_id=trials[0].trial_id;
  const call=async body=>{
   const r=await handle(new Request('https://example.com/api/ai',{
    method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({...body,session_id,trial_id,condition:'assisted'})
   }));
   return {status:r.status,body:await r.json()};
  };
  const screen=await call({phase:'screen'});
  assert.equal(screen.status,200);
  assert.equal(screen.body.screen.potentially_distressing,true);
  assert.equal(screen.body.source,'cloudflare_live');
  assert.equal(JSON.stringify(screen.body).includes('classification'),false);
  assert.equal(JSON.stringify(screen.body).includes('identity-based exclusion'),false);
  const reject=await call({phase:'review'});
  assert.equal(reject.status,422);
  const review=await call({phase:'review',initial_classification:0});
  assert.equal(review.status,200);
  assert.equal(review.body.disagreement,true);
  assert.equal(review.body.ai_hateful_prediction,1);
  assert.match(review.body.ai_explanation,/combined image and text/);
  const agree=await call({phase:'review',initial_classification:1});
  assert.equal(agree.body.disagreement,false);
  assert.equal(agree.body.ai_explanation,null);
  const deny=new Request('https://example.com/api/ai',{method:'POST',headers:{Origin:'https://example.com'},body:JSON.stringify({phase:'screen',session_id,trial_id,condition:'independent'})});
  assert.equal((await handle(deny)).status,422);
  assert.equal(fetched.length,3);
 }finally{
  globalThis.fetch=oldFetch;
  for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
 }
});
