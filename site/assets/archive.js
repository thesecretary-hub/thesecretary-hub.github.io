import { statusApi } from './api.js';
import { esc, formatDate, mountLayout } from './layout.js?v=3.9.0';
import { FALLBACK_POST, getPublishedPosts, postHref } from './post-store.js';

const root = document.querySelector('[data-archive-root]');
const type = document.body.dataset.archive;
const singular = { incidents: 'incident', maintenance: 'maintenance', posts: 'post' }[type];
const titles = { incidents: 'Incident history', maintenance: 'Maintenance', posts: 'System posts' };

await mountLayout(type === 'posts' ? 'posts' : type === 'incidents' ? 'incidents' : '');
try {
  if (type === 'posts') {
    const archiveStyle = document.createElement('link');
    archiveStyle.rel = 'stylesheet';
    archiveStyle.href = '/assets/post-archive.css?v=1.0.0';
    document.head.append(archiveStyle);
    const loaded = await getPublishedPosts(60).catch(() => []);
    const items = loaded.length ? loaded : [FALLBACK_POST];
    root.innerHTML = `<main class="post-index-page"><div class="post-archive-grid">${items.map((item) => `<a class="post-archive-card" href="${postHref(item)}"><img src="${esc(item.poster_url || FALLBACK_POST.poster_url)}" alt=""><div><p class="post-card-meta"><strong>The Secretary</strong><time>${formatDate(item.published_at, {dateStyle:'long'})}</time></p><h2>${esc(item.title)}</h2></div></a>`).join('')}</div></main>`;
  } else {
  const data = await statusApi('archive', { type });
  (data.items||[]).forEach(item=>sessionStorage.setItem(`status-record:${singular}:${item.slug}`,JSON.stringify(item)));
  root.innerHTML = `<main class="container page archive-page ${singular}-archive"><header class="archive-hero"><span class="eyebrow">The Secretary systems</span><h1>${titles[type]}</h1><p>A permanent public record maintained by the monitoring service.</p></header><div class="archive-list">${data.items?.length ? data.items.map((item) => `<a class="archive-row ${singular}" href="/${type}/${encodeURIComponent(item.slug)}"><div><span class="status-pill ${item.status === 'resolved' || item.status === 'completed' ? 'good' : 'warn'}">${esc(item.status || 'Published')}</span><h2>${esc(item.title)}</h2><p>${esc(item.excerpt || item.description || '')}</p></div><time>${formatDate(item.publishedAt || item.startedAt || item.startAt)}</time></a>`).join('') : '<div class="community-empty"><p>No records have been published.</p></div>'}</div></main>`;
  }
} catch (error) { root.innerHTML = `<main class="container page"><div class="flash error">${esc(error.message)}</div></main>`; }
