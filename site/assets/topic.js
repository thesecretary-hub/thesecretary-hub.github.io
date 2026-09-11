import { supabase } from './supabase-client.js';
import { avatarUrl, esc, formatDate, mountLayout, showToast } from './layout.js?v=4.5.0';
import { mountForumNotifications, notifyForumReply } from './forum-notifications.js?v=1.0.0';

const categories={suggestion:'Suggestions',bugs:'Bugs & glitches','website-error':'Website help','fatal-error':'Critical issues',downtime:'Downtime',informal:'Informal'};
const root=document.querySelector('[data-topic-root]');
const viewer=await mountLayout('forums');
const slug=new URLSearchParams(location.search).get('slug');
let topic, myVote=0, replies=[], offset=0, loadingReplies=false;
const replyPageSize=30;
const login=`/login/?return=${encodeURIComponent(location.pathname+location.search)}`;
function avatar(profile){return `<button class="avatar-button" data-profile-user="${esc(profile.username)}" aria-label="View ${esc(profile.username)}'s profile"><span class="user-avatar avatar-medium"><img src="${avatarUrl(profile)}" alt=""></span></button>`;}
function identity(profile){return `${avatar(profile)}<div><strong>${esc(profile.display_name)}</strong><span>@${esc(profile.username)}</span></div>`;}
function copy(body){return esc(body).replace(/\n/g,'<br>');}
function canManage(){return viewer && (viewer.id===topic.user_id || ['admin','moderator'].includes(viewer.role));}
function visitorId(){
  try { let id=localStorage.getItem('forum-visitor'); if(!/^[a-f0-9-]{36}$/i.test(id||'')){id=crypto.randomUUID();localStorage.setItem('forum-visitor',id);} return id; }
  catch { return null; } // Do not inflate views when persistent storage is unavailable.
}
async function load(){
  try {
    if(!supabase||!slug) throw new Error('This discussion address is incomplete.');
    const result=await supabase.from('forum_topic_summary').select('*').eq('slug',slug).maybeSingle();
    if(result.error) throw result.error;
    if(!result.data) throw new Error('This discussion no longer exists.');
    topic=result.data;
    if(viewer){
      const {data,error}=await supabase.from('forum_topic_votes').select('vote').eq('topic_id',topic.id).eq('user_id',viewer.id).maybeSingle();
      if(error) throw error;
      myVote=data?.vote||0;
    }
    document.title=`${topic.title} — The Secretary Forums`;
    draw();
    await loadReplies();
    if(/^#reply-\d+$/.test(location.hash)) await revealReply(location.hash.slice(7));
    const visitor=visitorId();
    if(visitor||viewer){
      const {data,error}=await supabase.rpc('record_forum_view',{target_id:topic.id,visitor_id:visitor});
      if(!error && Number.isInteger(data)) root.querySelector('[data-views]').textContent=data;
    }
  }catch(error){
    root.innerHTML=`<main class="container page"><h1>Discussion unavailable</h1><p>${esc(error.message)}</p><a class="button primary" href="/forums/">Back to forums</a></main>`;
  }
}
function draw(){
  root.innerHTML=`<main class="container page topic-page forum-v2"><div data-forum-notifications></div><nav class="topic-breadcrumb" aria-label="Breadcrumb"><a href="/forums/">Forums</a><span>/</span><a href="/forums/?category=${topic.category}">${categories[topic.category]}</a></nav><header class="topic-title-block"><div><span class="topic-status state-${topic.status}" data-status>${topic.status}</span><h1>${esc(topic.title)}</h1><p>Started ${formatDate(topic.created_at)} · by @${esc(topic.username)}</p></div></header><div class="topic-toolbar"><span><strong data-reply-count>${topic.reply_count}</strong> replies</span><span><strong data-views>${topic.views}</strong> views</span><a href="#original-post">Original post</a><a href="#reply-composer">Join discussion ↓</a></div><article class="forum-post original-post" id="original-post"><header><div class="post-identity">${identity(topic)}</div><span class="op-label">Original post</span></header><div class="forum-copy">${copy(topic.body)}</div><footer><div class="vote-control" aria-label="Vote on the original post"><button data-vote="1" aria-label="Upvote original post" aria-pressed="${myVote===1}" ${!viewer?'disabled':''}>▲</button><strong data-score aria-live="polite">${topic.vote_score}</strong><button data-vote="-1" aria-label="Downvote original post" aria-pressed="${myVote===-1}" ${!viewer?'disabled':''}>▼</button></div>${!viewer?`<a href="${login}">Log in to vote</a>`:'<small>Vote on this discussion</small>'}<div class="topic-management">${canManage()?'<button class="button small ghost" data-toggle-topic></button>':''}</div></footer></article><div class="replies-heading"><h2>Conversation</h2><span>Oldest first</span></div><div data-solution-banner></div><section class="forum-replies" aria-label="Replies" data-replies></section><div class="reply-load"><p data-reply-error role="alert"></p><button class="button ghost" data-more>Load replies</button></div><section class="reply-composer" id="reply-composer"><div data-composer></div></section></main>`;
  updateState();
  root.querySelectorAll('[data-vote]').forEach(button=>button.onclick=()=>vote(Number(button.dataset.vote)));
  root.querySelector('[data-toggle-topic]')?.addEventListener('click',()=>changeStatus({status:topic.status==='closed'?(topic.solution_reply_id?'solved':'open'):'closed'}));
  root.querySelector('[data-more]').onclick=loadReplies;
  mountForumNotifications(viewer,root.querySelector('[data-forum-notifications]'));
}
function updateState(){
  const badge=root.querySelector('[data-status]'); badge.textContent=topic.status;badge.className=`topic-status state-${topic.status}`;
  const toggle=root.querySelector('[data-toggle-topic]');if(toggle)toggle.textContent=topic.status==='closed'?'Reopen discussion':'Close discussion';
  root.querySelector('[data-solution-banner]').innerHTML=topic.solution_reply_id?`<div class="accepted-banner">✓ This discussion has an accepted solution. <button data-show-solution>View solution →</button>${canManage()?'<button data-clear-solution>Remove solution</button>':''}</div>`:'';
  root.querySelector('[data-show-solution]')?.addEventListener('click',async()=>{
    await revealReply(topic.solution_reply_id);
  });
  root.querySelector('[data-clear-solution]')?.addEventListener('click',()=>changeStatus({solution_reply_id:null,status:topic.status==='closed'?'closed':'open'}));
  const composer=root.querySelector('[data-composer]');
  if(topic.status==='closed') composer.innerHTML='<div class="topic-closed-note"><strong>This discussion is closed.</strong><p>You can still read the conversation and vote on the original post.</p></div>';
  else if(!viewer) composer.innerHTML=`<div class="comment-login-callout"><strong>Have something to add?</strong><a class="button primary" href="${login}">Log in to reply</a></div>`;
  else if(!composer.querySelector('form')){
    composer.innerHTML=`<form data-reply-form><h2>Write a reply</h2><div class="replying-to" data-replying hidden>Replying to <strong></strong><button type="button" data-clear-reply aria-label="Cancel reply target">×</button></div><input type="hidden" name="parent_id"><label for="reply-body">Your reply</label><textarea id="reply-body" name="body" rows="6" required maxlength="10000" placeholder="Add to the conversation…"></textarea><p role="alert" data-send-error></p><footer><small>Be helpful. Keep it on topic.</small><button class="button primary" type="submit">Post reply</button></footer></form>`;
    composer.querySelector('[data-clear-reply]').onclick=()=>{composer.querySelector('[name=parent_id]').value='';composer.querySelector('[data-replying]').hidden=true;};
    composer.querySelector('form').onsubmit=sendReply;
  }
  renderReplies();
}
function replyMarkup(reply,index){
  const person=reply.profiles||{display_name:'Member',username:'member'};
  const solution=topic.solution_reply_id===reply.id;
  return `<article class="forum-post reply-post ${solution?'solution-reply':''}" id="reply-${reply.id}"><header><div class="post-identity">${identity(person)}</div><div class="reply-meta"><a href="#reply-${reply.id}" aria-label="Link to reply ${index+1}">#${index+1}</a><time>${formatDate(reply.created_at)}</time></div></header>${solution?'<span class="solution-label">✓ Accepted solution</span>':''}${reply.parent_id?`<a class="reply-context" href="#reply-${reply.parent_id}">↳ In reply to an earlier message</a>`:''}<div class="forum-copy">${reply.is_deleted?'<em>This reply was deleted.</em>':copy(reply.body)}</div>${!reply.is_deleted?`<footer>${reply.user_id===topic.user_id?'<span class="op-label">Original poster</span>':''}${viewer&&topic.status!=='closed'?`<button class="button small ghost" data-reply-to="${reply.id}">Reply</button>`:''}${canManage()&&!solution?`<button class="solution-button" data-solution="${reply.id}">Mark as solution</button>`:''}</footer>`:''}</article>`;
}
function renderReplies(){
  root.querySelector('[data-replies]').innerHTML=replies.map(replyMarkup).join('');
  root.querySelectorAll('[data-reply-to]').forEach(button=>button.onclick=()=>{
    const form=root.querySelector('[data-reply-form]');if(!form)return;
    const reply=replies.find(item=>String(item.id)===button.dataset.replyTo);
    form.elements.parent_id.value=reply.id;
    const note=form.querySelector('[data-replying]');note.hidden=false;note.querySelector('strong').textContent=reply.profiles?.display_name||'Member';
    form.scrollIntoView({behavior:'smooth'});form.elements.body.focus({preventScroll:true});
  });
  root.querySelectorAll('[data-solution]').forEach(button=>button.onclick=()=>changeStatus({solution_reply_id:Number(button.dataset.solution),status:topic.status==='closed'?'closed':'solved'}));
}
async function loadReplies(){
  if(loadingReplies)return false;
  loadingReplies=true;const button=root.querySelector('[data-more]');button.disabled=true;
  root.querySelector('[data-reply-error]').textContent='';
  try {
    const {data,error}=await supabase.from('forum_replies').select('*, profiles!forum_replies_user_id_fkey(display_name,username,avatar_path)').eq('topic_id',topic.id).order('created_at').order('id').range(offset,offset+replyPageSize-1);
    if(error)throw error;
    offset+=data.length;replies.push(...data);renderReplies();
    button.hidden=data.length<replyPageSize;button.textContent='Load more replies';
    if(!replies.length)root.querySelector('[data-replies]').innerHTML='<div class="community-empty"><p>No replies yet. Start the conversation.</p></div>';
    return true;
  } catch(error){root.querySelector('[data-reply-error]').textContent=error.message;return false;}
  finally {loadingReplies=false;button.disabled=false;}
}
async function revealReply(id){
  while(!root.querySelector(`#reply-${id}`) && !root.querySelector('[data-more]').hidden){
    if(!await loadReplies())return;
  }
  root.querySelector(`#reply-${id}`)?.scrollIntoView({behavior:'smooth'});
}
async function vote(direction){
  const buttons=[...root.querySelectorAll('[data-vote]')];if(buttons.some(button=>button.disabled))return;
  buttons.forEach(button=>button.disabled=true);
  try{
    const desired=myVote===direction?0:direction;
    const {data,error}=await supabase.rpc('set_forum_vote',{target_id:topic.id,desired_vote:desired});
    if(error)throw error;
    myVote=desired;root.querySelector('[data-score]').textContent=data;
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.vote)===myVote)));
  }catch(error){showToast(error.message,'error');}
  finally{buttons.forEach(button=>button.disabled=false);}
}
let managing=false;
async function changeStatus(values){
  if(managing)return;managing=true;
  try{
    const {data,error}=await supabase.from('forum_topics').update(values).eq('id',topic.id).select('status,solution_reply_id').single();
    if(error)throw error;Object.assign(topic,data);updateState();
  }catch(error){showToast(error.message,'error');}finally{managing=false;}
}
async function sendReply(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');
  if(button.disabled)return;
  if(loadingReplies){form.querySelector('[data-send-error]').textContent='Replies are still loading. Please try again in a moment.';return;}
  const body=form.elements.body.value.trim();if(!body){form.querySelector('[data-send-error]').textContent='Write a reply before posting.';return;}
  button.disabled=true;form.querySelector('[data-send-error]').textContent='';
  try{
    const {data:posted,error}=await supabase.from('forum_replies').insert({topic_id:topic.id,user_id:viewer.id,parent_id:Number(form.elements.parent_id.value)||null,body}).select('id').single();
    if(error)throw error;
    if(posted?.id)notifyForumReply(posted.id);
    form.reset();form.querySelector('[data-replying]').hidden=true;
    showToast('Reply posted.');
    // Reload the visible reply window; preserve chronological ordering and avoid duplicates.
    replies=[];offset=0;await loadReplies();
    if(posted?.id) await revealReply(posted.id);
    const {data}=await supabase.from('forum_topic_summary').select('reply_count').eq('id',topic.id).single();
    if(data)root.querySelector('[data-reply-count]').textContent=data.reply_count;
  }catch(error){form.querySelector('[data-send-error]').textContent=error.message;}
  finally{button.disabled=false;}
}
load();
