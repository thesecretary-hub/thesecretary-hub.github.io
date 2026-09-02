import { statusApi } from './api.js';
import { esc, formatDate, mountLayout, showToast } from './layout.js';

const root = document.querySelector('[data-status-root]');
const percent = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : '—';
const statusClass = (status) => status === 'operational' ? 'good' : status === 'maintenance' ? 'warn' : status === 'unknown' ? 'neutral' : 'bad';
const statusLabel = (status) => status === 'operational' ? 'Operational' : status === 'maintenance' ? 'Maintenance' : status === 'unknown' ? 'Awaiting data' : 'Disruption';

function recordCards(items, type) {
  if (!items?.length) return '<div class="empty-card">Nothing has been published here.</div>';
  return items.map((item) => `<a class="post-card" href="/content/?type=${type}&slug=${encodeURIComponent(item.slug)}"><div><small>${formatDate(item.publishedAt || item.startedAt || item.startAt, {dateStyle:'medium'})}</small><h3>${esc(item.title)}</h3><p>${esc(item.excerpt || item.description || '')}</p><span>Open update →</span></div></a>`).join('');
}

function render(data) {
  const monitor = data.monitor || {};
  const summary = data.summary || {};
  const status = summary.status || monitor.status || 'unknown';
  const response = monitor.response || {};
  root.innerHTML = `<main class="container page status-page" data-status-content>
    <section class="status-hero"><div><span class="eyebrow">Live systems</span><span class="status-pill ${statusClass(status)}"><span class="status-dot"></span>${statusLabel(status)}</span><h1>${esc(summary.headline || 'The Secretary status')}</h1><p>${esc(summary.message || 'Monitoring information is loading.')}</p><small>Last checked ${formatDate(monitor.lastCheckAt)}</small></div><div class="hero-orbit" aria-hidden="true"><span></span><strong>${status === 'operational' ? 'UP' : '!'}</strong></div></section>
    <section class="admin-metrics admin-metrics-4 public-metrics"><article><span>24-hour uptime</span><strong>${percent(monitor.uptime?.['24h'])}</strong><small>Completed checks</small></article><article><span>30-day uptime</span><strong>${percent(monitor.uptime?.['30'])}</strong><small>Measured availability</small></article><article><span>Response</span><strong>${Number.isFinite(Number(monitor.responseMs)) ? `${Math.round(monitor.responseMs)} ms` : '—'}</strong><small>Latest HTTP probe</small></article><article><span>Discord API</span><strong>${data.discordApi?.rateLimited ? 'Rate limited' : esc(data.discordApi?.state || 'Unknown')}</strong><small>Authenticated bot probe</small></article></section>
    <section class="panel"><div class="panel-heading"><div><span class="eyebrow">Response history</span><h2>Last ${Number(response.periodHours || 48)} hours</h2></div><span>${Number(response.samples || 0)} samples</span></div><div class="response-summary"><div><small>Average</small><strong>${Number.isFinite(Number(response.averageMs)) ? `${Math.round(response.averageMs)} ms` : '—'}</strong></div><div><small>Minimum</small><strong>${Number.isFinite(Number(response.minimumMs)) ? `${Math.round(response.minimumMs)} ms` : '—'}</strong></div><div><small>Maximum</small><strong>${Number.isFinite(Number(response.maximumMs)) ? `${Math.round(response.maximumMs)} ms` : '—'}</strong></div></div></section>
    <section class="status-section"><div class="section-heading"><div><span class="eyebrow">Recent reports</span><h2>Incidents</h2></div><a href="/incidents/">View all →</a></div><div class="post-grid">${recordCards(data.incidents, 'incident')}</div></section>
    <section class="status-section"><div class="section-heading"><div><span class="eyebrow">From the team</span><h2>System posts</h2></div><a href="/posts/">View all →</a></div><div class="post-grid">${recordCards(data.posts, 'post')}</div></section>
    <section class="truth-note"><div><span class="truth-icon">✓</span><div><strong>Measured, never estimated</strong><p>Availability figures come from completed five-minute checks.</p></div></div><span>Next automatic check runs independently of this page.</span></section>
  </main>`;
}

async function load() {
  await mountLayout('status');
  try { render(await statusApi('status')); }
  catch (error) {
    root.innerHTML = `<main class="container page"><section class="not-found-panel"><span class="eyebrow">Monitor connection</span><h1>Live data is temporarily unavailable.</h1><p>${esc(error.message)}</p><button class="button primary" data-retry>Retry</button></section></main>`;
    root.querySelector('[data-retry]').onclick = load;
  }
}

document.querySelector('[data-subscribe-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try { await statusApi('subscribe', { email: new FormData(event.currentTarget).get('email') }); showToast('Subscription confirmed.'); event.currentTarget.reset(); }
  catch (error) { showToast(error.message, 'error'); }
  finally { button.disabled = false; }
});

load();
