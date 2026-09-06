import { statusApi } from './api.js';
import { esc, formatDate, mountLayout } from './layout.js';
import { getPostBySlug, safeRichHtml } from './post-store.js';

const root = document.querySelector('[data-content-root]');
const query = new URLSearchParams(location.search);
const postRoute = location.pathname.match(/^\/posts\/([^/]+)\/?$/);
const type = postRoute ? 'post' : query.get('type');
const slug = postRoute ? decodeURIComponent(postRoute[1]) : query.get('slug');
await mountLayout(type === 'post' ? 'posts' : type === 'incident' ? 'incidents' : '');
try {
  if (!['incident','maintenance','post'].includes(type) || !slug) throw new Error('This page address is incomplete.');
  const item = type === 'post' ? await getPostBySlug(slug) : (await statusApi('content', { type, slug })).item;
  if (!item) throw new Error('Page not found.');
  document.title = `${item.title} — The Secretary Hub`;
  if (type === 'post') {
    document.body.classList.add('post-reading-mode');
    const readerStyle = document.createElement('link');
    readerStyle.rel = 'stylesheet';
    readerStyle.href = '/assets/post-reader.css?v=1.0.0';
    document.head.append(readerStyle);
    root.innerHTML = `<main class="post-story-page"><article class="post-story"><img class="post-story-hero" src="${esc(item.full_thumb_url || '/assets/images/post-fallback-full.webp')}" alt=""><header class="post-story-header"><div class="post-story-tag">Posts <span>/</span> The Secretary</div><h1>${esc(item.title)}</h1>${item.excerpt ? `<p>${esc(item.excerpt)}</p>` : ''}<time>${formatDate(item.published_at, { dateStyle: 'long' })}</time></header><div class="post-story-body rich-content">${safeRichHtml(item.content_html || '')}</div></article><section data-comments data-post-slug="${esc(slug)}"></section></main>`;
    await import('./comments.js');
  } else {
    root.innerHTML = `<main class="container page content-page"><nav class="topic-breadcrumb"><a href="/${type === 'incident' ? 'incidents' : 'maintenance'}/">Back to archive</a></nav><article class="content-article"><header><span class="eyebrow">${esc(type)}</span><h1>${esc(item.title)}</h1><p>${esc(item.description || '')}</p><time>${formatDate(item.publishedAt || item.startedAt || item.startAt)}</time></header><div class="rich-content">${item.contentHtml || `<p>${esc(item.description || '')}</p>`}</div>${Array.isArray(item.updates) ? `<section class="incident-timeline"><h2>Timeline</h2>${item.updates.map((update) => `<article><strong>${esc(update.status)}</strong><p>${esc(update.message)}</p><time>${formatDate(update.createdAt)}</time></article>`).join('')}</section>` : ''}</article></main>`;
  }
} catch (error) { root.innerHTML = `<main class="container page"><section class="not-found-panel"><span class="eyebrow">404</span><h1>Page unavailable</h1><p>${esc(error.message)}</p><a class="button primary" href="/">Return home</a></section></main>`; }
