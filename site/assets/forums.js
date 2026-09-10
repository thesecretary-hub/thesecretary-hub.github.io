import { supabase } from './supabase-client.js';
import { avatarUrl, esc, mountLayout, relativeTime } from './layout.js?v=4.5.0';

const categories = {
  suggestion: ['Suggestions', 'Ideas for what comes next.', '#a78bfa'],
  bugs: ['Bugs & glitches', 'Report a problem. Find a fix.', '#f59e0b'],
  'website-error': ['Website help', 'Help with the Hub and dashboard.', '#22c55e'],
  'fatal-error': ['Critical issues', 'Serious failures that need attention.', '#ef4444'],
  downtime: ['Downtime', 'Talk about service disruptions.', '#38bdf8'],
};
const root = document.querySelector('[data-forums-root]');
const viewer = await mountLayout('forums');
let params = new URLSearchParams(location.search);
let category = categories[params.get('category')] ? params.get('category') : '';
let sort = ['newest', 'votes'].includes(params.get('sort')) ? params.get('sort') : 'activity';
let status = ['open', 'solved', 'closed', 'unanswered'].includes(params.get('status')) ? params.get('status') : '';
let search = (params.get('q') || '').slice(0, 120);
let page = Math.max(1, Math.min(100000, Number.parseInt(params.get('page'), 10) || 1));
const pageSize = 20;
function url(changes = {}) {
  const next = new URLSearchParams(params);
  next.delete('page');
  for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key);
  return `/forums/?${next}`;
}
function row(topic) {
  const info = categories[topic.category];
  return `<article class="discussion-row"><div class="discussion-identity"><button class="avatar-button" data-profile-user="${esc(topic.username)}" aria-label="View ${esc(topic.username)}'s profile"><span class="user-avatar avatar-medium"><img src="${avatarUrl(topic)}" alt=""></span></button><div><div class="discussion-tags"><a style="--category-color:${info[2]}" href="${url({category:topic.category})}">${info[0]}</a>${topic.status !== 'open' ? `<span class="state-${topic.status}">${topic.status}</span>` : ''}</div><h2><a href="/topic/?slug=${encodeURIComponent(topic.slug)}">${esc(topic.title)}</a></h2><p>${esc(topic.body.slice(0, 150))}${topic.body.length > 150 ? '…' : ''}</p><small>@${esc(topic.username)} · started ${relativeTime(topic.created_at)}</small></div></div><div class="discussion-number"><strong>${topic.vote_score}</strong><span>votes</span></div><div class="discussion-number"><strong>${topic.reply_count}</strong><span>replies</span></div><div class="discussion-number"><strong>${topic.views}</strong><span>views</span></div><div class="discussion-activity"><time datetime="${esc(topic.updated_at)}">${relativeTime(topic.updated_at)}</time><span>last activity</span></div></article>`;
}
let requestVersion = 0;
function navigate(href, push = true) {
  const next = new URL(href, location.href);
  if (push) history.pushState(null, '', next.pathname + next.search);
  params = new URLSearchParams(next.search);
  category = categories[params.get('category')] ? params.get('category') : '';
  sort = ['newest', 'votes'].includes(params.get('sort')) ? params.get('sort') : 'activity';
  status = ['open', 'solved', 'closed', 'unanswered'].includes(params.get('status')) ? params.get('status') : '';
  search = (params.get('q') || '').slice(0, 120);
  page = Math.max(1, Math.min(100000, Number.parseInt(params.get('page'), 10) || 1));
  const input = root.querySelector('#forum-search');
  if (input) input.value = search;
  render();
}
root.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
  const next = new URL(link.href);
  if (next.origin !== location.origin || next.pathname !== '/forums/') return;
  event.preventDefault();
  let destination = next.href;
  // Compose against current state even when a previous request is still pending.
  if (link.closest('.forum-filters')) destination = url({status:next.searchParams.get('status') || ''});
  else if (link.closest('.forum-feed-head nav')) destination = url({sort:next.searchParams.get('sort')});
  else if (link.closest('.forum-sidebar') || link.closest('.discussion-tags')) destination = url({category:next.searchParams.get('category') || ''});
  else if (link.closest('.forum-pagination')) destination = url({page:next.searchParams.get('page')});
  navigate(destination);
});
root.addEventListener('submit', event => {
  if (!event.target.matches('.forum-search')) return;
  event.preventDefault();
  navigate(url({q: new FormData(event.target).get('q').trim()}));
});
window.addEventListener('popstate', () => navigate(location.href, false));
async function render() {
  const version = ++requestVersion;
  const feed = root.querySelector('.forum-feed');
  if (feed) {
    feed.setAttribute('aria-busy', 'true');
    root.querySelector('[data-feed-notice]').textContent = 'Updating discussions…';
  }
  try {
    if (!supabase) throw new Error('Community connection is not configured.');
    let request = supabase.from('forum_topic_summary').select('*', {count:'exact'});
    if (category) request = request.eq('category', category);
    if (status === 'unanswered') request = request.eq('reply_count', 0).eq('status', 'open');
    else if (status) request = request.eq('status', status);
    if (search.trim()) request = request.ilike('title', `%${search.trim().replace(/[%_\\]/g, '\\$&')}%`);
    const {data, count, error} = await request.order(sort === 'votes' ? 'vote_score' : sort === 'newest' ? 'created_at' : 'updated_at', {ascending:false}).order('id', {ascending:false}).range((page-1)*pageSize, page*pageSize-1);
    if (version !== requestVersion) return;
    if (error) throw error;
    const markup = `<main class="container page forum-page forum-v2"><section class="forum-hero"><div><span class="eyebrow">COMMUNITY / THE SECRETARY</span><h1>A place to talk.</h1><p>Share an idea, work through a problem, or join the conversation.</p></div>${viewer ? '<button class="button primary" data-open-topic>＋ New discussion</button>' : '<a class="button primary" href="/login/?return=/forums/">Log in to start a topic</a>'}</section><div class="forum-layout"><aside class="forum-sidebar"><a class="forum-side-main ${!category?'active':''}" href="${url({category:''})}"><strong>All discussions</strong><span>↗</span></a><div class="forum-side-title">Browse categories</div>${Object.entries(categories).map(([key, info])=>`<a class="forum-category-link ${key===category?'active':''}" href="${url({category:key})}"><span style="--category-color:${info[2]}"></span><div><strong>${info[0]}</strong><small>${info[1]}</small></div></a>`).join('')}<div class="forum-guidance"><strong>Make it a useful conversation.</strong><p>Use a clear title. For bugs, include steps to reproduce and what you expected to happen.</p><p>Keep private information out of public posts.</p></div></aside><section class="forum-feed"><form class="forum-search" action="/forums/">${category?`<input type="hidden" name="category" value="${category}">`:''}<input type="hidden" name="sort" value="${sort}"><input type="hidden" name="status" value="${status}"><label for="forum-search">Search discussions</label><div><input id="forum-search" name="q" type="search" maxlength="120" value="${esc(search)}" placeholder="Find a discussion by title…"><button class="button ghost">Search</button></div></form><header class="forum-feed-head"><div><strong>${category?categories[category][0]:'All discussions'}</strong><span>${count} ${count===1?'topic':'topics'}</span></div><nav aria-label="Sort discussions">${[['activity','Latest activity'],['newest','Newest'],['votes','Top voted']].map(([key,label])=>`<a class="${sort===key?'active':''}" href="${url({sort:key})}">${label}</a>`).join('')}</nav></header><nav class="forum-filters" aria-label="Discussion status">${[['','All'],['unanswered','Unanswered'],['open','Open'],['solved','Solved'],['closed','Closed']].map(([key,label])=>`<a class="${status===key?'active':''}" href="${url({status:key})}">${label}</a>`).join('')}</nav><div class="forum-feed-notice" data-feed-notice role="status" aria-live="polite"></div><div class="discussion-list">${data.length?data.map(row).join(''):'<div class="community-empty"><h2>No discussions found.</h2><p>Try another search or start a new conversation.</p><a href="/forums/">Clear filters</a></div>'}</div><footer class="forum-pagination">${page>1?`<a class="button ghost" href="${url({page:String(page-1)})}">← Previous</a>`:'<span></span>'}<span>Page ${page} of ${Math.max(1,Math.ceil(count/pageSize))}</span>${page*pageSize<count?`<a class="button ghost" href="${url({page:String(page+1)})}">Next →</a>`:'<span></span>'}</footer></section></div></main>`;
    if (!feed) {
      root.innerHTML = markup;
      root.querySelector('[data-open-topic]')?.addEventListener('click', compose);
    } else {
      const template = document.createElement('template');
      template.innerHTML = markup;
      const focusedLink = root.contains(document.activeElement) ? document.activeElement.closest('a')?.getAttribute('href') : null;
      for (const selector of ['.forum-sidebar', '.forum-feed-head', '.forum-filters', '.discussion-list', '.forum-pagination']) {
        root.querySelector(selector).replaceChildren(...template.content.querySelector(selector).childNodes);
      }
      if (focusedLink) [...root.querySelectorAll('a')].find(link => link.getAttribute('href') === focusedLink)?.focus({preventScroll:true});
      root.querySelector('[data-feed-notice]').textContent = '';
      feed.setAttribute('aria-busy', 'false');
    }
  } catch (error) {
    if (version !== requestVersion) return;
    if (feed) {
      feed.setAttribute('aria-busy', 'false');
      const notice = root.querySelector('[data-feed-notice]');
      notice.replaceChildren(document.createTextNode('Could not update discussions. ' + error.message + ' '));
      const retry = document.createElement('button');
      retry.className = 'button small ghost'; retry.textContent = 'Try again'; retry.onclick = render;
      notice.append(retry);
      return;
    }
    root.innerHTML = `<main class="container page"><h1>Forums could not load</h1><p>${esc(error.message)}</p><button class="button primary" data-retry>Try again</button></main>`;
    root.querySelector('[data-retry]').onclick = render;
  }
}
function compose() {
  const dialog = document.createElement('dialog');
  dialog.className = 'topic-dialog';
  dialog.setAttribute('aria-labelledby', 'composer-title');
  dialog.innerHTML = `<form class="topic-form"><header><div><span class="eyebrow">New discussion</span><h2 id="composer-title">Start a conversation.</h2></div><button class="dialog-close" type="button" aria-label="Close">×</button></header><label>Category<select name="category">${Object.entries(categories).map(([key,info])=>`<option value="${key}" ${category===key?'selected':''}>${info[0]}</option>`).join('')}</select></label><label>Title<input name="title" required minlength="6" maxlength="160" placeholder="What would you like to discuss?"></label><label>Your post<textarea name="body" required minlength="10" maxlength="20000" rows="10" placeholder="Include the context others will need to help."></textarea></label><p role="alert" data-form-error></p><button class="button primary" type="submit">Publish discussion</button></form>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.querySelector('form').onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget, button=form.querySelector('[type=submit]');
    const values=Object.fromEntries(new FormData(form));
    if(values.title.trim().length<6 || values.body.trim().length<10) { form.querySelector('[data-form-error]').textContent='Use at least 6 characters for the title and 10 for the post.'; return; }
    button.disabled=true;
    try {
      const slug=`${values.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,145)||'discussion'}-${crypto.randomUUID()}`;
      const {data,error}=await supabase.from('forum_topics').insert({user_id:viewer.id,category:values.category,title:values.title.trim(),body:values.body.trim(),slug}).select('slug').single();
      if(error) throw error;
      location.href=`/topic/?slug=${encodeURIComponent(data.slug)}`;
    } catch(error) { form.querySelector('[data-form-error]').textContent=error.message; button.disabled=false; }
  };
}
render();
