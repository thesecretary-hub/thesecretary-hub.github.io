import { statusApi } from './api.js';
import { esc, formatDate, mountLayout, showToast } from './layout.js';
import { getPublishedPosts, postDate, postHref } from './post-store.js';

const root = document.querySelector('[data-status-root]');
const percent = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : '—';
const statusClass = (status) => status === 'operational' ? 'good' : status === 'maintenance' ? 'warn' : status === 'unknown' ? 'neutral' : 'bad';
const statusLabel = (status) => status === 'operational' ? 'Operational' : status === 'maintenance' ? 'Maintenance' : status === 'unknown' ? 'Awaiting data' : 'Disruption';

function recordCards(items, type) {
  if (!items?.length) return '<div class="empty-card">Nothing has been published here.</div>';
  return items.map((item) => `<a class="post-card" href="/content/?type=${type}&slug=${encodeURIComponent(item.slug)}"><div><small>${formatDate(item.publishedAt || item.startedAt || item.startAt, {dateStyle:'medium'})}</small><h3>${esc(item.title)}</h3><p>${esc(item.excerpt || item.description || '')}</p><span>Open update →</span></div></a>`).join('');
}

function postReader(items = []) {
  if (!items.length) return '<div class="empty-card">Nothing has been published here.</div>';
  const [featured, ...recent] = items;
  return `<div class="post-reader-layout"><aside class="recent-post-rail"><div><span class="eyebrow">From the team</span><h3>Recent posts</h3></div>${items.slice(0, 5).map((item, index) => `<a href="${postHref(item)}" class="recent-post ${index === 0 ? 'current' : ''}"><small>0${index + 1}</small><span><b>${esc(item.title)}</b><em>${formatDate(postDate(item), { dateStyle: 'medium' })}</em></span><i>↗</i></a>`).join('')}</aside><a class="featured-post-read" href="${postHref(featured)}"><span class="eyebrow">Latest dispatch</span><time>${formatDate(postDate(featured), { dateStyle: 'long' })}</time><h3>${esc(featured.title)}</h3><p>${esc(featured.excerpt || featured.description || '')}</p><span class="featured-link">Read full post <b>→</b></span></a></div>`;
}

function render(data) {
  const monitor = data.monitor || {};
  const summary = data.summary || {};
  const status = summary.status || monitor.status || 'unknown';
  const response = monitor.response || {};
  root.innerHTML = `<main class="container page status-page" data-status-content>
    <section class="status-hero status-cinema ${statusClass(status)}"><div class="hero-copy"><div class="hero-overline"><span class="eyebrow">The Secretary / System control</span><span class="hero-live"><i></i> Live telemetry</span></div><span class="status-pill ${statusClass(status)}"><span class="status-dot"></span>${statusLabel(status)}</span><h1>${esc(summary.headline || 'All systems are ready.')}</h1><p>${esc(summary.message || 'Real-time availability for every Secretary service, measured independently.')}</p><small>Last checked ${formatDate(monitor.lastCheckAt)}</small><form class="hero-subscribe" data-subscribe-form><label for="hero-email">Status notifications</label><div><input id="hero-email" type="email" name="email" required placeholder="you@example.com"><button class="button primary" type="submit">Subscribe</button></div></form></div><div class="hero-orbit" aria-hidden="true"><span class="orbit-ring orbit-ring-one"></span><span class="orbit-ring orbit-ring-two"></span><strong>${status === 'operational' ? 'UP' : '!'}</strong><b>SYS<br>LIVE</b></div><div class="hero-index" aria-hidden="true">01</div></section>
    <section class="admin-metrics admin-metrics-4 public-metrics reveal"><article><span>24-hour uptime</span><strong>${percent(monitor.uptime?.['24h'])}</strong><small>Completed checks</small></article><article><span>30-day uptime</span><strong>${percent(monitor.uptime?.['30'])}</strong><small>Measured availability</small></article><article><span>Response</span><strong>${Number.isFinite(Number(monitor.responseMs)) ? `${Math.round(monitor.responseMs)} ms` : '—'}</strong><small>Latest HTTP probe</small></article><article><span>Discord API</span><strong>${data.discordApi?.rateLimited ? 'Rate limited' : esc(data.discordApi?.state || 'Unknown')}</strong><small>Authenticated bot probe</small></article></section>
    <section class="panel telemetry-panel reveal"><div class="panel-heading"><div><span class="eyebrow">Response history</span><h2>Last ${Number(response.periodHours || 48)} hours</h2></div><span>${Number(response.samples || 0)} samples</span></div><div class="response-summary"><div><small>Average</small><strong>${Number.isFinite(Number(response.averageMs)) ? `${Math.round(response.averageMs)} ms` : '—'}</strong></div><div><small>Minimum</small><strong>${Number.isFinite(Number(response.minimumMs)) ? `${Math.round(response.minimumMs)} ms` : '—'}</strong></div><div><small>Maximum</small><strong>${Number.isFinite(Number(response.maximumMs)) ? `${Math.round(response.maximumMs)} ms` : '—'}</strong></div></div></section>
    <section class="status-section reveal"><div class="section-heading"><div><span class="eyebrow">Recent reports</span><h2>Incidents</h2></div><a href="/incidents/">View all <b>→</b></a></div><div class="post-grid">${recordCards(data.incidents, 'incident')}</div></section>
    <section class="status-section post-reader-section reveal"><div class="section-heading"><div><span class="eyebrow">Dispatches</span><h2>System posts</h2></div><a href="/posts/">View all <b>→</b></a></div>${postReader(data.posts)}</section>
  </main>`;
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: .12 });
  root.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
}

async function load() {
  await mountLayout('status');
  try { const data = await statusApi('status'); data.posts = await getPublishedPosts(6).catch(() => []); render(data); }
  catch (error) {
    root.innerHTML = `<main class="container page"><section class="not-found-panel"><span class="eyebrow">Monitor connection</span><h1>Live data is temporarily unavailable.</h1><p>${esc(error.message)}</p><button class="button primary" data-retry>Retry</button></section></main>`;
    root.querySelector('[data-retry]').onclick = load;
  }
}

document.addEventListener('submit', async (event) => {
  if (!event.target.matches('[data-subscribe-form]')) return;
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button');
  button.disabled = true;
  try { await statusApi('subscribe', { email: new FormData(form).get('email') }); showToast('Subscription confirmed.'); form.reset(); }
  catch (error) { showToast(error.message, 'error'); }
  finally { button.disabled = false; }
});

load();
