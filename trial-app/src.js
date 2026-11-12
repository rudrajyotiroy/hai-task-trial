import './style.css';
import trials from './data/trials.json';

const root=document.getElementById('app');
const CONDITION=location.pathname.startsWith('/independent')?'independent':'assisted';
const KEY='hai-task-trial-v3-'+CONDITION, STUDY='hai-meme-evaluation-v1', DEFAULT_COUNT=12, MAX_COUNT=30;
const id=()=>crypto.randomUUID();
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const randomized=list=>{const values=[...list];for(let i=values.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values;};
const fresh=()=>({id:id(),condition:CONDITION,order:randomized(trials).slice(0,MAX_COUNT).map(t=>t.trial_id),planned:DEFAULT_COUNT,index:0,stage:'welcome',consented:false,answers:{},events:[],started:null,opened:null,sessionVersion:3});
let state;try{state=JSON.parse(localStorage.getItem(KEY));}catch{}
if(!state||!Array.isArray(state.order)||!Array.isArray(state.events))state=fresh();
state.answers??={};
state.planned??=state.order.length;
let walkthroughStep=0, walkthroughTimer=null;
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const current=()=>trials.find(t=>t.trial_id===state.order[state.index]);
let syncing=false, lastError='', onlineHealth='not checked';

function setStatus(message,isError=false){const element=document.querySelector('#sync');if(element){element.textContent=message;element.classList.toggle('error-text',isError);}}
function queued(){return state.events.length;}
async function flush(){
 if(syncing||!queued())return;
 syncing=true;
 const batch=state.events.slice(0,20);
 try{
  const response=await fetch('/api/trials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch})});
  if(!response.ok){let detail={};try{detail=await response.json();}catch{}throw Error((detail.code||'HTTP_'+response.status)+(detail.hint?': '+detail.hint:''));}
  const ids=new Set(batch.map(item=>item.event_id));
  state.events=state.events.filter(item=>!ids.has(item.event_id));
  lastError='';save();setStatus(queued()?queued()+' responses pending':'All responses saved');
 }catch(error){lastError=error.message||'Could not reach results storage';setStatus(queued()+' responses pending · '+lastError,true);}
 finally{syncing=false;if(queued()>batch.length&&lastError==='')flush();}
}
function emit(event_type,payload,trial_id=null){
 state.events.push({event_id:id(),study_id:STUDY,session_id:state.id,event_type,trial_id,condition:state.condition,occurred_at:new Date().toISOString(),payload});
 save();flush();
}
async function health(){
 setStatus('Checking database connection…');
 try{const response=await fetch('/api/trials?health=1',{cache:'no-store'});const info=await response.json();
  onlineHealth=info.ok?'ready':info.code||info.storage||'unavailable';
  if(!response.ok)throw Error((info.code||info.storage||'Connection failed')+(info.hint?': '+info.hint:'')+(info.missing_environment?.length?': '+info.missing_environment.join(', '):''));
  setStatus('Database connected'+(queued()?' · '+queued()+' pending':''));
  if(queued())flush();
 }catch(error){onlineHealth='unavailable';setStatus('Database check failed: '+error.message,true);}
}
function button(label,action,cls='primary'){return '<button type="button" class="'+cls+'" data-action="'+action+'">'+label+'</button>';}
function shell(view,html){
 if(walkthroughTimer){clearInterval(walkthroughTimer);walkthroughTimer=null;}
 root.innerHTML='<div class="wrap"><header><a href="#" data-action="home" class="brand">◧ context<span>.</span>lab</a><span class="tag">RESEARCH STUDY</span><span>'+escapeHTML(view)+'</span></header><main>'+html+'</main><footer><span>Context Lab · HAI research</span><div class="storage"><span id="sync" aria-live="polite">'+(queued()?queued()+' responses pending':'Check storage status')+'</span>'+button('Check storage','health','link-button')+' '+(queued()?button('Retry upload','retry','link-button'):'')+'</div><span>Version 3.1</span></footer></div>';
 root.querySelectorAll('[data-action]').forEach(element=>element.addEventListener('click',event=>{event.preventDefault();actions[element.dataset.action]?.();}));
 if(lastError)setStatus(queued()+' pending · '+lastError,true);
}
function welcome(){
 const assisted=CONDITION==='assisted';
 const intro=assisted
  ? 'This version uses AI to shield some sensitive content and may show an AI explanation after you make your own hatefulness judgment.'
  : 'This version shows original meme images and text without blurring, caption softening, or AI-generated evaluation feedback.';
 const risk=assisted
  ? 'AI filtering is imperfect. Some examples may still contain triggering imagery, hateful language, violence or other disturbing material, even if no warning appears.'
  : 'Unfiltered-content warning: This version deliberately shows original, unblurred memes. Examples may contain slurs, violent imagery, abuse, discrimination, sexual material or other potentially distressing content. You may skip an item or stop at any time.';
 shell('About the study · '+(assisted?'AI-assisted':'Independent'),`<section class="hero purpose-page"><p class="eyebrow">HUMANS + AI · MEME UNDERSTANDING</p><h1>Help AI understand <em>what memes really mean.</em></h1><p class="lead">Memes can communicate sarcasm, stereotypes and subtle hate that AI may miss. Your independent judgments will help researchers evaluate how AI handles those nuances.</p><div class="purpose-flow"><div class="purpose-card"><div class="purpose-icon">◉</div><strong>Human interpretation</strong><p>Judge whether a meme is hateful, and share whether the content felt triggering to you.</p></div><div class="purpose-arrow" aria-hidden="true">→</div><div class="purpose-card"><div class="purpose-icon">✧</div><strong>Better evaluations</strong><p>Human feedback highlights nuanced examples that AI needs to interpret more accurately.</p></div></div><div class="independence"><p class="eyebrow">TWO INDEPENDENT DIMENSIONS</p><h2>Hateful ≠ triggering</h2><p>A meme can be hateful without personally upsetting you, distressing without targeting a group, both, or neither. The two judgments are separate.</p><div class="quadrant"><div><b>Hateful + triggering</b><small>Both apply</small></div><div><b>Hateful + not triggering</b><small>Hate does not always feel personally distressing</small></div><div><b>Not hateful + triggering</b><small>Distressing is not necessarily hateful</small></div><div><b>Neither</b><small>Neither category applies</small></div></div></div><div class="guard-summary"><span class="purpose-icon">`+(assisted?'◈':'◉')+`</span><div><strong>`+(assisted?'AI-assisted evaluation + safety shield':'Independent evaluation · original content')+`</strong><p>`+escapeHTML(intro)+`</p></div></div><div class="notice"><strong>`+(assisted?'Content warning — AI protection is imperfect':'Content warning — no filtering in this version')+`</strong><p>`+escapeHTML(risk)+`</p></div><label class="consent"><input id="consent" type="checkbox"> I am at least 18, understand the study purpose and the content risks of this version, and voluntarily agree to participate.</label><p>`+button('Continue to practice walkthrough →','guide')+`</p></section>`);
}
function guide(){
 const steps=CONDITION==='assisted'?[
  ['Review the meme','Read the image and caption. When the AI shield flags a potential trigger, you may leave the image blurred or reveal it by choice.','◈','Sensitive content shield'],
  ['Judge hate, not just offensiveness','Choose whether the meme expresses hate toward an identity group. Look for sarcasm, implication, and contextual clues.','◎','Hateful? Yes / No'],
  ['Report sensitivity separately','Vote whether the example felt potentially triggering or distressing to you, regardless of what the AI flag says.','◇','Triggering? Yes / No'],
  ['Add confidence and context','Choose confidence from 1–5 and optionally describe why you interpreted the meme that way.','◴','Confidence 1 — 5'],
  ['Review an AI disagreement','Only if your hate judgment differs from the AI prediction, read its explanation and decide whether it changes your mind.','≠','Keep judgment / Change it']
 ]:[
  ['Review the original meme','No image blur, caption replacement, or AI filtering is used in this version. Some content may be distressing.','◉','Original content'],
  ['Classify hatefulness','Independently decide whether the meme expresses hate toward an identity group.','◎','Hateful? Yes / No'],
  ['Vote on sensitivity','Tell us whether the meme felt triggering, separately from your hateful-content classification.','◇','Triggering? Yes / No'],
  ['Share your viewing preference','Would you have preferred not to see it? If yes, specify imagery, text, or both.','◈','Avoid seeing? Why?'],
  ['Add context','Choose confidence and optionally explain your judgment. No AI prediction or reasoning appears.','◴','Confidence 1 — 5']
 ];
 const n=Math.min(steps.length-1,Math.max(0,walkthroughStep));const step=steps[n];
 const controls=steps.map((s,i)=>'<button type="button" data-guide-step="'+i+'" class="demo-dot '+(i===n?'active':'')+'" aria-label="View step '+(i+1)+'" aria-current="'+(i===n?'step':'false')+'"></button>').join('');
 shell('Practice + setup',`<section class="guide-page"><p class="eyebrow">PRACTICE BEFORE YOU START</p><h1>Here's how a <em>task trial works.</em></h1><p class="lead">This animated walkthrough uses only a harmless illustrative example—not a real study item.</p><div class="walkthrough"><div class="demo-visual" aria-label="Illustrative example"><div class="demo-toolbar"><span>DEMO MEME</span><span>ILLUSTRATION ONLY</span></div><div class="demo-art"><div class="demo-bubble">☁️</div><strong>When the meeting could have been an email…</strong><p>…but we all showed up anyway.</p></div><div class="demo-highlight"><span>`+escapeHTML(step[2])+`</span><b>`+escapeHTML(step[3])+`</b></div></div><div class="demo-explain" aria-live="polite"><span class="demo-count">STEP `+(n+1)+` OF `+steps.length+`</span><h2>`+escapeHTML(step[0])+`</h2><p>`+escapeHTML(step[1])+`</p><div class="demo-dots">`+controls+`</div><div class="demo-controls">`+button('← Previous','demo-prev','secondary')+button('Next step →','demo-next','secondary')+button('Replay','demo-replay','link-button')+`</div></div></div><div class="setup-card"><div><p class="eyebrow">CHOOSE YOUR SESSION LENGTH</p><h2>How many memes would you like to evaluate today?</h2><p class="muted">Choose 1–30 trials. You may still stop or skip individual items. This website uses a fixed evaluation workflow.</p></div><div class="number-config"><button type="button" data-count-change="-1" aria-label="One fewer trial">−</button><input type="number" id="trial-count" min="1" max="30" step="1" value="`+state.planned+`" aria-label="Number of task trials"><button type="button" data-count-change="1" aria-label="One more trial">+</button></div></div><div class="notice"><strong>`+(CONDITION==='assisted'?'AI guard is not a guarantee':'Original content is shown without filtering')+`</strong><p>`+escapeHTML(CONDITION==='assisted'?'AI may miss sensitive content. You may skip any item and leave shielded images blurred.':'You may encounter disturbing original images or words. Nothing is blurred or euphemized in this version. You may skip items or stop participating.')+`</p></div><div class="guide-actions">`+button('← Back','back-to-purpose','secondary')+button('Start my trials →','begin')+`</div><p id="guide-error" class="error" role="alert"></p></section>`);
 const countInput=document.querySelector('#trial-count');
 const saveCount=()=>{const count=Number(countInput.value);if(Number.isInteger(count)&&count>=1&&count<=MAX_COUNT){state.planned=count;save();document.querySelector('#guide-error').textContent='';}};
 countInput.addEventListener('change',saveCount);
 countInput.addEventListener('input',()=>{const n=Number(countInput.value);if(Number.isInteger(n)&&n>=1&&n<=MAX_COUNT){state.planned=n;save();}});
 document.querySelectorAll('[data-count-change]').forEach(el=>el.addEventListener('click',()=>{countInput.value=String(Math.min(MAX_COUNT,Math.max(1,(Number(countInput.value)||DEFAULT_COUNT)+Number(el.dataset.countChange))));saveCount();}));
 document.querySelectorAll('[data-guide-step]').forEach(el=>el.addEventListener('click',()=>{walkthroughStep=Number(el.dataset.guideStep);guide();}));
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) walkthroughTimer=setInterval(()=>{if(state.stage==='guide'&&document.activeElement?.id!=='trial-count'){walkthroughStep=(walkthroughStep+1)%steps.length;guide();}},6000);
}
function task(){
 const item=current();
 if(!item){state.stage='done';save();finish();return;}
 const answer=state.answers[item.trial_id]||{};
 const shielded=CONDITION==='assisted'&&item.ai_trigger_flag===true;
 const revealedImage=answer.revealedImage===true;
 const revealedText=answer.revealedText===true;
 const displayCaption=shielded&&!revealedText?(item.ai_euphemized_caption||'[Caption withheld: potentially distressing language]'):item.meme_text;
 const notice=shielded?'<div class="trigger"><div class="eyebrow">✧ '+(CONDITION==='assisted'?'AI CONTENT SHIELD ACTIVE':'CONTENT SAFETY FILTER')+'</div><p><strong>'+escapeHTML(CONDITION==='assisted'?(item.ai_trigger_notice||'Potentially distressing content detected.'):'This sample may contain sensitive material.')+'</strong></p>'+(CONDITION==='assisted'&&item.ai_trigger_categories?.length?'<div class="chips">'+item.ai_trigger_categories.map(cat=>'<span>'+escapeHTML(cat)+'</span>').join('')+'</div>':'')+'<p class="muted">The original image is obscured, and the caption may be softened. This protection can miss some sensitive material.</p></div>':'';
 const image='<div class="meme '+(shielded&&!revealedImage?'blurred':'')+'"><img src="'+escapeHTML(item.image_url)+'" alt="Meme under evaluation" referrerpolicy="no-referrer"><p class="muted">If this image fails to load, you may skip the item.</p>'+(shielded&&!revealedImage?'<div class="shield-overlay"><strong>Image blurred</strong><span>Possible distressing content</span>'+button('Reveal original image','reveal-image','reveal')+'</div>':'')+'</div>';
 const caption='<div class="caption"><small>'+(shielded&&!revealedText?'SOFTENED CAPTION':'ORIGINAL CAPTION')+'</small><p>'+escapeHTML(displayCaption)+'</p>'+(shielded&&!revealedText?button('Show original caption','reveal-text','link-button'):'')+'</div>';
 const sensitivityQuestion=CONDITION==='assisted'
 ? '<div class="trigger-question"><h2>Was this example triggering or distressing to you?</h2><p class="muted">Your personal assessment, independent of the AI trigger flag. Answer based on what you saw, including any shielding.</p><div class="choices trigger-choices"><button class="choice '+(answer.triggering===1?'chosen':'')+'" data-triggering="1"><b>Yes, potentially triggering</b><small>Disturbing, upsetting or sensitive</small></button><button class="choice '+(answer.triggering===0?'chosen':'')+'" data-triggering="0"><b>No, not triggering to me</b><small>I did not find it distressing</small></button></div></div>'
 : '<div class="trigger-question"><h2>Was this meme triggering or distressing to you?</h2><p class="muted">This is your personal experience, separate from whether the meme is hateful.</p><div class="choices trigger-choices"><button class="choice '+(answer.triggering===1?'chosen':'')+'" data-triggering="1"><b>Yes, triggering</b><small>Disturbing or upsetting to me</small></button><button class="choice '+(answer.triggering===0?'chosen':'')+'" data-triggering="0"><b>No, not triggering</b><small>Not distressing to me</small></button></div><h2>Would you have preferred not being shown this meme?</h2><p class="muted">You can prefer not to see content whether or not you felt triggered by it.</p><div class="choices trigger-choices"><button class="choice '+(answer.avoid_preference===1?'chosen':'')+'" data-avoid="1"><b>Yes, I would rather not have seen it</b></button><button class="choice '+(answer.avoid_preference===0?'chosen':'')+'" data-avoid="0"><b>No, I was okay seeing it</b></button></div><div id="avoid-reason" class="avoid-reason '+(answer.avoid_preference===1?'':'hidden')+'"><h3>What made you prefer not seeing it?</h3><p class="muted">Select the main reason.</p><div class="choices trigger-choices"><button class="choice '+(answer.avoid_reason==='imagery'?'chosen':'')+'" data-avoid-reason="imagery"><b>Imagery</b><small>What the image showed</small></button><button class="choice '+(answer.avoid_reason==='text'?'chosen':'')+'" data-avoid-reason="text"><b>Text</b><small>Words or caption</small></button><button class="choice '+(answer.avoid_reason==='both'?'chosen':'')+'" data-avoid-reason="both"><b>Both</b><small>Image and wording</small></button></div></div></div>';
 shell('Question '+(state.index+1)+' / '+state.order.length,
 '<div class="study-head"><p class="eyebrow">EVALUATION IN PROGRESS</p><h1>Look closely. Think critically.</h1><p>Consider how the meme might be interpreted. You can evaluate it without revealing shielded details.</p><div class="progress"><div style="width:'+(100*state.index/state.order.length)+'%"></div></div></div>'+
 '<div class="grid"><section class="panel"><p class="eyebrow">CONTENT TO REVIEW</p>'+notice+image+caption+'</section><section class="panel"><p class="eyebrow">YOUR EVALUATION</p><h2>Does this meme convey hateful content?</h2><p class="muted">Does the content demean, attack, or promote hostility toward an identity group?</p><div class="choices"><button class="choice '+(answer.label===1?'chosen':'')+'" data-choice="1"><b>Yes, hateful</b><small>Targets or demeans an identity group</small></button><button class="choice '+(answer.label===0?'chosen':'')+'" data-choice="0"><b>No, not hateful</b><small>No apparent identity-based hostility</small></button></div>'+sensitivityQuestion+'<h3>How confident are you?</h3><div class="slider-label"><span>Not confident</span><strong id="conf-value">'+(answer.confidence?answer.confidence+' / 5':'Not selected')+'</strong><span>Very confident</span></div><input id="confidence" type="range" min="1" max="5" value="'+(answer.confidence||3)+'"><div class="slider-label"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><h3>Why did you choose this answer? <small>Optional</small></h3><textarea id="reason" maxlength="1500" rows="4" placeholder="Describe context, cues or uncertainty…">'+escapeHTML(answer.reason||'')+'</textarea><div class="actions"><button class="skip" data-action="skip">Skip hateful judgment</button>'+button(state.index===state.order.length-1?'Finish evaluation →':'Save & continue →','next')+'</div><p class="error" id="error" role="alert"></p></section></div>');
 document.querySelectorAll('[data-choice]').forEach(element=>element.addEventListener('click',()=>{answer.label=Number(element.dataset.choice);state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-choice]').forEach(x=>x.classList.toggle('chosen',x===element));}));
 document.querySelectorAll('[data-triggering]').forEach(element=>element.addEventListener('click',()=>{answer.triggering=Number(element.dataset.triggering);state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-triggering]').forEach(x=>x.classList.toggle('chosen',x===element));}));
 document.querySelectorAll('[data-avoid]').forEach(element=>element.addEventListener('click',()=>{answer.avoid_preference=Number(element.dataset.avoid);state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-avoid]').forEach(x=>x.classList.toggle('chosen',x===element));const reason=document.querySelector('#avoid-reason');if(reason)reason.classList.toggle('hidden',answer.avoid_preference!==1);}));
 document.querySelectorAll('[data-avoid-reason]').forEach(element=>element.addEventListener('click',()=>{answer.avoid_reason=element.dataset.avoidReason;state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-avoid-reason]').forEach(x=>x.classList.toggle('chosen',x===element));}));
 document.querySelector('#confidence').addEventListener('input',event=>{answer.confidence=Number(event.target.value);state.answers[item.trial_id]=answer;save();document.querySelector('#conf-value').textContent=answer.confidence+' / 5';});
 document.querySelector('#reason').addEventListener('input',event=>{answer.reason=event.target.value;state.answers[item.trial_id]=answer;save();});
 if(queued()&&!lastError)flush();
}
function reveal(kind){
 const item=current();if(!item||CONDITION!=='assisted'||!item.ai_trigger_flag)return;
 const answer=state.answers[item.trial_id]||{};
 answer[kind==='image'?'revealedImage':'revealedText']=true;
 state.answers[item.trial_id]=answer;save();
 // Do not add new event types: record reveal actions in response payload.
 task();
}
function submit(skipped){
 const item=current(), answer=state.answers[item.trial_id]||{};
 const error=document.querySelector('#error');
 if(![0,1].includes(answer.triggering)){error.textContent='Please vote whether this example felt triggering before continuing.';return;}
 if(CONDITION==='independent'&&![0,1].includes(answer.avoid_preference)){error.textContent='Please answer whether you would have preferred not to see this sample.';return;}
 if(CONDITION==='independent'&&answer.avoid_preference===1&&!['imagery','text','both'].includes(answer.avoid_reason)){error.textContent='Please select imagery, text, or both as the reason you would rather not have seen this meme.';return;}
 if(!skipped&&(![0,1].includes(answer.label)||!answer.confidence)){error.textContent='Select a hateful-content classification and adjust the confidence slider, or skip that judgment.';return;}
 answer.skipped=Boolean(skipped);
 answer.initialLabel=skipped?null:answer.label;
 answer.initialConfidence=skipped?null:answer.confidence;
 state.answers[item.trial_id]=answer;
 const disagreement=CONDITION==='assisted'&&!skipped&&[0,1].includes(item.ai_hateful_prediction)&&answer.initialLabel!==item.ai_hateful_prediction;
 if(disagreement){state.stage='review';save();render();return;}
 completeResponse({review_response:null,review_shown:false,final_label:answer.initialLabel});
}
function review(){
 const item=current(), answer=state.answers[item.trial_id]||{};
 if(!item||CONDITION!=='assisted'||answer.skipped||answer.initialLabel===item.ai_hateful_prediction){state.stage='task';save();render();return;}
 const participant=answer.initialLabel===1?'Hateful':'Not hateful';
 const ai=item.ai_hateful_prediction===1?'Hateful':'Not hateful';
 shell('AI disagreement · '+(state.index+1)+' / '+state.order.length,
 '<section class="review-page"><p class="eyebrow">SECOND-LOOK REVIEW · AFTER YOUR FIRST RESPONSE</p><h1>You and the AI <em>disagree.</em></h1><p class="lead">Your original judgment has been recorded. Read the AI explanation, then decide whether it changes your mind. The AI can be wrong, particularly about sarcasm and context.</p><div class="comparison"><div class="comparison-card"><small>YOUR INITIAL JUDGMENT</small><strong>'+escapeHTML(participant)+'</strong></div><div class="comparison-card ai-comparison"><small>AI MODEL PREDICTION</small><strong>'+escapeHTML(ai)+'</strong></div></div><div class="ai-reason"><p class="eyebrow">WHY THE MODEL REACHED ITS ANSWER</p><p>'+escapeHTML(item.ai_explanation||'No explanation available for this prediction.')+'</p><p class="muted">This is the model’s interpretation, not a verified fact. It may itself contain references to sensitive material.</p></div><h2>After reading the reasoning, what do you think?</h2><div class="review-options">'+button('AI seems correct — change my answer','agree-ai','primary')+button('AI seems wrong — keep my answer','reject-ai','secondary')+'</div><p class="muted">Your initial response and this second-look decision will both be stored for research. The model’s answer was not shown before you made your first judgment.</p></section>');
}
function completeResponse({review_response,review_shown,final_label}){
 const item=current(),answer=state.answers[item.trial_id]||{};
 if(!item)return;
 const initial=answer.skipped?null:answer.initialLabel;
 const disagree=CONDITION==='assisted'&&initial!==null&&[0,1].includes(item.ai_hateful_prediction)&&initial!==item.ai_hateful_prediction;
 if(disagree&&review_response===null)return;
 emit('response',{
  item_index:state.index,
  classification:initial,
  initial_classification:initial,
  final_classification:final_label,
  confidence:answer.skipped?null:answer.initialConfidence,
  triggering_vote:answer.triggering,
  preferred_not_shown:CONDITION==='independent'?answer.avoid_preference:null,
  preferred_not_shown_reason:CONDITION==='independent'&&answer.avoid_preference===1?answer.avoid_reason:null,
  website_variant:CONDITION,
  ai_trigger_detected:CONDITION==='assisted'?item.ai_trigger_flag===true:null,
  ai_hateful_prediction:CONDITION==='assisted'?item.ai_hateful_prediction:null,
  ai_disagreement:disagree,
  ai_reasoning_presented:review_shown,
  ai_reasoning_verdict:review_response,
  participant_changed_answer:review_response==='ai_correct_changed',
  reason:answer.skipped?'':(answer.reason||''),
  skipped:answer.skipped===true,
  elapsed_ms:Math.max(0,Date.now()-(state.opened||Date.now())),
  image_initially_blurred:CONDITION==='assisted'&&item.ai_trigger_flag===true,
  caption_euphemized:CONDITION==='assisted'&&item.ai_trigger_flag===true,
  image_revealed:answer.revealedImage===true,
  caption_revealed:answer.revealedText===true
 },item.trial_id);
 state.index++;state.opened=Date.now();state.stage=state.index>=state.order.length?'done':'task';save();
 if(state.stage==='done')emit('finish',{completed_items:state.index,planned_items:state.order.length,submitted_answers:state.index,elapsed_ms:Date.now()-(state.started||Date.now()),study_version:'3.1.0',website_variant:CONDITION});
 render();
}
function finish(){
 shell('Study finished','<div class="finish"><div class="check">✓</div><p class="eyebrow">STUDY COMPLETED</p><h1>Thank you for your <em>perspective.</em></h1><p>Your feedback supports research into safer ways to engage with potentially distressing visual content.</p><div class="receipt"><div><small>SESSION REFERENCE</small><b>'+escapeHTML(state.id.slice(0,8).toUpperCase())+'</b></div><div><small>ITEMS REVIEWED</small><b>'+state.index+' / '+state.order.length+'</b></div><div><small>STUDY CONDITION</small><b>'+(CONDITION==='assisted'?'AI-assisted + filtered':'No AI assistance · original content')+'</b></div></div><p class="muted" id="done-note">'+(queued()?'Some results still need uploading. Please check storage status below.':'Responses have been submitted to the configured server when connected.')+'</p>'+button('Begin a new session','restart')+'</div>');
}
const actions={
 home:render,health,retry:()=>{lastError='';flush();},
 guide:()=>{
  if(!document.querySelector('#consent')?.checked){document.querySelector('#consent')?.focus();return;}
  state.consented=true;state.stage='guide';walkthroughStep=0;save();render();
 },
 'back-to-purpose':()=>{state.stage='welcome';save();render();},
 'demo-next':()=>{walkthroughStep=(walkthroughStep+1)%5;guide();},
 'demo-prev':()=>{walkthroughStep=(walkthroughStep+4)%5;guide();},
 'demo-replay':()=>{walkthroughStep=0;guide();},
 begin:()=>{
  const field=document.querySelector('#trial-count');
  const value=Number(field?.value);
  if(!state.consented){state.stage='welcome';save();render();return;}
  if(!Number.isInteger(value)||value<1||value>MAX_COUNT){document.querySelector('#guide-error').textContent='Enter a whole number of trials between 1 and 30.';return;}
  state.planned=value;state.order=state.order.slice(0,value);
  state.stage='task';state.started=Date.now();state.opened=Date.now();save();
  emit('start',{planned_items:value,consented:true,study_version:'3.1.0',content_shield:CONDITION==='assisted',website_variant:CONDITION});
  render();
 },
 next:()=>submit(false),skip:()=>submit(true),
 'agree-ai':()=>completeResponse({review_response:'ai_correct_changed',review_shown:true,final_label:current()?.ai_hateful_prediction??null}),
 'reject-ai':()=>completeResponse({review_response:'ai_wrong_kept',review_shown:true,final_label:state.answers[current()?.trial_id]?.initialLabel??null}),
 'reveal-image':()=>reveal('image'),'reveal-text':()=>reveal('text'),
 restart:()=>{if(queued()){alert('Some responses are still pending upload. Please retry uploading before starting another session.');return;}if(!confirm('Begin a new anonymous session?'))return;state=fresh();walkthroughStep=0;save();render();}
};
function render(){
 if(state.stage==='task')task();
 else if(state.stage==='review')review();
 else if(state.stage==='guide')guide();
 else if(state.stage==='done')finish();
 else welcome();
}
window.addEventListener('online',()=>{health();flush();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)flush();});
save();render();health();
