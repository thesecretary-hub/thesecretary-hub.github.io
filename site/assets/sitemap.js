import { esc, formatDate, mountLayout } from './layout.js?v=4.5.0';
import { postHref } from './post-store.js?v=1.1.0';
import { supabase } from './supabase-client.js';

await mountLayout('');
const host = document.querySelector('[data-sitemap-posts]');
try {
  const posts = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from('posts').select('slug,title,excerpt,published_at').eq('status', 'published').order('published_at', { ascending: false }).range(start, start + 999);
    if (error) throw error;
    posts.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  host.innerHTML = posts.length ? posts.map(post => `<a class="sitemap-post" href="${esc(postHref(post))}"><span><strong>${esc(post.title)}</strong>${post.excerpt ? `<small>${esc(post.excerpt)}</small>` : ''}</span><time>${formatDate(post.published_at, { dateStyle: 'medium' })}</time></a>`).join('') : '<p class="sitemap-empty">No published posts yet.</p>';
} catch (error) { host.innerHTML = '<p class="sitemap-empty">Published posts could not be loaded.</p>'; }
