import './style.css';
import trials from './data/trials.json';

const root=document.getElementById('app');
const KEY='hai-task-trial-v1', STUDY='hai-meme-evaluation-v1', COUNT=12;
const id=()=>crypto.randomUUID();
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const randomized=list=>{const values=[...list];for(let i=values.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}return values;};
const fresh=()=>({id:id(),condition:Math.random()<0.5?'assisted':'independent',order:randomized(trials).slice(0,COUNT).map(t=>t.trial_id),index:0,stage:'welcome',answers:{},events:[],started:null,opened:null,sessionVersion:2});
let state;try{state=JSON.parse(localStorage.getItem(KEY));}catch{}
if(!state||!Array.isArray(state.order)||!Array.isArray(state.events))state=fresh();
state.answers??={};
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
 root.innerHTML='<div class="wrap"><header><a href="#" data-action="home" class="brand">◧ context<span>.</span>lab</a><span class="tag">RESEARCH STUDY</span><span>'+escapeHTML(view)+'</span></header><main>'+html+'</main><footer><span>Context Lab · HAI research</span><div class="storage"><span id="sync" aria-live="polite">'+(queued()?queued()+' responses pending':'Check storage status')+'</span>'+button('Check storage','health','link-button')+' '+(queued()?button('Retry upload','retry','link-button'):'')+'</div><span>Version 2.0</span></footer></div>';
 root.querySelectorAll('[data-action]').forEach(element=>element.addEventListener('click',event=>{event.preventDefault();actions[element.dataset.action]?.();}));
 if(lastError)setStatus(queued()+' pending · '+lastError,true);
}
function welcome(){
 shell('Welcome','<section class="hero"><p class="eyebrow">PARTICIPANT INFORMATION</p><h1>How do we interpret <em>visual content?</em></h1><p class="lead">Help us study whether AI content shields help people engage with potentially distressing memes.</p><div class="stats"><span>◷ Around 8–12 minutes</span><span>◎ Anonymous</span><span>▣ 12 evaluations</span></div><div class="notice"><strong>Content advisory</strong><p>Some content may reference violence, prejudice, abuse, or other distressing topics. You may skip any item, stop participating, or reveal shielded material only if you choose. The independent condition may display original content.</p></div><label class="consent"><input id="consent" type="checkbox"> I am at least 18, understand the content advisory, and voluntarily agree to participate in this anonymous study.</label><p>'+button('Begin study →','begin')+'</p></section>');
}
function task(){
 const item=current();
 if(!item){state.stage='done';save();finish();return;}
 const answer=state.answers[item.trial_id]||{};
 const shielded=state.condition==='assisted'&&item.ai_trigger_flag===true;
 const revealedImage=answer.revealedImage===true;
 const revealedText=answer.revealedText===true;
 const displayCaption=shielded&&!revealedText?(item.ai_euphemized_caption||'[Caption withheld: potentially distressing language]'):item.meme_text;
 const notice=shielded?'<div class="trigger"><div class="eyebrow">✧ AI CONTENT SHIELD ACTIVE</div><p><strong>'+escapeHTML(item.ai_trigger_notice||'Potentially distressing content detected.')+'</strong></p>'+(item.ai_trigger_categories?.length?'<div class="chips">'+item.ai_trigger_categories.map(cat=>'<span>'+escapeHTML(cat)+'</span>').join('')+'</div>':'')+'<p class="muted">The original image is obscured, and the caption may be softened. The detection can be imperfect.</p></div>':'';
 const image='<div class="meme '+(shielded&&!revealedImage?'blurred':'')+'"><img src="'+escapeHTML(item.image_url)+'" alt="Meme under evaluation" referrerpolicy="no-referrer"><p class="muted">If this image fails to load, you may skip the item.</p>'+(shielded&&!revealedImage?'<div class="shield-overlay"><strong>Image blurred</strong><span>Possible distressing content</span>'+button('Reveal original image','reveal-image','reveal')+'</div>':'')+'</div>';
 const caption='<div class="caption"><small>'+(shielded&&!revealedText?'SOFTENED CAPTION':'ORIGINAL CAPTION')+'</small><p>'+escapeHTML(displayCaption)+'</p>'+(shielded&&!revealedText?button('Show original caption','reveal-text','link-button'):'')+'</div>';
 shell('Question '+(state.index+1)+' / '+COUNT,
 '<div class="study-head"><p class="eyebrow">EVALUATION IN PROGRESS</p><h1>Look closely. Think critically.</h1><p>Consider how the meme might be interpreted. You can evaluate it without revealing shielded details.</p><div class="progress"><div style="width:'+(100*state.index/COUNT)+'%"></div></div></div>'+
 '<div class="grid"><section class="panel"><p class="eyebrow">CONTENT TO REVIEW</p>'+notice+image+caption+'</section><section class="panel"><p class="eyebrow">YOUR EVALUATION</p><h2>Does this meme convey hateful content?</h2><p class="muted">Does the content demean, attack, or promote hostility toward an identity group?</p><div class="choices"><button class="choice '+(answer.label===1?'chosen':'')+'" data-choice="1"><b>Yes, hateful</b><small>Targets or demeans an identity group</small></button><button class="choice '+(answer.label===0?'chosen':'')+'" data-choice="0"><b>No, not hateful</b><small>No apparent identity-based hostility</small></button></div><h3>How confident are you?</h3><div class="slider-label"><span>Not confident</span><strong id="conf-value">'+(answer.confidence?answer.confidence+' / 5':'Not selected')+'</strong><span>Very confident</span></div><input id="confidence" type="range" min="1" max="5" value="'+(answer.confidence||3)+'"><div class="slider-label"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><h3>Why did you choose this answer? <small>Optional</small></h3><textarea id="reason" maxlength="1500" rows="4" placeholder="Describe context, cues or uncertainty…">'+escapeHTML(answer.reason||'')+'</textarea><div class="actions"><button class="skip" data-action="skip">Skip item</button>'+button(state.index===COUNT-1?'Finish evaluation →':'Save & continue →','next')+'</div><p class="error" id="error" role="alert"></p></section></div>');
 document.querySelectorAll('[data-choice]').forEach(element=>element.addEventListener('click',()=>{answer.label=Number(element.dataset.choice);state.answers[item.trial_id]=answer;save();document.querySelectorAll('[data-choice]').forEach(x=>x.classList.toggle('chosen',x===element));}));
 document.querySelector('#confidence').addEventListener('input',event=>{answer.confidence=Number(event.target.value);state.answers[item.trial_id]=answer;save();document.querySelector('#conf-value').textContent=answer.confidence+' / 5';});
 document.querySelector('#reason').addEventListener('input',event=>{answer.reason=event.target.value;state.answers[item.trial_id]=answer;save();});
 if(queued()&&!lastError)flush();
}
function reveal(kind){
 const item=current();if(!item||state.condition!=='assisted'||!item.ai_trigger_flag)return;
 const answer=state.answers[item.trial_id]||{};
 answer[kind==='image'?'revealedImage':'revealedText']=true;
 state.answers[item.trial_id]=answer;save();
 // Do not add new event types: record reveal actions in response payload.
 task();
}
function submit(skipped){
 const item=current(), answer=state.answers[item.trial_id]||{};
 if(!skipped&&(![0,1].includes(answer.label)||!answer.confidence)){document.querySelector('#error').textContent='Select a classification and adjust the confidence slider, or skip this item.';return;}
 emit('response',{item_index:state.index,classification:skipped?null:answer.label,confidence:skipped?null:answer.confidence,reason:skipped?'':(answer.reason||''),skipped,elapsed_ms:Math.max(0,Date.now()-(state.opened||Date.now())),ai_trigger_detected:item.ai_trigger_flag===true,image_initially_blurred:state.condition==='assisted'&&item.ai_trigger_flag===true,caption_euphemized:state.condition==='assisted'&&item.ai_trigger_flag===true,image_revealed:answer.revealedImage===true,caption_revealed:answer.revealedText===true},item.trial_id);
 state.index++;state.opened=Date.now();state.stage=state.index>=COUNT?'done':'task';save();
 if(state.stage==='done')emit('finish',{completed_items:state.index,submitted_answers:Object.keys(state.answers).length,elapsed_ms:Date.now()-(state.started||Date.now())});
 render();
}
function finish(){
 shell('Study finished','<div class="finish"><div class="check">✓</div><p class="eyebrow">STUDY COMPLETED</p><h1>Thank you for your <em>perspective.</em></h1><p>Your feedback supports research into safer ways to engage with potentially distressing visual content.</p><div class="receipt"><div><small>SESSION REFERENCE</small><b>'+escapeHTML(state.id.slice(0,8).toUpperCase())+'</b></div><div><small>ITEMS REVIEWED</small><b>'+state.index+' / '+COUNT+'</b></div><div><small>STUDY CONDITION</small><b>'+(state.condition==='assisted'?'AI shield':'Original content')+'</b></div></div><p class="muted" id="done-note">'+(queued()?'Some results still need uploading. Please check storage status below.':'Responses have been submitted to the configured server when connected.')+'</p>'+button('Begin a new session','restart')+'</div>');
}
const actions={
 home:render,health, retry:()=>{lastError='';flush();},
 begin:()=>{if(!document.querySelector('#consent')?.checked){document.querySelector('#consent')?.focus();return;}state.stage='task';state.started=Date.now();state.opened=Date.now();save();emit('start',{planned_items:COUNT,consented:true,study_version:'2.0.0',content_shield:state.condition==='assisted'});render();},
 next:()=>submit(false),skip:()=>submit(true),
 'reveal-image':()=>reveal('image'),'reveal-text':()=>reveal('text'),
 restart:()=>{if(queued()){alert('Some responses are still pending upload. Please retry uploading before starting another session.');return;}if(!confirm('Begin a new anonymous session?'))return;state=fresh();save();render();}
};
function render(){if(state.stage==='task')task();else if(state.stage==='done')finish();else welcome();}
window.addEventListener('online',()=>{health();flush();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)flush();});
save();render();health();
