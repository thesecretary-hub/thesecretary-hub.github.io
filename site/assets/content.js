import { statusApi } from './api.js';
import { esc, formatDate, mountLayout } from './layout.js?v=4.1.0';
import { getPostBySlug, safeRichHtml } from './post-store.js';

const root = document.querySelector('[data-content-root]');
const query = new URLSearchParams(location.search);
const postRoute = location.pathname.match(/^\/posts\/([^/]+)\/?$/);
const incidentRoute = location.pathname.match(/^\/incidents\/([^/]+)\/?$/);
const maintenanceRoute = location.pathname.match(/^\/maintenance\/([^/]+)\/?$/);
const type = postRoute ? 'post' : incidentRoute ? 'incident' : maintenanceRoute ? 'maintenance' : query.get('type');
const slug = decodeURIComponent((postRoute || incidentRoute || maintenanceRoute)?.[1] || query.get('slug') || '');
if(type === 'incident' || type === 'maintenance'){
  document.body.classList.add('status-detail-mode');
  const detailStyle = document.createElement('link');
  detailStyle.rel = 'stylesheet';
  detailStyle.href = '/assets/status-detail.css?v=1.1.0';
  document.head.append(detailStyle);
  root.innerHTML = '<main class="status-detail-loader" aria-live="polite"><span></span><p>Loading status report…</p></main>';
}
await mountLayout(type === 'post' ? 'posts' : type === 'incident' ? 'incidents' : '');
try {
  if (!['incident','maintenance','post'].includes(type) || !slug) throw new Error('This page address is incomplete.');
  let item;
  if(type === 'post') item = await getPostBySlug(slug);
  else {
    const cached=sessionStorage.getItem(`status-record:${type}:${slug}`);
    if(cached){try{item=JSON.parse(cached);}catch(error){sessionStorage.removeItem(`status-record:${type}:${slug}`);}}
    if(!item)item=(await statusApi('content', { type, slug })).item;
  }
  if (!item) throw new Error('Page not found.');
  document.title = `${item.title} — The Secretary Hub`;
  if (type === 'post') {
    document.body.classList.add('post-reading-mode');
    const readerStyle = document.createElement('link');
    readerStyle.rel = 'stylesheet';
    readerStyle.href = '/assets/post-reader.css?v=1.1.0';
    document.head.append(readerStyle);
    root.innerHTML = `<main class="post-story-page"><article class="post-story"><img class="post-story-hero" src="${esc(item.full_thumb_url || '/assets/images/post-fallback-full.webp')}" alt=""><header class="post-story-header"><div class="post-story-tag">Posts <span>/</span> The Secretary</div><h1>${esc(item.title)}</h1>${item.excerpt ? `<p>${esc(item.excerpt)}</p>` : ''}<time>${formatDate(item.published_at, { dateStyle: 'long' })}</time></header><div class="post-story-body rich-content">${safeRichHtml(item.content_html || '')}</div></article></main>`;
  } else {
    const source = type === 'incident' ? item.source === 'discord' ? 'Discord API' : item.source === 'http' ? 'TheSecretary.xyz' : 'The Secretary' : 'The Secretary';
    let rows = [];
    if (type === 'incident') {
      rows = [...(item.updates || [])].reverse().map(update => ({label:update.status, message:update.message, time:update.createdAt}));
    } else {
      rows = [
        {label:'Maintenance Conclusion',message:item.conclusionMessage || `Maintenance ${item.status === 'completed' ? 'concluded' : 'is expected to conclude'} at the scheduled end time.`,time:item.endAt},
        ...(item.status === 'active' || item.status === 'completed' ? [{label:'Maintenance Started',message:item.startedMessage || 'Scheduled maintenance is now in progress.',time:item.startAt}] : []),
        {label:'Maintenance Note',message:item.note || item.description || '',time:item.updatedAt || item.createdAt},
        {label:'Maintenance Scheduled',message:item.scheduledMessage || 'Maintenance is scheduled.',time:item.createdAt || item.startAt},
      ];
    }
    root.innerHTML = `<main class="status-detail-page ${type}-detail"><nav><a href="/status/">← Status</a></nav><article><header><h1>${esc(item.title)}</h1><p>${type === 'incident' ? 'Incident report for' : 'Maintenance report for'} ${esc(source)}</p></header><section class="status-detail-timeline">${rows.map(row => `<div class="status-detail-row"><h2>${esc(row.label)}</h2><div><p>${esc(row.message)}</p><time>Posted ${formatDate(row.time, {dateStyle:'medium',timeStyle:'short'})}</time></div></div>`).join('')}</section></article></main>`;
  }
} catch (error) { root.innerHTML = `<main class="container page"><section class="not-found-panel"><span class="eyebrow">404</span><h1>Page unavailable</h1><p>${esc(error.message)}</p><a class="button primary" href="/">Return home</a></section></main>`; }
