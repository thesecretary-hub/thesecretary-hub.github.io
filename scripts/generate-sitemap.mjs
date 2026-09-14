import { readFile, writeFile } from 'node:fs/promises';

const siteUrl = 'https://hub.thesecretary.xyz';
const staticRoutes = ['/', '/posts/', '/forums/', '/status/', '/incidents/', '/maintenance/', '/login/', '/register/', '/sitemap/'];
const config = await readFile(new URL('../site/assets/config.js', import.meta.url), 'utf8');
const supabaseUrl = config.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
const publishableKey = config.match(/supabasePublishableKey:\s*'([^']+)'/)?.[1];
if (!supabaseUrl || !publishableKey) throw new Error('Supabase configuration was not found.');
const endpoint = new URL('/rest/v1/posts', supabaseUrl);
endpoint.searchParams.set('select', 'slug,published_at,updated_at');
endpoint.searchParams.set('status', 'eq.published');
endpoint.searchParams.set('order', 'published_at.desc');
const posts = [];
for (let start = 0; ; start += 1000) {
  const response = await fetch(endpoint, { headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, Range: `${start}-${start + 999}` } });
  if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}: ${await response.text()}`);
  const batch = await response.json();
  posts.push(...batch);
  if (batch.length < 1000) break;
}
const escapeXml = value => String(value).replace(/[<>&'\"]/g, character => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' })[character]);
const entry = (location, lastModified = '') => `  <url><loc>${escapeXml(location)}</loc>${lastModified ? `<lastmod>${escapeXml(lastModified)}</lastmod>` : ''}</url>`;
const urls = [...staticRoutes.map(route => entry(`${siteUrl}${route}`)), ...posts.filter(post => post.slug).map(post => entry(`${siteUrl}/posts/${encodeURIComponent(post.slug)}`, String(post.updated_at || post.published_at || '').slice(0, 10)))];
await writeFile(new URL('../site/sitemap.xml', import.meta.url), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
console.log(`Generated sitemap.xml with ${posts.length} published post${posts.length === 1 ? '' : 's'}.`);
