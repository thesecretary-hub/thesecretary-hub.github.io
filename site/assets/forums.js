import { currentAccount, requireSupabase, supabase } from './supabase-client.js';
import { avatarUrl, esc, mountLayout, relativeTime, showToast } from './layout.js';

const categories = {
  suggestion: ['Suggestion','Ideas that could improve The Secretary.','#a78bfa'],
  bugs: ['Bug & Glitches','Unexpected behaviour and reproducible bugs.','#f59e0b'],
  'website-error': ['Website Error','Problems with the website or dashboard.','#22c55e'],
  'fatal-error': ['Fatal Error','Critical failures requiring attention.','#ef4444'],
  downtime: ['Downtime Discussion','Discuss current and previous disruptions.','#38bdf8'],
};
const root = document.querySelector('[data-forums-root]');
const profile = await mountLayout('forums');
const query = new URLSearchParams(location.search);
const category = categories[query.get('category')] ? query.get('category') : '';
const sort = ['newest','votes'].includes(query.get('sort')) ? query.get('sort') : 'activity';

async function loadTopics() {
  if (!supabase) throw new Error('Community setup is waiting for the Supabase Project URL.');
  let request = supabase.from('forum_topics').select('*, profiles!forum_topics_user_id_fkey(display_name,username,avatar_path)');
  if (category) request = request.eq('category', category);
  request = request.order(sort === 'newest' ? 'created_at' : 'updated_at', { ascending: false }).limit(100);
  const { data: topics, error } = await request;
  if (error) throw error;
  const ids = topics.map((topic) => topic.id);
  const [{ data: replies }, { data: votes }] = ids.length ? await Promise.all([
    supabase.from('forum_replies').select('topic_id').in('topic_id', ids),
    supabase.from('forum_topic_votes').select('topic_id,vote').in('topic_id', ids),
  ]) : [{data:[]},{data:[]}];
  topics.forEach((topic) => {
    topic.reply_count = replies.filter((reply) => reply.topic_id === topic.id).length;
    topic.vote_score = votes.filter((vote) => vote.topic_id === topic.id).reduce((sum, vote) => sum + vote.vote, 0);
  });
  if (sort === 'votes') topics.sort((a,b) => b.vote_score-a.vote_score || new Date(b.updated_at)-new Date(a.updated_at));
  return topics;
}

function topicRow(topic) {
  const info = categories[topic.category] || ['Discussion','', '#888'];
  return `<article class="forum-topic-row"><div class="forum-topic-primary"><button class="avatar-button" data-profile-user="${esc(topic.profiles.username)}"><span class="user-avatar avatar-medium"><img src="${avatarUrl(topic.profiles)}" alt=""></span></button><div><div class="forum-topic-title-line">${topic.status === 'solved' ? '<span class="topic-state solved">✓ Solved</span>' : topic.status === 'closed' ? '<span class="topic-state closed">Closed</span>' : ''}<a href="/topic/?slug=${encodeURIComponent(topic.slug)}">${esc(topic.title)}</a></div><p>${esc(topic.body.slice(0,180))}${topic.body.length > 180 ? '…' : ''}</p><span class="forum-topic-category" style="--category-color:${info[2]}">${info[0]} · by @${esc(topic.profiles.username)}</span></div></div><strong class="forum-stat">${topic.vote_score}</strong><strong class="forum-stat">${topic.reply_count}</strong><time>${relativeTime(topic.updated_at)}</time></article>`;
}

async function render() {
  try {
    const topics = await loadTopics();
    root.innerHTML = `<main class="container page forum-page"><section class="forum-hero"><div><span class="eyebrow">The Secretary community</span><h1>Forums</h1><p>Report what broke, suggest what comes next, and help each other understand what is happening.</p></div>${profile ? '<button class="button primary" type="button" data-open-topic>Start a discussion</button>' : '<a class="button primary" href="/login/?return=/forums/">Log in to post</a>'}</section><div class="forum-layout"><aside class="forum-sidebar"><a class="forum-side-main ${!category ? 'active' : ''}" href="/forums/"><span>◈</span><strong>All discussions</strong><small>${topics.length} shown</small></a><div class="forum-side-title">Categories</div>${Object.entries(categories).map(([key, info]) => `<a class="forum-category-link ${category===key?'active':''}" href="?category=${key}"><span style="--category-color:${info[2]}"></span><div><strong>${info[0]}</strong><small>${info[1]}</small></div></a>`).join('')}<div class="forum-guidance"><strong>Before posting</strong><p>Never post passwords, API keys, or private data.</p></div></aside><section class="forum-feed"><header class="forum-feed-head"><div><strong>${category ? categories[category][0] : 'Latest discussions'}</strong><span>${topics.length} topics</span></div><nav><a class="${sort==='activity'?'active':''}" href="?${category?`category=${category}&`:''}sort=activity">Activity</a><a class="${sort==='newest'?'active':''}" href="?${category?`category=${category}&`:''}sort=newest">Newest</a><a class="${sort==='votes'?'active':''}" href="?${category?`category=${category}&`:''}sort=votes">Top</a></nav></header><div class="forum-topic-columns"><span>Topic</span><span>Votes</span><span>Replies</span><span>Activity</span></div><div class="forum-topic-list">${topics.length ? topics.map(topicRow).join('') : '<div class="community-empty"><span>◇</span><p>No discussions here yet.</p></div>'}</div></section></div></main>`;
    bindComposer();
  } catch (error) { root.innerHTML = `<main class="container page"><div class="flash error">${esc(error.message)}</div></main>`; }
}

function bindComposer() {
  document.querySelector('[data-open-topic]')?.addEventListener('click', () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'topic-dialog';
    dialog.innerHTML = `<form class="topic-form"><header><div><span class="eyebrow">New discussion</span><h2>Start with useful details.</h2></div><button class="dialog-close" type="button">×</button></header><label>Category<select name="category" required>${Object.entries(categories).map(([key,info])=>`<option value="${key}" ${category===key?'selected':''}>${info[0]}</option>`).join('')}</select></label><label>Title<input name="title" required minlength="6" maxlength="160"></label><label>Details<textarea name="body" required minlength="10" maxlength="20000" rows="10"></textarea></label><div class="topic-form-note">Public discussion · do not include credentials.</div><button class="button primary" type="submit">Publish discussion</button></form>`;
    document.body.append(dialog); dialog.showModal();
    dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=async(event)=>{
      event.preventDefault(); const values=Object.fromEntries(new FormData(event.currentTarget));
      const slug=`${values.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,170)}-${Math.random().toString(36).slice(2,7)}`;
      const { data, error }=await requireSupabase().from('forum_topics').insert({user_id:profile.id,category:values.category,title:values.title.trim(),body:values.body.trim(),slug}).select().single();
      if(error)return showToast(error.message,'error'); location.href=`/topic/?slug=${encodeURIComponent(data.slug)}`;
    };
  });
}

render();
