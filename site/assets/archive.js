import { statusApi } from './api.js';
import { esc, formatDate, mountLayout } from './layout.js';

const root = document.querySelector('[data-archive-root]');
const type = document.body.dataset.archive;
const singular = { incidents: 'incident', maintenance: 'maintenance', posts: 'post' }[type];
const titles = { incidents: 'Incident history', maintenance: 'Maintenance', posts: 'System posts' };

await mountLayout(type === 'posts' ? 'posts' : type === 'incidents' ? 'incidents' : '');
try {
  const data = await statusApi('archive', { type });
  root.innerHTML = `<main class="container page archive-page"><header class="archive-hero"><span class="eyebrow">The Secretary systems</span><h1>${titles[type]}</h1><p>A permanent public record maintained by the monitoring service.</p></header><div class="archive-list">${data.items?.length ? data.items.map((item) => `<a class="archive-row" href="/content/?type=${singular}&slug=${encodeURIComponent(item.slug)}"><div><span class="status-pill ${item.status === 'resolved' || item.status === 'completed' ? 'good' : 'warn'}">${esc(item.status || 'Published')}</span><h2>${esc(item.title)}</h2><p>${esc(item.excerpt || item.description || '')}</p></div><time>${formatDate(item.publishedAt || item.startedAt || item.startAt)}</time></a>`).join('') : '<div class="community-empty"><p>No records have been published.</p></div>'}</div></main>`;
} catch (error) { root.innerHTML = `<main class="container page"><div class="flash error">${esc(error.message)}</div></main>`; }
