import { statusApi } from './api.js';
import { esc, formatDate, mountLayout } from './layout.js';
import { getPostBySlug, safeRichHtml } from './post-store.js';

const root = document.querySelector('[data-content-root]');
const query = new URLSearchParams(location.search);
const type = query.get('type');
const slug = query.get('slug');
await mountLayout(type === 'post' ? 'posts' : type === 'incident' ? 'incidents' : '');
try {
  if (!['incident','maintenance','post'].includes(type) || !slug) throw new Error('This page address is incomplete.');
  const item = type === 'post' ? await getPostBySlug(slug) : (await statusApi('content', { type, slug })).item;
  if (!item) throw new Error('Page not found.');
  document.title = `${item.title} — The Secretary Hub`;
  root.innerHTML = `<main class="container page content-page"><nav class="topic-breadcrumb"><a href="/${type === 'post' ? 'posts' : type === 'incident' ? 'incidents' : 'maintenance'}/">Back to archive</a></nav><article class="content-article">${type === 'post' && item.full_thumb_url ? `<img class="content-cover" src="${esc(item.full_thumb_url)}" alt="">` : ''}<header><span class="eyebrow">${esc(type)}</span><h1>${esc(item.title)}</h1><p>${esc(item.excerpt || item.description || '')}</p><time>${formatDate(item.published_at || item.publishedAt || item.startedAt || item.startAt)}</time></header><div class="rich-content">${type === 'post' ? safeRichHtml(item.content_html) : item.contentHtml || `<p>${esc(item.description || '')}</p>`}</div>${Array.isArray(item.updates) ? `<section class="incident-timeline"><h2>Timeline</h2>${item.updates.map((update) => `<article><strong>${esc(update.status)}</strong><p>${esc(update.message)}</p><time>${formatDate(update.createdAt)}</time></article>`).join('')}</section>` : ''}</article><section data-comments data-post-slug="${esc(slug)}"></section></main>`;
  if (type === 'post') await import('./comments.js');
} catch (error) { root.innerHTML = `<main class="container page"><section class="not-found-panel"><span class="eyebrow">404</span><h1>Page unavailable</h1><p>${esc(error.message)}</p><a class="button primary" href="/">Return home</a></section></main>`; }
