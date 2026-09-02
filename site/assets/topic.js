import { currentAccount, requireSupabase, supabase } from './supabase-client.js';
import { avatarUrl, esc, formatDate, mountLayout, showToast } from './layout.js';

const categories={suggestion:['Suggestion','#a78bfa'],bugs:['Bug & Glitches','#f59e0b'],'website-error':['Website Error','#22c55e'],'fatal-error':['Fatal Error','#ef4444'],downtime:['Downtime Discussion','#38bdf8']};
const root=document.querySelector('[data-topic-root]');
const viewer=await mountLayout('forums');
const slug=new URLSearchParams(location.search).get('slug');

async function getTopic(){
  if(!supabase||!slug)throw new Error('Discussion address is incomplete.');
  const {data:topic,error}=await supabase.from('forum_topics').select('*, profiles!forum_topics_user_id_fkey(display_name,username,avatar_path)').eq('slug',slug).maybeSingle();
  if(error||!topic)throw new Error('Discussion not found.');
  await supabase.rpc('increment_topic_views',{target_id:topic.id});
  const [{data:replies},{data:topicVotes}]=await Promise.all([
    supabase.from('forum_replies').select('*, profiles!forum_replies_user_id_fkey(display_name,username,avatar_path)').eq('topic_id',topic.id).order('created_at'),
    supabase.from('forum_topic_votes').select('*').eq('topic_id',topic.id),
  ]);
  const replyIds=replies.map(reply=>reply.id);
  const {data:replyVotes=[]}=replyIds.length
    ? await supabase.from('forum_reply_votes').select('*').in('reply_id',replyIds)
    : {data:[]};
  topic.vote_score=topicVotes.reduce((sum,item)=>sum+item.vote,0);
  replies.forEach(reply=>reply.vote_score=replyVotes.filter(v=>v.reply_id===reply.id).reduce((sum,v)=>sum+v.vote,0));
  return {topic,replies};
}

function avatar(profile){return `<button class="avatar-button" data-profile-user="${esc(profile.username)}"><span class="user-avatar avatar-large"><img src="${avatarUrl(profile)}" alt=""></span></button>`;}

async function render(){
  try{
    const {topic,replies}=await getTopic(); const cat=categories[topic.category]||['Discussion','#888']; const own=viewer?.id===topic.user_id;
    root.innerHTML=`<main class="container page topic-page"><nav class="topic-breadcrumb"><a href="/forums/">Forums</a><span>›</span><a href="/forums/?category=${topic.category}">${cat[0]}</a></nav><header class="topic-title-block"><div><span class="forum-topic-category" style="--category-color:${cat[1]}">${cat[0]}</span><h1>${esc(topic.title)}</h1><p>Started by <button data-profile-user="${esc(topic.profiles.username)}">@${esc(topic.profiles.username)}</button></p></div><div class="topic-head-meta"><strong>${replies.length}</strong><span>replies</span><strong>${topic.views+1}</strong><span>views</span></div></header><div class="topic-discussion"><article class="forum-message op-message" id="original-post"><aside>${avatar(topic.profiles)}<strong>${esc(topic.profiles.display_name)}</strong><span>@${esc(topic.profiles.username)}</span><small>Original poster</small></aside><div class="forum-message-content"><header><span>Original post</span><time>${formatDate(topic.created_at)}</time></header><div class="forum-copy">${esc(topic.body).replace(/\n/g,'<br>')}</div><footer><div class="vote-control"><button data-vote-topic="1" ${!viewer?'disabled':''}>▲</button><strong>${topic.vote_score}</strong><button data-vote-topic="-1" ${!viewer?'disabled':''}>▼</button></div>${own?`<button class="button small ghost" data-toggle-topic>${topic.status==='closed'?'Reopen discussion':'Close discussion'}</button>`:''}</footer></div></article>${replies.map(reply=>`<article class="forum-message ${reply.parent_id?'nested-reply':''} ${topic.solution_reply_id===reply.id?'solution-reply':''}" id="reply-${reply.id}"><aside>${avatar(reply.profiles)}<strong>${esc(reply.profiles.display_name)}</strong><span>@${esc(reply.profiles.username)}</span>${reply.user_id===topic.user_id?'<small>Original poster</small>':''}</aside><div class="forum-message-content"><header>${topic.solution_reply_id===reply.id?'<span class="solution-label">✓ Accepted solution</span>':'<span>Reply</span>'}<time>${formatDate(reply.created_at)}</time></header><div class="forum-copy">${reply.is_deleted?'<em>This reply was deleted.</em>':esc(reply.body).replace(/\n/g,'<br>')}</div><footer><div class="vote-control"><button data-vote-reply="${reply.id}:1" ${!viewer?'disabled':''}>▲</button><strong>${reply.vote_score}</strong><button data-vote-reply="${reply.id}:-1" ${!viewer?'disabled':''}>▼</button></div>${viewer&&topic.status!=='closed'?`<button data-reply-to="${reply.id}" data-reply-name="${esc(reply.profiles.display_name)}">Reply</button>`:''}${own&&topic.solution_reply_id!==reply.id?`<button class="solution-button" data-solution="${reply.id}">Mark as solution</button>`:''}</footer></div></article>`).join('')}</div>${viewer&&topic.status!=='closed'?`<section class="reply-composer"><div class="replying-to" data-replying hidden>Replying to <strong></strong><button data-clear-reply>×</button></div><form data-reply-form><input type="hidden" name="parent_id" value=""><div>${avatar(viewer)}<strong>Join the discussion</strong></div><textarea name="body" maxlength="10000" rows="6" required></textarea><footer><small>Replies are public.</small><button class="button primary">Post reply</button></footer></form></section>`:'<div class="comment-login-callout"><strong>Log in to reply or vote.</strong><a class="button primary" href="/login/">Log in</a></div>'}</main>`;
    bind(topic);
  }catch(error){root.innerHTML=`<main class="container page"><section class="not-found-panel"><h1>Discussion unavailable</h1><p>${esc(error.message)}</p><a class="button primary" href="/forums/">Return to forums</a></section></main>`;}
}

function bind(topic){
  root.querySelectorAll('[data-vote-topic]').forEach(button=>button.onclick=()=>vote('forum_topic_votes',{topic_id:topic.id,user_id:viewer.id,vote:Number(button.dataset.voteTopic)}));
  root.querySelectorAll('[data-vote-reply]').forEach(button=>button.onclick=()=>{const[id,vote]=button.dataset.voteReply.split(':');vote('forum_reply_votes',{reply_id:Number(id),user_id:viewer.id,vote:Number(vote)});});
  async function vote(table,row){const{error}=await requireSupabase().from(table).upsert(row);if(error)showToast(error.message,'error');else render();}
  root.querySelector('[data-toggle-topic]')?.addEventListener('click',async()=>{const{error}=await supabase.from('forum_topics').update({status:topic.status==='closed'?'open':'closed'}).eq('id',topic.id);if(error)showToast(error.message,'error');else render();});
  root.querySelectorAll('[data-solution]').forEach(button=>button.onclick=async()=>{const{error}=await supabase.from('forum_topics').update({status:'solved',solution_reply_id:Number(button.dataset.solution)}).eq('id',topic.id);if(error)showToast(error.message,'error');else render();});
  root.querySelectorAll('[data-reply-to]').forEach(button=>button.onclick=()=>{const form=root.querySelector('[data-reply-form]');form.parent_id.value=button.dataset.replyTo;const note=root.querySelector('[data-replying]');note.hidden=false;note.querySelector('strong').textContent=button.dataset.replyName;form.scrollIntoView({behavior:'smooth'});});
  root.querySelector('[data-clear-reply]')?.addEventListener('click',()=>{root.querySelector('[data-reply-form]').parent_id.value='';root.querySelector('[data-replying]').hidden=true;});
  root.querySelector('[data-reply-form]')?.addEventListener('submit',async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));const{error}=await supabase.from('forum_replies').insert({topic_id:topic.id,user_id:viewer.id,parent_id:values.parent_id?Number(values.parent_id):null,body:values.body.trim()});if(error)showToast(error.message,'error');else render();});
}
render();
