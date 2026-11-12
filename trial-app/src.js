import './style.css';
import trials from './data/trials.json';

const root=document.getElementById('app');
const CONDITION=location.pathname.startsWith('/independent')?'independent':'assisted';
const KEY='hai-task-trial-v3-'+CONDITION, STUDY='hai-meme-evaluation-v1', DEFAULT_COUNT=12, MAX_COUNT=12;
const id=()=>crypto.randomUUID();
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const randomized=list=>{const values=[...list];for(let i=values.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values;};
const sharedItemsForUniqname=(name)=>{let seed=2166136261;for(const char of ('cse594-v4:'+name.trim().toLowerCase())){seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;}const next=()=>{seed+=0x6D2B79F5;let x=seed;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};const set=[...trials];for(let i=set.length-1;i>0;i--){let j=Math.floor(next()*(i+1));[set[i],set[j]]=[set[j],set[i]];}return set.map(x=>x.trial_id);};
const fresh=()=>({id:id(),condition:CONDITION,order:randomized(trials).slice(0,MAX_COUNT).map(t=>t.trial_id),planned:DEFAULT_COUNT,index:0,stage:'welcome',consented:false,uniqname:'',answers:{},events:[],started:null,opened:null,sessionVersion:4,attentionAnswer:null,attentionAttempts:0});
let state;try{state=JSON.parse(localStorage.getItem(KEY));}catch{}
if(!state||!Array.isArray(state.order)||!Array.isArray(state.events))state=fresh();
state.answers??={};
state.uniqname??='';
state.attentionAnswer??=null;
state.attentionAttempts??=0;
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
 root.innerHTML='<div class="wrap"><header><span class="course-header">CSE 594 <span class="course-subtitle">Class Assignment</span></span><span class="tag">HUMAN–AI INTERACTION STUDY</span><span>'+escapeHTML(view)+'</span></header><main>'+html+'</main><footer><span>CSE 594 · Class Assignment</span><div class="storage"><span id="sync" aria-live="polite">'+(queued()?queued()+' responses pending':'Check storage status')+'</span>'+button('Check storage','health','link-button')+' '+(queued()?button('Retry upload','retry','link-button'):'')+'</div><span>Version 4.0</span></footer></div>';
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
 shell('About the study · '+(assisted?'AI-assisted':'Independent'),`<section class="hero purpose-page"><p class="eyebrow">HUMANS + AI · MEME UNDERSTANDING</p><h1>Help AI understand <em>what memes really mean.</em></h1><p class="lead">Memes can communicate sarcasm, stereotypes and subtle hate that AI may miss. Your independent judgments will help researchers evaluate how AI handles those nuances.</p><div class="purpose-flow"><div class="purpose-card"><div class="purpose-icon">◉</div><strong>Human interpretation</strong><p>Judge whether a meme is hateful, and share whether the content felt triggering to you.</p></div><div class="purpose-arrow" aria-hidden="true">→</div><div class="purpose-card"><div class="purpose-icon">✧</div><strong>Better evaluations</strong><p>Human feedback highlights nuanced examples that AI needs to interpret more accurately.</p></div></div><div class="independence"><p class="eyebrow">TWO INDEPENDENT DIMENSIONS</p><h2>Hateful ≠ triggering</h2><p>A meme can be hateful without personally upsetting you, distressing without targeting a group, both, or neither. The two judgments are separate.</p><div class="quadrant"><div><b>Hateful + triggering</b><small>Both apply</small></div><div><b>Hateful + not triggering</b><small>Hate does not always feel personally distressing</small></div><div><b>Not hateful + triggering</b><small>Distressing is not necessarily hateful</small></div><div><b>Neither</b><small>Neither category applies</small></div></div></div><div class="guard-summary"><span class="purpose-icon">`+(assisted?'◈':'◉')+`</span><div><strong>`+(assisted?'AI-assisted evaluation + safety shield':'Independent evaluation · original content')+`</strong><p>`+escapeHTML(intro)+`</p></div></div><div class="notice"><strong>`+(assisted?'Content warning — AI protection is imperfect':'Content warning — no filtering in this version')+`</strong><p>`+escapeHTML(risk)+`</p></div><div class="uniqname-card"><label for="uniqname" class="uniqname-label">University of Michigan uniqname <span class="optional-label">Optional</span></label><input id="uniqname" name="uniqname" type="text" maxlength="32" autocomplete="off" spellcheck="false" placeholder="e.g., youruniqname" value="`+escapeHTML(state.uniqname||'')+`"><p class="muted">You can leave this blank. If supplied, your uniqname will be saved with your session responses and can identify you. Your responses are linked through a session ID. Using the same uniqname in both study versions assigns the same meme sample in each.</p><p id="uniqname-error" class="error" role="alert"></p></div><label class="consent"><input id="consent" type="checkbox"> I am at least 18, understand the study purpose and the content risks of this version, and voluntarily agree to participate.</label><p>`+button('Continue to practice walkthrough →','guide')+`</p></section>`);
}
function guide(){
 const assisted=CONDITION==='assisted';
 const steps=[
  {
   title:'Look at the meme',
   description:assisted?'First, review the image and caption. If AI flags sensitive content, it may blur the image and soften words. You can reveal the original only if you choose.':'First, look at the original image and caption. This version does not filter content; you can skip an item at any point.',
   visual:'meme'
  },
  {
   title:'Decide whether it is hateful',
   description:'Use the five-point hatefulness scale. One or two = not hateful; three = unsure; four or five = hateful. Sarcasm and context matter.',
   visual:'hate'
  },
  {
   title:'Report your experience',
   description:'Independently indicate whether the meme was triggering and whether you would prefer not to see it; if so, specify imagery, text or both.',
   visual:'sensitive'
  },
  {
   title:'Give confidence, or skip the example',
   description:'Choose confidence from 1 to 5 and optionally explain your choice. Selecting Skip example submits the trial as skipped, with no hatefulness, triggering, or other judgments recorded.',
   visual:'confidence'
  },
  {
   title:assisted?'Review AI reasoning only if you disagree':'Submit and continue',
   description:assisted?'If your clear initial hateful/not-hateful judgment differs from the AI’s, read its reasoning and decide whether to change the response. Both judgments are saved.':'Submit your evaluation, then move to the next meme. No AI opinion or disagreement review is shown in this version.',
   visual:assisted?'disagreement':'done'
  }
 ];
 const n=Math.min(steps.length-1,Math.max(0,walkthroughStep)),step=steps[n];
 const mockMeme='<div class="guide-mock-meme"><span class="mock-meme-icon" aria-hidden="true">✉</span><strong>When the 60-minute meeting could have been an email…</strong><small>Harmless illustrative meme · not part of this study</small></div>';
 let mockControls='';
 if(step.visual==='meme')mockControls='<div class="guide-mock-tip">'+(assisted?'In assisted sessions, potentially sensitive real images may appear blurred.':'In independent sessions, real images and text will be shown unfiltered.')+'</div>';
 if(step.visual==='hate')mockControls='<div class="guide-mock-panel"><b>How hateful is the example (1–5)?</b><div class="guide-mock-choice">1 · Definitely not hateful</div><div class="guide-mock-choice selected">2 · Probably not hateful</div><div class="guide-mock-choice">3 · Unsure / ambiguous</div><div class="guide-mock-choice">4 · Probably hateful</div><div class="guide-mock-choice">5 · Definitely hateful</div></div>';
 if(step.visual==='sensitive')mockControls='<div class="guide-mock-panel"><b>Was this example triggering?</b><div class="guide-mock-choice selected">● No, not triggering</div><b class="guide-mock-subtitle">Would you rather not have seen it?</b><div class="guide-mock-choice selected">● No</div><small>If yes: imagery / text / both</small></div>';
 if(step.visual==='confidence')mockControls='<div class="guide-mock-panel"><b>How confident are you?</b><div class="guide-mock-scale"><span>1</span><span>2</span><strong>3</strong><span>4</span><span>5</span></div><div class="guide-mock-buttons"><span>Skip example</span><strong>Save & continue</strong></div></div>';
 if(step.visual==='disagreement')mockControls='<div class="guide-mock-panel"><b>Your judgment: Not hateful</b><div class="guide-mock-choice">AI judgment: Hateful</div><small>Read the AI’s explanation, then decide:</small><div class="guide-mock-choice">Change my answer</div><div class="guide-mock-choice selected">Keep my answer</div></div>';
 if(step.visual==='done')mockControls='<div class="guide-mock-panel"><b>Response submitted</b><p>Move on to the next sample. Your initial judgment is saved.</p></div>';
 const dots=steps.map((_,i)=>'<button type="button" data-guide-step="'+i+'" class="demo-dot '+(i===n?'active':'')+'" aria-label="Show walkthrough step '+(i+1)+'" aria-current="'+(i===n?'step':'false')+'"></button>').join('');
 shell('Practice + setup',`<section class="guide-page"><p class="eyebrow">PRACTICE BEFORE YOU START</p><h1>One example, <em>five easy steps.</em></h1><p class="lead">This interactive preview shows what you'll do in a trial. Click Next or Previous to go through the steps at your own pace. The example below is safe and illustrative.</p><div class="walkthrough guide-walkthrough"><div class="guide-mock-screen"><div class="guide-mock-header"><span>EXAMPLE TRIAL</span><span>PREVIEW ONLY</span></div>`+mockMeme+mockControls+`</div><div class="demo-explain" aria-live="polite"><span class="demo-count">STEP `+(n+1)+` OF `+steps.length+`</span><h2>`+escapeHTML(step.title)+`</h2><p>`+escapeHTML(step.description)+`</p><div class="demo-dots">`+dots+`</div><div class="demo-controls">`+button('← Previous','demo-prev','secondary')+button(n===steps.length-1?'Back to step 1 ↺':'Next step →','demo-next','secondary')+`</div><p class="muted">Select a dot or use the buttons to change steps. Nothing advances automatically.</p></div></div><div class="setup-card"><div><p class="eyebrow">CHOOSE YOUR SESSION LENGTH</p><h2>How many memes would you like to evaluate today?</h2><p class="muted">Choose 1–12 trials (12 by default; designed for under ten minutes including instructions). You can skip an entire example or stop at any time.</p></div><div class="number-config"><button type="button" data-count-change="-1" aria-label="One fewer trial">−</button><input type="number" id="trial-count" min="1" max="12" step="1" value="`+state.planned+`" aria-label="Number of task trials"><button type="button" data-count-change="1" aria-label="One more trial">+</button></div></div><div class="attention-check"><h3>Quick attention check</h3><p>What does the <strong>Skip example</strong> button do?</p><label class="attention-option"><input type="radio" name="attention" value="whole" `+(state.attentionAnswer==='whole'?'checked':'')+`> It skips the entire meme and records no judgments for it</label><label class="attention-option"><input type="radio" name="attention" value="hate-only" `+(state.attentionAnswer==='hate-only'?'checked':'')+`> It skips only the hateful-content rating</label><p class="muted">This checks understanding. You may correct your response and retry.</p></div><div class="notice"><strong>`+(assisted?'AI filtering is not a guarantee':'Original content is shown without filtering')+`</strong><p>`+escapeHTML(assisted?'AI may miss triggering images or language. Keep protected content hidden, skip any item, or stop at any point.':'Real examples may include sensitive imagery and language. Nothing is blurred or euphemized in the independent version. You can skip the whole example or stop participating.')+`</p></div><div class="guide-actions">`+button('← Back','back-to-purpose','secondary')+button('Start my trials →','begin')+`</div><p id="guide-error" class="error" role="alert"></p></section>`);
 const countInput=document.querySelector('#trial-count');
 const saveCount=()=>{const count=Number(countInput.value);if(Number.isInteger(count)&&count>=1&&count<=MAX_COUNT){state.planned=count;save();document.querySelector('#guide-error').textContent='';}};
 countInput.addEventListener('change',saveCount);
 countInput.addEventListener('input',()=>{const n=Number(countInput.value);if(Number.isInteger(n)&&n>=1&&n<=MAX_COUNT){state.planned=n;save();}});
 document.querySelectorAll('[data-count-change]').forEach(el=>el.addEventListener('click',()=>{countInput.value=String(Math.min(MAX_COUNT,Math.max(1,(Number(countInput.value)||DEFAULT_COUNT)+Number(el.dataset.countChange))));saveCount();}));
 document.querySelectorAll('[data-guide-step]').forEach(el=>el.addEventListener('click',()=>{walkthroughStep=Number(el.dataset.guideStep);guide();}));
 document.querySelectorAll('input[name="attention"]').forEach(el=>el.addEventListener('change',()=>{state.attentionAnswer=el.value;save();}));
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
 const triggerQuestion='<div class="trigger-question"><h2>Was this example triggering or distressing to you?</h2><p class="muted">Your personal experience, independent of hatefulness and AI flags.</p><div class="choices trigger-choices"><button class="choice '+(answer.triggering===1?'chosen':'')+'" data-triggering="1"><b>Yes, potentially triggering</b></button><button class="choice '+(answer.triggering===0?'chosen':'')+'" data-triggering="0"><b>No, not triggering to me</b></button></div></div>';
 const avoidanceQuestion='<div class="trigger-question"><h2>Would you have preferred not to see this example?</h2><p class="muted">A separate viewing preference. Either answer is valid.</p><div class="choices trigger-choices"><button class="choice '+(answer.avoid_preference===1?'chosen':'')+'" data-avoid="1"><b>Yes, I would rather not have seen it</b></button><button class="choice '+(answer.avoid_preference===0?'chosen':'')+'" data-avoid="0"><b>No, I was comfortable seeing it</b></button></div><div id="avoid-reason" class="avoid-reason '+(answer.avoid_preference===1?'':'hidden')+'"><h3>If yes, what made you prefer not to see it?</h3><div class="choices trigger-choices"><button class="choice '+(answer.avoid_reason==='imagery'?'chosen':'')+'" data-avoid-reason="imagery"><b>Imagery</b></button><button class="choice '+(answer.avoid_reason==='text'?'chosen':'')+'" data-avoid-reason="text"><b>Text</b></button><button class="choice '+(answer.avoid_reason==='both'?'chosen':'')+'" data-avoid-reason="both"><b>Both</b></button></div></div></div>';
 const hatefulChoices=[['Definitely not hateful',1],['Probably not hateful',2],['Unsure / ambiguous',3],['Probably hateful',4],['Definitely hateful',5]].map(([label,value])=>'<button type="button" class="choice '+(answer.hateful_likert===value?'chosen':'')+'" data-hateful-likert="'+value+'"><b>'+label+'</b></button>').join('');
 shell('Question '+(state.index+1)+' / '+state.order.length,
 '<div class="study-head"><p class="eyebrow">EVALUATION IN PROGRESS</p><h1>Thanks for your contribution to help improve hate speech detection</h1><p>Evaluate each sample at your own pace, or skip the entire example whenever you wish.</p><div class="progress"><div style="width:'+(100*state.index/state.order.length)+'%"></div></div></div>'+
 '<div class="grid"><section class="panel"><p class="eyebrow">CONTENT TO REVIEW</p>'+notice+image+caption+'</section><section class="panel"><p class="eyebrow">YOUR EVALUATION</p><h2>How hateful is this meme?</h2><p class="muted">Choose one point on the five-point scale. Your answer is recorded before any AI opinion is shown.</p><div class="choices hateful-choices">'+hatefulChoices+'</div>'+triggerQuestion+avoidanceQuestion+'<h3>How confident are you?</h3><div class="slider-label"><span>Not confident</span><strong id="conf-value">'+(answer.confidence?answer.confidence+' / 5':'Not selected')+'</strong><span>Very confident</span></div><input id="confidence" type="range" min="1" max="5" value="'+(answer.confidence||3)+'"><div class="slider-label"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><h3>Why did you choose this answer? <small>Optional</small></h3><textarea id="reason" maxlength="1500" rows="4" placeholder="Describe context, cues or uncertainty…">'+escapeHTML(answer.reason||'')+'</textarea><div class="actions"><button class="skip" data-action="skip">Skip example</button>'+button(state.index===state.order.length-1?'Finish evaluation →':'Save & continue →','next')+'</div><p class="error" id="error" role="alert"></p></section></div>');
 document.querySelectorAll('[data-hateful-likert]').forEach(element=>element.addEventListener('click',()=>{answer.hateful_likert=Number(element.dataset.hatefulLikert);answer.label=answer.hateful_likert===3?null:(answer.hateful_likert>3?1:0);state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-hateful-likert]').forEach(x=>x.classList.toggle('chosen',x===element));}));
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
 if(!skipped&&![0,1].includes(answer.triggering)){error.textContent='Please vote whether this example felt triggering before continuing.';return;}
 if(!skipped&&![0,1].includes(answer.avoid_preference)){error.textContent='Please answer whether you would have preferred not to see this sample.';return;}
 if(!skipped&&answer.avoid_preference===1&&!['imagery','text','both'].includes(answer.avoid_reason)){error.textContent='Please select imagery, text, or both as the reason you would rather not have seen this meme.';return;}
 if(!skipped&&(![1,2,3,4,5].includes(answer.hateful_likert)||!answer.confidence)){error.textContent='Select a hateful-content scale option and adjust confidence, or skip the entire example.';return;}
 answer.skipped=Boolean(skipped);
 answer.initialLabel=skipped?null:answer.label;
 answer.initialLikert=skipped?null:answer.hateful_likert;
 answer.initialConfidence=skipped?null:answer.confidence;
 state.answers[item.trial_id]=answer;
 const disagreement=CONDITION==='assisted'&&!skipped&&[0,1].includes(answer.initialLabel)&&[0,1].includes(item.ai_hateful_prediction)&&answer.initialLabel!==item.ai_hateful_prediction;
 if(disagreement){state.stage='review';save();render();return;}
 completeResponse({review_response:null,review_shown:false,final_label:answer.initialLabel});
}
function review(){
 const item=current(), answer=state.answers[item.trial_id]||{};
 if(!item||CONDITION!=='assisted'||answer.skipped||![0,1].includes(answer.initialLabel)||answer.initialLabel===item.ai_hateful_prediction){state.stage='task';save();render();return;}
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
  initial_hateful_likert:answer.skipped?null:answer.initialLikert,
  final_hateful_likert:answer.skipped?null:(review_response==='ai_correct_changed'?(final_label===1?4:2):answer.initialLikert),
  final_classification:final_label,
  confidence:answer.skipped?null:answer.initialConfidence,
  triggering_vote:answer.skipped===true?null:answer.triggering,
  preferred_not_shown:!answer.skipped?answer.avoid_preference:null,
  preferred_not_shown_reason:!answer.skipped&&answer.avoid_preference===1?answer.avoid_reason:null,
  website_variant:CONDITION,
  protocol_version:'4.0.0',
  ai_trigger_detected:CONDITION==='assisted'?item.ai_trigger_flag===true:null,
  ai_hateful_prediction:CONDITION==='assisted'?item.ai_hateful_prediction:null,
  ai_disagreement:disagree,
  ai_reasoning_presented:review_shown,
  ai_reasoning_verdict:review_response,
  participant_changed_answer:review_response==='ai_correct_changed',
  reason:answer.skipped?'':(answer.reason||''),
  skipped:answer.skipped===true,
  skip_scope:answer.skipped===true?'entire_example':null,
  elapsed_ms:Math.max(0,Date.now()-(state.opened||Date.now())),
  image_initially_blurred:CONDITION==='assisted'&&item.ai_trigger_flag===true,
  caption_euphemized:CONDITION==='assisted'&&item.ai_trigger_flag===true,
  image_revealed:answer.revealedImage===true,
  caption_revealed:answer.revealedText===true
 },item.trial_id);
 state.index++;state.opened=Date.now();state.stage=state.index>=state.order.length?'done':'task';save();
 if(state.stage==='done')emit('finish',{completed_items:state.index,planned_items:state.order.length,submitted_answers:state.index,elapsed_ms:Date.now()-(state.started||Date.now()),study_version:'4.0.0',website_variant:CONDITION});
 render();
}
function finish(){
 shell('Study finished','<div class="finish"><div class="check">✓</div><p class="eyebrow">STUDY COMPLETED</p><h1>Thank you for your <em>perspective.</em></h1><p>Your feedback supports research into safer ways to engage with potentially distressing visual content.</p><div class="receipt"><div><small>SESSION REFERENCE</small><b>'+escapeHTML(state.id.slice(0,8).toUpperCase())+'</b></div><div><small>ITEMS REVIEWED</small><b>'+state.index+' / '+state.order.length+'</b></div><div><small>STUDY CONDITION</small><b>'+(CONDITION==='assisted'?'AI-assisted + filtered':'No AI assistance · original content')+'</b></div></div><p class="muted" id="done-note">'+(queued()?'Some results still need uploading. Please check storage status below.':'Responses have been submitted to the configured server when connected.')+'</p>'+button('Begin a new session','restart')+'</div>');
}
const actions={
 home:render,health,retry:()=>{lastError='';flush();},
 guide:()=>{
  if(!document.querySelector('#consent')?.checked){document.querySelector('#consent')?.focus();return;}
  const field=document.querySelector('#uniqname');
  const typed=field?.value.trim()||'';
  if(typed&&!/^[a-zA-Z][a-zA-Z0-9._-]{0,31}$/.test(typed)){
   document.querySelector('#uniqname-error').textContent='Please enter a valid uniqname (letters, digits, dots, underscores, hyphens; start with a letter) or leave it blank.';
   field?.focus();return;
  }
  state.uniqname=typed;
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
  if(!Number.isInteger(value)||value<1||value>MAX_COUNT){document.querySelector('#guide-error').textContent='Enter a whole number of trials between 1 and 12.';return;}
  if(state.attentionAnswer!=='whole'){state.attentionAttempts++;save();document.querySelector('#guide-error').textContent=state.attentionAnswer==='hate-only'?'Not quite: Skip example skips the entire sample. Select that option to continue.':'Please answer the attention-check question before starting.';return;}
  state.attentionAttempts++;
  state.planned=value;state.order=(state.uniqname?sharedItemsForUniqname(state.uniqname):state.order).slice(0,value);
  state.stage='task';state.started=Date.now();state.opened=Date.now();save();
  emit('start',{planned_items:value,consented:true,uniqname:state.uniqname||null,attention_check_passed:true,attention_check_attempts:state.attentionAttempts,matched_item_assignment:!!state.uniqname,study_version:'4.0.0',content_shield:CONDITION==='assisted',website_variant:CONDITION});
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
