import './style.css';
import trials from './data/trials.json';

const root=document.getElementById('app');
const CONDITION=location.pathname.startsWith('/independent')?'independent':'assisted';
const KEY='hai-task-trial-v5-'+CONDITION, STUDY='hai-meme-evaluation-v1', DEFAULT_COUNT=12, MAX_COUNT=12;
const id=()=>crypto.randomUUID();
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const randomized=list=>{const values=[...list];for(let i=values.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values;};
const sharedItemsForUniqname=(name)=>{let seed=2166136261;for(const char of ('cse594-v4:'+name.trim().toLowerCase())){seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;}const next=()=>{seed+=0x6D2B79F5;let x=seed;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};const set=[...trials];for(let i=set.length-1;i>0;i--){let j=Math.floor(next()*(i+1));[set[i],set[j]]=[set[j],set[i]];}return set.map(x=>x.trial_id);};
const fresh=()=>({id:id(),condition:CONDITION,order:randomized(trials).slice(0,MAX_COUNT).map(t=>t.trial_id),planned:DEFAULT_COUNT,index:0,stage:'welcome',consented:false,uniqname:'',answers:{},events:[],started:null,opened:null,sessionVersion:5,practiceIndex:0,practicePassed:[false,false,false],practiceSelected:null,practiceRevealed:false,attentionDone:{hate:false,not_hate:false},attentionAttempts:{hate:0,not_hate:0},attentionCheck:null,surveyStep:0,surveyAnswers:{},surveyCompleted:false});
let state;try{state=JSON.parse(localStorage.getItem(KEY));}catch{}
if(!state||!Array.isArray(state.order)||!Array.isArray(state.events))state=fresh();
state.answers??={};
state.uniqname??='';
state.practiceIndex??=0;
state.practicePassed??=[false,false,false];
state.practiceSelected??=null;
state.practiceRevealed??=false;
state.attentionDone??={hate:false,not_hate:false};
state.attentionAttempts??={hate:0,not_hate:0};
state.attentionCheck??=null;
state.surveyStep??=0;
state.surveyAnswers??={};
state.surveyCompleted??=false;
state.planned??=state.order.length;
let walkthroughStep=0;
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
 root.innerHTML='<div class="wrap"><header><span class="course-header">CSE 594 <span class="course-subtitle">Class Assignment</span></span><span class="tag">HUMAN–AI INTERACTION STUDY</span><span>'+escapeHTML(view)+'</span></header><main>'+html+'</main><footer><span>CSE 594 · Class Assignment</span><div class="storage"><span id="sync" aria-live="polite">'+(queued()?queued()+' responses pending':'Check storage status')+'</span>'+button('Check storage','health','link-button')+' '+(queued()?button('Retry upload','retry','link-button'):'')+'</div><span>Version 5.0</span></footer></div>';
 root.querySelectorAll('[data-action]').forEach(element=>element.addEventListener('click',event=>{event.preventDefault();actions[element.dataset.action]?.();}));
 if(lastError)setStatus(queued()+' pending · '+lastError,true);
}
function welcome(){
 const assisted=CONDITION==='assisted';
 const warning=assisted
  ? 'AI may blur or soften potentially distressing material, but it can miss sensitive content. You can skip any example or leave at any time.'
  : 'This version displays unfiltered original memes, which may contain hateful language, violent imagery, or other distressing material. You can skip any example or leave at any time.';
 shell('Introduction · '+(assisted?'AI assisted':'Without AI'),
 '<section class="hero welcome-simple"><p class="eyebrow">CSE 594 CLASS ASSIGNMENT · VOLUNTARY STUDY</p><h1>Help improve <em>hateful meme detection.</em></h1>'+
 '<p class="lead">Memes rely on sarcasm and context that AI can miss. We compare human judgments with and without AI assistance to learn what helps—and what can harm—human evaluators.</p>'+
 '<div class="intro-key"><strong>Two separate questions:</strong> Is this meme hateful? Did it feel triggering or distressing? A meme can be one, both, or neither.</div>'+
 '<div class="intro-key">'+(assisted?'<strong>AI-assisted version:</strong> AI may shield sensitive material and offer reasoning after you disagree.':'<strong>Without-AI version:</strong> Original memes are shown without filtering or AI feedback.')+'</div>'+
 '<div class="notice"><strong>Content advisory</strong><p>'+escapeHTML(warning)+'</p></div>'+
 '<div class="uniqname-card"><label for="uniqname" class="uniqname-label">University of Michigan uniqname <span class="optional-label">Optional</span></label><input id="uniqname" name="uniqname" type="text" maxlength="32" autocomplete="off" spellcheck="false" placeholder="e.g., youruniqname" value="'+escapeHTML(state.uniqname||'')+'"><p class="muted">You may leave this blank. If provided, your uniqname makes the session identifiable and can match your two study conditions.</p><p id="uniqname-error" class="error" role="alert"></p></div>'+
 '<label class="consent"><input id="consent" type="checkbox"> I am at least 18 and voluntarily consent after reading this content advisory.</label>'+
 '<p>'+button('Continue to three practice examples →','guide')+'</p></section>');
}
const PRACTICE=[
 {name:'A plainly hateful stereotype',caption:'Girls do not belong in science labs.',safeCaption:'A person states that girls should be excluded from scientific work.',label:1,explanation:'Correct: the text excludes people from an opportunity because of gender. It is identity-based hostility, without requiring a slur.',symbol:'👩‍🔬',kind:'hateful'},
 {name:'An everyday harmless joke',caption:'When the meeting could have been an email… but you brought snacks anyway.',safeCaption:'A joke about a long meeting.',label:0,explanation:'Correct: the joke is about meetings. It does not attack an identity group.',symbol:'✉️',kind:'benign'},
 {name:'Strong imagery/language, but not hate',caption:'WHAT THE HELL?! Fake horror-movie blood is everywhere!',safeCaption:'A surprised actor reacts to a messy pretend-horror effect.',label:0,explanation:'Correct: pretend blood and mild profanity can be sensitive, but they do not make a meme hateful toward an identity group.',symbol:'🎭',kind:'sensitive'}
];
function guide(){
 const i=Math.min(2,Math.max(0,state.practiceIndex)), sample=PRACTICE[i], isAssisted=CONDITION==='assisted';
 const shield=i===2&&isAssisted&&!state.practiceRevealed;
 const allDone=state.practicePassed.every(Boolean);
 const feedback=state.practiceSelected===null?'':(state.practiceSelected===sample.label?'correct':'incorrect');
 const explanation=feedback==='correct'?sample.explanation:'Not quite. Consider whether this meme targets an identity group. Try again.';
 const caption=shield?sample.safeCaption:sample.caption;
 const art='<div class="practice-art '+sample.kind+(shield?' practice-blurred':'')+'" role="img" aria-label="Illustrative example, not a study item"><div class="practice-symbol">'+sample.symbol+'</div><div class="practice-art-caption">'+escapeHTML(sample.caption)+'</div></div>';
 const demo='<div class="practice-frame"><div class="practice-frame-head"><span>EXAMPLE '+(i+1)+' OF 3</span><span>NOT A REAL STUDY ITEM</span></div>'+art+(shield?'<div class="practice-shield"><strong>AI safety shield active</strong><p>Illustrative horror imagery and language were softened. You can still classify this as hateful or non-hateful.</p>'+button('Reveal this practice example','practice-reveal','secondary')+'</div>':'')+'<div class="practice-soft-caption">'+(shield?'<small>SOFTENED TEXT</small>':'<small>MEME CAPTION</small>')+'<p>'+escapeHTML(caption)+'</p></div></div>';
 const choices='<div class="practice-answers"><button type="button" data-practice="1" class="choice '+(state.practiceSelected===1?'chosen':'')+'"><b>Hateful</b></button><button type="button" data-practice="0" class="choice '+(state.practiceSelected===0?'chosen':'')+'"><b>Not hateful</b></button></div>';
 const nav='<div class="practice-navigation">'+(i>0?button('← Previous example','practice-prev','secondary'):'<span></span>')+(state.practicePassed[i]&&i<2?button('Next example →','practice-next','primary'):i===2&&allDone?'<strong class="practice-done">All 3 examples completed ✓</strong>':'<small>Answer correctly to unlock the next example</small>')+'</div>';
 shell('Practice · '+(i+1)+' of 3',
 '<section class="guide-page compact-guide"><p class="eyebrow">THREE QUICK PRACTICE EXAMPLES</p><h1>Is it <em>hateful</em> or not?</h1><p class="lead">Classify each safe illustration, receive feedback, then move on. Hatefulness and disturbing content are different things.</p>'+
 '<div class="practice-main">'+demo+'<div class="practice-explain"><span class="demo-count">EXAMPLE '+(i+1)+' / 3</span><h2>'+escapeHTML(sample.name)+'</h2><p>Look at the meme, then select an answer below.</p>'+choices+(feedback?'<div class="practice-feedback '+feedback+'" role="status"><b>'+(feedback==='correct'?'✓ Correct answer':'Try again')+'</b><p>'+escapeHTML(explanation)+'</p></div>':'')+nav+'</div></div>'+
 '<div class="setup-card"><div><p class="eyebrow">SESSION LENGTH</p><h2>How many memes would you like to evaluate?</h2><p class="muted">Choose 1–12 items (12 by default). There will also be two brief attention checks and a post-study survey. You may skip study examples.</p></div><div class="number-config"><button type="button" data-count-change="-1" aria-label="One fewer trial">−</button><input type="number" id="trial-count" min="1" max="12" step="1" value="'+state.planned+'" aria-label="Number of task trials"><button type="button" data-count-change="1" aria-label="One more trial">+</button></div></div>'+
 '<div class="guide-actions">'+button('← Back to introduction','back-to-purpose','secondary')+(allDone?button('Start study →','begin','primary'):'<span class="muted">Complete all three examples to start the study.</span>')+'</div><p id="guide-error" class="error" role="alert"></p></section>');
 const countInput=document.querySelector('#trial-count');
 const saveCount=()=>{const val=Number(countInput.value);if(Number.isInteger(val)&&val>=1&&val<=MAX_COUNT){state.planned=val;save();document.querySelector('#guide-error').textContent='';}};
 countInput.addEventListener('change',saveCount);
 document.querySelectorAll('[data-count-change]').forEach(el=>el.addEventListener('click',()=>{countInput.value=String(Math.min(MAX_COUNT,Math.max(1,(Number(countInput.value)||DEFAULT_COUNT)+Number(el.dataset.countChange))));saveCount();}));
 document.querySelectorAll('[data-practice]').forEach(el=>el.addEventListener('click',()=>{state.practiceSelected=Number(el.dataset.practice);if(state.practiceSelected===sample.label)state.practicePassed[i]=true;save();guide();}));
}

function task(){
 const item=current();
 if(!item){state.stage='survey';state.surveyStep=0;save();survey();return;}
 const answer=state.answers[item.trial_id]||{};
 const reviewing=state.stage==='review';
 const shielded=CONDITION==='assisted'&&item.ai_trigger_flag===true;
 const revealedImage=answer.revealedImage===true, revealedText=answer.revealedText===true;
 const displayCaption=shielded&&!revealedText?(item.ai_euphemized_caption||'[Caption withheld: potentially distressing language]'):item.meme_text;
 const notice=shielded?'<div class="trigger"><div class="eyebrow">AI SAFETY SHIELD</div><p><strong>'+escapeHTML(item.ai_trigger_notice||'Potentially distressing content detected.')+'</strong></p>'+(item.ai_trigger_categories?.length?'<div class="chips">'+item.ai_trigger_categories.map(cat=>'<span>'+escapeHTML(cat)+'</span>').join('')+'</div>':'')+'<p class="muted">A safety flag is separate from a hateful-meme classification. You can leave this content shielded.</p></div>':'';
 const image='<div class="meme '+(shielded&&!revealedImage?'blurred':'')+'"><img src="'+escapeHTML(item.image_url)+'" alt="Meme under evaluation" referrerpolicy="no-referrer" loading="eager"><p class="muted">If the image does not load, you may skip the example.</p>'+(shielded&&!revealedImage?'<div class="shield-overlay"><strong>Image blurred</strong><span>Possible sensitive material</span>'+button('Reveal original image','reveal-image','reveal')+'</div>':'')+'</div>';
 const caption='<div class="caption"><small>'+(shielded&&!revealedText?'SOFTENED CAPTION':'ORIGINAL CAPTION')+'</small><p>'+escapeHTML(displayCaption)+'</p>'+(shielded&&!revealedText?button('Show original caption','reveal-text','link-button'):'')+'</div>';
 const lock=reviewing?' disabled':'';
 const hatefulChoices=[['Definitely not hateful',1],['Probably not hateful',2],['Unsure / ambiguous',3],['Probably hateful',4],['Definitely hateful',5]].map(([label,value])=>'<button type="button"'+lock+' class="choice '+(answer.hateful_likert===value?'chosen':'')+'" data-hateful-likert="'+value+'"><b>'+value+' · '+label+'</b></button>').join('');
 const triggerQuestion='<div class="trigger-question"><h2>Did this meme feel triggering to you?</h2><div class="choices trigger-choices"><button type="button"'+lock+' class="choice '+(answer.triggering===1?'chosen':'')+'" data-triggering="1"><b>Yes</b></button><button type="button"'+lock+' class="choice '+(answer.triggering===0?'chosen':'')+'" data-triggering="0"><b>No</b></button></div></div>';
 const avoidanceQuestion='<div class="trigger-question"><h2>Would you rather not have seen this meme?</h2><div class="choices trigger-choices"><button type="button"'+lock+' class="choice '+(answer.avoid_preference===1?'chosen':'')+'" data-avoid="1"><b>Yes</b></button><button type="button"'+lock+' class="choice '+(answer.avoid_preference===0?'chosen':'')+'" data-avoid="0"><b>No</b></button></div><div id="avoid-reason" class="avoid-reason '+(answer.avoid_preference===1?'':'hidden')+'"><h3>What made you prefer not to see it?</h3><div class="choices trigger-choices"><button type="button"'+lock+' class="choice '+(answer.avoid_reason==='imagery'?'chosen':'')+'" data-avoid-reason="imagery"><b>Imagery</b></button><button type="button"'+lock+' class="choice '+(answer.avoid_reason==='text'?'chosen':'')+'" data-avoid-reason="text"><b>Text</b></button><button type="button"'+lock+' class="choice '+(answer.avoid_reason==='both'?'chosen':'')+'" data-avoid-reason="both"><b>Both</b></button></div></div></div>';
 const selectedConfidence=answer.confidence??3;
 const confidenceChoices=[1,2,3,4,5].map(x=>'<button type="button"'+lock+' data-confidence="'+x+'" class="confidence-option '+(selectedConfidence===x?'chosen':'')+'" aria-label="Confidence '+x+' of 5" aria-pressed="'+(selectedConfidence===x?'true':'false')+'">'+x+'</button>').join('');
 const reason='<h3>Why did you make this choice? <small>Optional</small></h3><textarea id="reason" maxlength="1500" rows="3"'+lock+' placeholder="Sarcasm, context or other clues…">'+escapeHTML(answer.reason||'')+'</textarea>';
 let reviewPanel='';
 if(reviewing){
  const initial=answer.initialLabel===1?'Hateful':'Not hateful';
  const prediction=item.ai_hateful_prediction===1?'Hateful':'Not hateful';
  reviewPanel='<div class="inline-ai-review" role="region" aria-label="AI disagreement review"><p class="eyebrow">AI DISAGREEMENT · SECOND LOOK</p><h2>Your first judgment differs from the AI.</h2><div class="review-summary"><span><small>YOU ANSWERED</small><strong>'+initial+'</strong></span><span><small>AI PREDICTED</small><strong>'+prediction+'</strong></span></div><p class="eyebrow">AI MODEL REASONING</p><p class="ai-explanation">'+escapeHTML(item.ai_explanation||'The model did not provide a textual explanation.')+'</p><p class="muted">AI reasoning may be mistaken or include sensitive wording. Your first answer is already preserved.</p><p><strong>After reading this, do you want to change your answer?</strong></p><div class="review-options">'+button('Change to AI answer','agree-ai','primary')+button('Keep my original answer','reject-ai','secondary')+'</div></div>';
 }
 const controls=reviewing?'<p class="muted">Your answers are locked for this review. Choose one of the two buttons above to continue.</p>':'<div class="actions"><button type="button" class="skip" data-action="skip">Skip entire example</button>'+button(state.index===state.order.length-1?'Save & go to survey →':'Save & continue →','next')+'</div><p class="muted">Confidence defaults to 3. You can click any number directly, including 3.</p>';
 shell('Task '+(state.index+1)+' / '+state.order.length,
 '<div class="study-head"><p class="eyebrow">'+(reviewing?'REVIEW YOUR ANSWER':'MEME EVALUATION')+'</p><h1>Thanks for your contribution to help improve hate speech detection</h1><div class="progress"><div style="width:'+(100*state.index/state.order.length)+'%"></div></div></div>'+
 '<div class="grid"><section class="panel"><p class="eyebrow">MEME '+(state.index+1)+' OF '+state.order.length+'</p>'+notice+image+caption+'</section><section class="panel"><p class="eyebrow">'+(reviewing?'SECOND LOOK':'YOUR EVALUATION')+'</p>'+reviewPanel+'<h2>How hateful is this meme?</h2><p class="muted">Choose 1–5; a meme can be disturbing without expressing hate.</p><div class="choices hateful-choices">'+hatefulChoices+'</div>'+triggerQuestion+avoidanceQuestion+'<h3>How confident are you?</h3><p class="muted">1 = not confident · 5 = very confident</p><div class="confidence-options">'+confidenceChoices+'</div>'+reason+controls+'<p class="error" id="error" role="alert"></p></section></div>');
 if(!reviewing){
  document.querySelectorAll('[data-hateful-likert]').forEach(element=>element.addEventListener('click',()=>{answer.hateful_likert=Number(element.dataset.hatefulLikert);answer.label=answer.hateful_likert===3?null:(answer.hateful_likert>3?1:0);state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-hateful-likert]').forEach(x=>x.classList.toggle('chosen',x===element));}));
  document.querySelectorAll('[data-triggering]').forEach(element=>element.addEventListener('click',()=>{answer.triggering=Number(element.dataset.triggering);state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-triggering]').forEach(x=>x.classList.toggle('chosen',x===element));}));
  document.querySelectorAll('[data-avoid]').forEach(element=>element.addEventListener('click',()=>{answer.avoid_preference=Number(element.dataset.avoid);state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-avoid]').forEach(x=>x.classList.toggle('chosen',x===element));document.querySelector('#avoid-reason').classList.toggle('hidden',answer.avoid_preference!==1);}));
  document.querySelectorAll('[data-avoid-reason]').forEach(element=>element.addEventListener('click',()=>{answer.avoid_reason=element.dataset.avoidReason;state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-avoid-reason]').forEach(x=>x.classList.toggle('chosen',x===element));}));
  document.querySelectorAll('[data-confidence]').forEach(element=>element.addEventListener('click',()=>{answer.confidence=Number(element.dataset.confidence);answer.confidenceTouched=true;state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-confidence]').forEach(x=>{x.classList.toggle('chosen',x===element);x.setAttribute('aria-pressed',String(x===element));});}));
  document.querySelector('#reason').addEventListener('input',event=>{answer.reason=event.target.value;state.answers[item.trial_id]=answer;save();});
 }
 if(queued()&&!lastError)flush();
}
function reveal(kind){
 const item=current();if(!item||CONDITION!=='assisted'||!item.ai_trigger_flag)return;
 const answer=state.answers[item.trial_id]||{};
 answer[kind==='image'?'revealedImage':'revealedText']=true;
 state.answers[item.trial_id]=answer;save();task();
}
function submit(skipped){
 if(state.stage!=='task')return;
 const item=current(), answer=state.answers[item.trial_id]||{},error=document.querySelector('#error');
 if(!skipped){
  if(![1,2,3,4,5].includes(answer.hateful_likert)){error.textContent='Please choose a hateful-content rating, or skip the whole example.';return;}
  if(![0,1].includes(answer.triggering)){error.textContent='Please answer the triggering question, or skip the whole example.';return;}
  if(![0,1].includes(answer.avoid_preference)){error.textContent='Please answer whether you would rather not see this meme, or skip the whole example.';return;}
  if(answer.avoid_preference===1&&!['imagery','text','both'].includes(answer.avoid_reason)){error.textContent='Choose imagery, text or both, or skip the whole example.';return;}
 }
 answer.skipped=Boolean(skipped);
 answer.initialLabel=skipped?null:(answer.hateful_likert===3?null:(answer.hateful_likert>3?1:0));
 answer.initialLikert=skipped?null:answer.hateful_likert;
 answer.initialConfidence=skipped?null:(answer.confidence??3);
 state.answers[item.trial_id]=answer;
 const disagreement=CONDITION==='assisted'&&!skipped&&[0,1].includes(answer.initialLabel)&&[0,1].includes(item.ai_hateful_prediction)&&answer.initialLabel!==item.ai_hateful_prediction;
 if(disagreement){state.stage='review';save();task();return;}
 completeResponse({review_response:null,review_shown:false,final_label:answer.initialLabel});
}

function completeResponse({review_response,review_shown,final_label}){
 const item=current(),answer=state.answers[item?.trial_id]||{};
 if(!item)return;
 const initial=answer.skipped?null:answer.initialLabel;
 const disagreement=CONDITION==='assisted'&&[0,1].includes(initial)&&[0,1].includes(item.ai_hateful_prediction)&&initial!==item.ai_hateful_prediction;
 if(disagreement&&review_response===null)return;
 emit('response',{
  item_index:state.index,
  classification:initial,
  initial_classification:initial,
  initial_hateful_likert:answer.skipped?null:answer.initialLikert,
  final_classification:answer.skipped?null:final_label,
  final_hateful_likert:answer.skipped?null:(review_response==='ai_correct_changed'?(final_label===1?4:2):answer.initialLikert),
  confidence:answer.skipped?null:answer.initialConfidence,
  confidence_default_used:answer.skipped?null:answer.confidenceTouched!==true,
  triggering_vote:answer.skipped?null:answer.triggering,
  preferred_not_shown:answer.skipped?null:answer.avoid_preference,
  preferred_not_shown_reason:!answer.skipped&&answer.avoid_preference===1?answer.avoid_reason:null,
  website_variant:CONDITION,protocol_version:'5.0.0',is_attention_check:false,
  ai_trigger_detected:CONDITION==='assisted'?item.ai_trigger_flag===true:null,
  ai_hateful_prediction:CONDITION==='assisted'?item.ai_hateful_prediction:null,
  ai_disagreement:disagreement,
  ai_reasoning_presented:review_shown,
  ai_reasoning_verdict:review_response,
  participant_changed_answer:review_response==='ai_correct_changed',
  reason:answer.skipped?'':answer.reason||'',
  skipped:answer.skipped===true,skip_scope:answer.skipped===true?'entire_example':null,
  elapsed_ms:Math.max(0,Date.now()-(state.opened||Date.now())),
  image_initially_blurred:CONDITION==='assisted'&&item.ai_trigger_flag===true,
  caption_euphemized:CONDITION==='assisted'&&item.ai_trigger_flag===true,
  image_revealed:answer.revealedImage===true,
  caption_revealed:answer.revealedText===true
 },item.trial_id);
 state.index++;
 advanceAfterTrial();
}
function nextAttentionId(){
 const n=state.order.length;
 if(!state.attentionDone.hate&&state.index>=Math.max(1,Math.ceil(.30*n)))return 'hate';
 if(!state.attentionDone.not_hate&&state.index>=Math.max(1,Math.ceil(.80*n)))return 'not_hate';
 return null;
}
function advanceAfterTrial(){
 const attentionId=nextAttentionId();
 if(attentionId){state.stage='attention';state.attentionCheck=attentionId;state.attentionFeedback=null;}
 else if(state.index>=state.order.length){state.stage='survey';state.surveyStep=0;state.attentionCheck=null;}
 else {state.stage='task';state.attentionCheck=null;state.opened=Date.now();}
 save();render();
}
const CHECKS={
 hate:{trial_id:'ATTN_HATE_30',expected:1,heading:'Attention check · About 30% complete',caption:'People with disabilities should not be allowed to join our team.',reason:'This exclusion is based on disability, so the correct answer is Hateful.',symbol:'♿'},
 not_hate:{trial_id:'ATTN_NOT_HATE_80',expected:0,heading:'Attention check · About 80% complete',caption:'When the group chat finally agrees on a pizza topping.',reason:'This is a harmless joke about pizza; it does not target an identity group.',symbol:'🍕'}
};
function attention(){
 const id=state.attentionCheck||nextAttentionId();
 if(!id){advanceAfterTrial();return;}
 const check=CHECKS[id],feedback=state.attentionFeedback;
 shell('Attention check','<section class="attention-page"><p class="eyebrow">BRIEF ATTENTION CHECK · NOT PART OF YOUR RANDOM MEMES</p><h1>'+escapeHTML(check.heading)+'</h1><p class="lead">Classify this straightforward example. It is not part of the study dataset.</p><div class="attention-meme"><span class="attention-icon" aria-hidden="true">'+check.symbol+'</span><strong>'+escapeHTML(check.caption)+'</strong></div><h2>Is this example hateful?</h2><div class="attention-answers">'+button('Hateful','attention-hateful','secondary')+button('Not hateful','attention-not-hateful','secondary')+'</div>'+(feedback?'<div class="practice-feedback incorrect" role="status"><strong>Try again</strong><p>'+escapeHTML(check.reason)+'</p></div>':'')+'<p class="muted">You can correct an incorrect answer; it does not end your study session.</p></section>');
}
function answerAttention(choice){
 if(state.stage!=='attention')return;
 const id=state.attentionCheck,check=CHECKS[id];if(!check)return;
 state.attentionAttempts[id]=(state.attentionAttempts[id]||0)+1;
 const correct=choice===check.expected;
 emit('response',{
  is_attention_check:true,attention_check_id:id,attention_target:check.expected,
  attention_selected:choice,attention_passed:correct,
  attention_attempt:state.attentionAttempts[id],
  after_completed_items:state.index,
  completed_fraction:state.order.length?Number((state.index/state.order.length).toFixed(3)):null,
  protocol_version:'5.0.0'
 },check.trial_id);
 if(correct){state.attentionDone[id]=true;state.attentionFeedback=null;state.attentionCheck=null;advanceAfterTrial();}
 else {state.attentionFeedback=true;save();attention();}
}
const SURVEY_QUESTIONS=[
 {id:'q1',label:'The instructions were clear and easy to follow.'},
 {id:'q2',label:'The buttons, navigation, and layout were easy to use.'},
 {id:'q3',label:'It was difficult to decide whether individual memes were hateful.'},
 {id:'q4',label:'Sarcasm, context, or hidden meaning made some memes difficult to interpret.'},
 {id:'q5',label:'I found some of the study content personally upsetting or triggering.'},
 {id:'q6',label:'Strong or offensive language made me uncomfortable.'},
 {id:'q7',label:'Graphic or disturbing imagery made me uncomfortable.'},
 {id:'q8',label:'I would trust an AI system to help classify whether memes are hateful.'},
 {id:'q9',label:'I would want AI to blur sensitive imagery or soften words while I annotate hateful memes.'},
 {id:'q10',label:'What would you change about this interface or the use of AI? Any other suggestions?',type:'text'}
];
const SURVEY_LABELS=['Strongly disagree','Disagree','Neutral','Agree','Strongly agree'];
function survey(){
 const step=state.surveyStep||0,questions=step===0?SURVEY_QUESTIONS.slice(0,5):SURVEY_QUESTIONS.slice(5);
 const content=questions.map(q=>{
  if(q.type==='text')return '<div class="survey-question"><p class="eyebrow">10 OF 10 · OPTIONAL</p><h3>'+escapeHTML(q.label)+'</h3><textarea id="survey-q10" rows="4" maxlength="2000" placeholder="Your suggestions (optional)…">'+escapeHTML(state.surveyAnswers.q10||'')+'</textarea></div>';
  return '<fieldset class="survey-question"><legend><span class="survey-number">'+Number(q.id.slice(1))+'</span> '+escapeHTML(q.label)+'</legend><div class="survey-scale">'+SURVEY_LABELS.map((x,i)=>'<button type="button" data-survey-question="'+q.id+'" data-survey-value="'+(i+1)+'" class="survey-option '+(state.surveyAnswers[q.id]===i+1?'chosen':'')+'" aria-pressed="'+(state.surveyAnswers[q.id]===i+1?'true':'false')+'"><b>'+(i+1)+'</b><small>'+escapeHTML(x)+'</small></button>').join('')+'</div></fieldset>';
 }).join('');
 const controls='<div class="survey-nav">'+(step===1?button('← Previous questions','survey-prev','secondary'):'<span></span>')+button(step===0?'Next five questions →':'Submit survey & finish →','survey-next','primary')+'</div>';
 shell('Post-study survey · '+(step+1)+'/2','<section class="post-survey"><p class="eyebrow">POST-STUDY QUESTIONNAIRE · 10 QUESTIONS</p><h1>Tell us about your <em>experience.</em></h1><p class="lead">Rate each statement from 1 (strongly disagree) to 5 (strongly agree). Your feedback helps us evaluate usability, content sensitivity, and opinions about AI.</p><div class="survey-progress"><span class="'+(step===0?'current':'')+'">1–5 · Interface and task</span><span class="'+(step===1?'current':'')+'">6–10 · Content and AI</span></div>'+content+controls+'<p id="survey-error" class="error" role="alert"></p><p class="muted">You can '+(step===0?'continue to the second half, or ':'')+'skip this questionnaire if you prefer. Your trial responses have already been submitted.</p>'+button('Skip post-survey','survey-skip','link-button')+'</section>');
 document.querySelectorAll('[data-survey-question]').forEach(el=>el.addEventListener('click',()=>{
  const key=el.dataset.surveyQuestion,value=Number(el.dataset.surveyValue);
  state.surveyAnswers[key]=value;save();
  document.querySelectorAll('[data-survey-question="'+key+'"]').forEach(other=>{other.classList.toggle('chosen',other===el);other.setAttribute('aria-pressed',String(other===el));});
  document.querySelector('#survey-error').textContent='';
 }));
 const box=document.querySelector('#survey-q10');if(box)box.addEventListener('input',()=>{state.surveyAnswers.q10=box.value;save();});
}
function surveyNext(){
 if(state.stage!=='survey')return;
 const step=state.surveyStep||0;
 const keys=step===0?['q1','q2','q3','q4','q5']:['q6','q7','q8','q9'];
 const incomplete=keys.filter(k=>![1,2,3,4,5].includes(state.surveyAnswers[k]));
 if(incomplete.length){document.querySelector('#survey-error').textContent='Please answer all '+keys.length+' rating questions on this page, or skip the post-survey.';return;}
 if(step===0){state.surveyStep=1;save();survey();return;}
 completeSurvey(false);
}
function completeSurvey(skipped){
 if(state.stage!=='survey')return;
 state.surveyCompleted=!skipped;
 state.stage='done';
 const completed=!skipped;
 emit('finish',{
  completed_items:state.index,planned_items:state.order.length,submitted_answers:state.index,
  elapsed_ms:Math.max(0,Date.now()-(state.started||Date.now())),
  website_variant:CONDITION,study_version:'5.0.0',
  attention_checks:{hate:state.attentionDone.hate,not_hate:state.attentionDone.not_hate,
    attempts:state.attentionAttempts},
  post_survey_version:'1.0.0',post_survey_completed:completed,
  post_survey:completed?Object.fromEntries(SURVEY_QUESTIONS.map(q=>[q.id,q.id==='q10'?(state.surveyAnswers[q.id]||''):state.surveyAnswers[q.id]])):null
 });
 save();finish();
}
function finish(){
 shell('Study complete','<div class="finish"><div class="check">✓</div><p class="eyebrow">CSE 594 CLASS ASSIGNMENT</p><h1>Thank you for your <em>contribution.</em></h1><p>Your feedback helps us understand hateful-meme detection, sensitivity, and human–AI interaction.</p><div class="receipt"><div><small>SESSION REFERENCE</small><b>'+escapeHTML(state.id.slice(0,8).toUpperCase())+'</b></div><div><small>MEMES COMPLETED / SKIPPED</small><b>'+state.index+' / '+state.order.length+'</b></div><div><small>STUDY CONDITION</small><b>'+(CONDITION==='assisted'?'With AI assistance':'Without AI assistance')+'</b></div></div><p class="muted">'+(state.surveyCompleted?'Post-study survey submitted.':'Post-study survey skipped.')+'</p><p class="muted">'+(queued()?'Some responses are still pending upload; please use Retry upload in the footer.':'Check storage below to verify all responses were saved.')+'</p>'+button('Start a new session','restart')+'</div>');
}
const actions={
 home:render,health,retry:()=>{lastError='';flush();},
 guide:()=>{
  if(!document.querySelector('#consent')?.checked){document.querySelector('#consent')?.focus();return;}
  const field=document.querySelector('#uniqname'),typed=field?.value.trim()||'';
  if(typed&&!/^[a-zA-Z][a-zA-Z0-9._-]{0,31}$/.test(typed)){
   document.querySelector('#uniqname-error').textContent='Enter a valid uniqname or leave it blank.';
   field?.focus();return;
  }
  state.uniqname=typed;state.consented=true;state.stage='guide';state.practiceIndex=0;save();render();
 },
 'back-to-purpose':()=>{state.stage='welcome';save();render();},
 'practice-reveal':()=>{state.practiceRevealed=true;save();guide();},
 'practice-prev':()=>{if(state.practiceIndex>0){state.practiceIndex--;state.practiceSelected=null;save();guide();}},
 'practice-next':()=>{if(state.practicePassed[state.practiceIndex]&&state.practiceIndex<2){state.practiceIndex++;state.practiceSelected=null;save();guide();}},
 begin:()=>{
  const field=document.querySelector('#trial-count'),value=Number(field?.value);
  if(!state.consented){state.stage='welcome';save();render();return;}
  if(!state.practicePassed.every(Boolean)){document.querySelector('#guide-error').textContent='Complete all three practice examples first.';return;}
  if(!Number.isInteger(value)||value<1||value>MAX_COUNT){document.querySelector('#guide-error').textContent='Choose a whole number of memes from 1 to 12.';return;}
  state.planned=value;state.order=(state.uniqname?sharedItemsForUniqname(state.uniqname):state.order).slice(0,value);
  state.stage='task';state.started=Date.now();state.opened=Date.now();save();
  emit('start',{planned_items:value,consented:true,uniqname:state.uniqname||null,
   practice_correct_count:3,attention_checks_planned:2,post_survey_questions_planned:10,
   matched_item_assignment:!!state.uniqname,study_version:'5.0.0',
   content_shield:CONDITION==='assisted',website_variant:CONDITION});
  render();
 },
 next:()=>submit(false),skip:()=>submit(true),
 'agree-ai':()=>{if(state.stage==='review')completeResponse({review_response:'ai_correct_changed',review_shown:true,final_label:current()?.ai_hateful_prediction??null});},
 'reject-ai':()=>{if(state.stage==='review')completeResponse({review_response:'ai_wrong_kept',review_shown:true,final_label:state.answers[current()?.trial_id]?.initialLabel??null});},
 'reveal-image':()=>reveal('image'),'reveal-text':()=>reveal('text'),
 'attention-hateful':()=>answerAttention(1),
 'attention-not-hateful':()=>answerAttention(0),
 'survey-next':surveyNext,
 'survey-prev':()=>{if(state.stage==='survey'){state.surveyStep=0;save();survey();}},
 'survey-skip':()=>completeSurvey(true),
 restart:()=>{if(queued()){alert('Responses are still pending upload. Retry before starting a new session.');return;}if(!confirm('Begin a new study session?'))return;state=fresh();save();render();}
};
function render(){
 if(state.stage==='task'||state.stage==='review')task();
 else if(state.stage==='attention')attention();
 else if(state.stage==='survey')survey();
 else if(state.stage==='guide')guide();
 else if(state.stage==='done')finish();
 else welcome();
}
window.addEventListener('online',()=>{health();flush();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)flush();});
save();render();health();
