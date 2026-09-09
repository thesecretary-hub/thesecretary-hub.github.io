import { statusApi } from './api.js?v=6.5.0';
import { esc, formatDate, mountLayout } from './layout.js?v=4.3.0';

const root = document.querySelector('[data-status-root]');
document.body.classList.add('status-public-mode');

const stateClass = (state) => state === 'operational' ? 'operational' : state === 'maintenance' || state === 'degraded' ? 'degraded' : state === 'unknown' ? 'unknown' : 'outage';
const stateLabel = (state) => state === 'operational' ? 'Operational' : state === 'maintenance' || state === 'degraded' ? 'Degraded' : state === 'unknown' ? 'Awaiting data' : 'Disruption';
const STATUS_TIME_ZONE = 'Asia/Kolkata';
const dayKey = (value) => {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:STATUS_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const statusDateAtOffset = (offset = 0) => {
  const [year, month, day] = dayKey(new Date()).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() - offset);
  return date;
};
const defaultServers = [
  ['virginia','The-Secretary Virginia US','Virginia US'],
  ['singapore_n1','The-Secretary Singapore N-1','Singapore N-1'],
  ['singapore_n2','The-Secretary Singapore N-2','Singapore N-2'],
  ['frankfurt','The-Secretary Frankfurt EU','Frankfurt EU'],
  ['ohio','The-Secretary Ohio US','Ohio US'],
].map(([key,name,region]) => ({key,name,region,status:'operational',label:'Operational'}));

function eventsForServiceDay(kind, date, events = []) {
  if(kind === 'server') return [];
  return events.filter(event => {
    if(dayKey(new Date(event.startedAt || event.startAt)) !== dayKey(date)) return false;
    if(event.recordType === 'maintenance') return true;
    return kind === 'discord' ? event.source === 'discord' : event.source !== 'discord';
  });
}

function serviceHistory(service, monitor, events = []) {
  return Array.from({length: 90}, (_, index) => {
    const date = statusDateAtOffset(89 - index);
    let state = 'operational';
    let uptimeValue = 100;
    if(service.kind !== 'server'){
      const dailyEvents=eventsForServiceDay(service.kind,date,events);
      const incident=dailyEvents.find(event=>event.recordType==='incident'&&(service.kind==='discord'?event.source==='discord':event.source!=='discord'));
      const maintenance=dailyEvents.find(event=>event.recordType==='maintenance');
      if(incident){state=incident.impact==='critical'||incident.impact==='major'?'outage':'degraded';uptimeValue=null;}
      else if(maintenance){state='degraded';uptimeValue=null;}
    }
    if (index === 89 && service.state !== 'operational') state = service.state;
    const value = uptimeValue === null || uptimeValue === undefined ? stateLabel(state) : `${Number(uptimeValue).toFixed(3)}%`;
    return `<i class="${stateClass(state)}" data-history-kind="${service.kind}" data-history-day="${dayKey(date)}" data-history-date="${esc(formatDate(date, {dateStyle:'long'}))}" data-history-value="${esc(value)}"></i>`;
  }).join('');
}

function serviceRow(service, monitor, events) {
  const detail = service.offlineUntil ? ` until ${formatDate(service.offlineUntil, {dateStyle:'medium',timeStyle:'short'})}` : '';
  return `<article class="status-service"><div class="status-service-head"><h2>${esc(service.name)}</h2><span class="${stateClass(service.state)}">${esc(service.label || stateLabel(service.state))}${esc(detail)}</span></div><div class="status-history" aria-label="90-day status history">${serviceHistory(service, monitor, events)}</div><div class="status-history-foot"><span>90 days ago</span><b></b><span>${service.kind === 'server' ? '100.0% uptime' : service.uptime === null || service.uptime === undefined ? 'No outages recorded' : `${Number(service.uptime).toFixed(2)}% uptime`}</span><b></b><span>Today</span></div></article>`;
}

function incidentDays(incidents = [], maintenance = []) {
  const records = [...incidents.map((item) => ({...item, recordType:'incident', recordAt:item.startedAt || item.updatedAt})), ...maintenance.map((item) => ({...item, recordType:'maintenance', recordAt:item.startAt || item.updatedAt}))];
  return Array.from({length:15}, (_, index) => {
    const date = statusDateAtOffset(index);
    const daily = records.filter((item) => dayKey(new Date(item.recordAt)) === dayKey(date));
    const body = daily.length ? daily.map((item) => {
      if (item.recordType === 'maintenance') return `<a class="status-record maintenance" href="/maintenance/${encodeURIComponent(item.slug)}"><h4>${esc(item.title)}</h4><p><strong>${esc(item.status || 'Scheduled')}</strong> - ${esc(item.note || item.description || item.excerpt || '')}</p><time>${formatDate(item.startAt, {dateStyle:'medium',timeStyle:'short'})}</time></a>`;
      const updates = [...(item.updates || [])].reverse();
      return `<a class="status-record incident" href="/incidents/${encodeURIComponent(item.slug)}"><h4>${esc(item.title)}</h4>${updates.map((update) => `<p><strong>${esc(update.status)}</strong> - ${esc(update.message)}</p><time>${formatDate(update.createdAt, {dateStyle:'medium',timeStyle:'short'})}</time>`).join('')}</a>`;
    }).join('') : `<p class="no-incidents">${index === 0 ? 'No incidents reported today.' : 'No incidents reported.'}</p>`;
    return `<section class="incident-day"><h3>${formatDate(date, {dateStyle:'medium',timeZone:STATUS_TIME_ZONE})}</h3>${body}</section>`;
  }).join('');
}

function chartMarkup() {
  return `<section class="metrics-section"><header><span>System metrics</span><nav aria-label="Response period"><button class="active" data-chart-range="day">Day</button><button data-chart-range="week">Week</button><button data-chart-range="month">Month</button></nav></header><div class="response-chart"><div class="response-chart-title"><h2>Response Time</h2><strong data-chart-latest>—</strong></div><div class="response-chart-hover" data-chart-tooltip hidden></div><svg data-response-chart viewBox="0 0 820 190" role="img" aria-label="Response time graph"></svg></div></section>`;
}

function durationText(startValue, endValue) {
  const start = new Date(startValue).getTime();
  const end = endValue ? new Date(endValue).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Duration unavailable';
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  return `${hours} hrs ${minutes % 60} mins`;
}

function historyTooltip(bar, data) {
  const source = data.historyEvents || [...(data.incidents || []).map(item=>({...item,recordType:'incident'})),...(data.maintenance || []).map(item=>({...item,recordType:'maintenance'}))];
  const relevant=eventsForServiceDay(bar.dataset.historyKind,new Date(`${bar.dataset.historyDay}T00:00:00Z`),source);
  const incidents = relevant.filter(item => item.recordType === 'incident').map(item => ({label:item.impact === 'critical' || item.impact === 'major' ? 'Major outage' : 'Partial outage', duration:durationText(item.startedAt, item.resolvedAt)}));
  const maintenance = relevant.filter(item => item.recordType === 'maintenance').map(item => ({label:'Maintenance', duration:durationText(item.startAt, item.status === 'completed' ? item.endAt : null)}));
  const events = [...incidents, ...maintenance];
  if (!events.length) return `<span>${esc(bar.dataset.historyDate)}</span><strong>${esc(bar.dataset.historyValue)}</strong>`;
  return `<span>${esc(bar.dataset.historyDate)}</span><div class="history-tooltip-events">${events.map(event => `<p><b>${event.label === 'Major outage' ? '×' : event.label === 'Maintenance' ? '●' : '▲'}</b><strong>${esc(event.label)}</strong><em>${esc(event.duration)}</em></p>`).join('')}</div><small>Related</small><div class="history-tooltip-related">The Secretary was not responding</div>`;
}

function smoothChartPath(series,x,y) {
  const points=series.map((item,index)=>({x:x(index),y:y(Number(item.responseMs))}));
  if(points.length===1)return `M${points[0].x},${points[0].y}`;
  return points.slice(1).reduce((path,point,index)=>{const previous=points[index];const middle=(previous.x+point.x)/2;return `${path} C${middle.toFixed(1)},${previous.y.toFixed(1)} ${middle.toFixed(1)},${point.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;},`M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`);
}

function drawChart(data, range = 'day') {
  const svg = root.querySelector('[data-response-chart]');
  const tooltip = root.querySelector('[data-chart-tooltip]');
  tooltip.hidden = true;
  const storedSeries = data.monitor?.response?.series;
  const source = (Array.isArray(storedSeries) ? storedSeries : storedSeries?.[range] || storedSeries?.month || storedSeries?.week || storedSeries?.day) || [];
  const hours = {day:24,week:24*7,month:24*30}[range] || 24;
  const newestAt = source.length ? new Date(source[source.length-1].checkedAt).getTime() : Date.now();
  const cutoff = newestAt - hours * 3600000;
  const series = source.filter(item => new Date(item.checkedAt).getTime() >= cutoff);
  const latest = series[series.length - 1];
  root.querySelector('[data-chart-latest]').textContent = latest ? `${Math.round(latest.responseMs)} ms` : 'No data';
  if (!series.length) { svg.innerHTML = '<text x="410" y="100" text-anchor="middle">Response samples will appear after scheduled checks run.</text>'; return; }
  const values = series.map((item) => Number(item.responseMs));
  const low = Math.max(0, Math.floor(Math.min(...values) / 50) * 50 - 50);
  const high = Math.max(low + 100, Math.ceil(Math.max(...values) / 50) * 50 + 50);
  const x = (index) => 20 + index / Math.max(1, series.length - 1) * 730;
  const y = (value) => 155 - (value - low) / (high - low) * 120;
  const path = smoothChartPath(series,x,y);
  const lines = [0,.33,.66,1].map((part) => { const py=35+part*120; const label=Math.round(high-part*(high-low)); return `<line x1="20" y1="${py}" x2="750" y2="${py}"/><text x="765" y="${py+4}">${label}</text>`; }).join('');
  const label = (item) => new Intl.DateTimeFormat(undefined, range === 'day' ? {hour:'2-digit',minute:'2-digit'} : {month:'short',day:'numeric'}).format(new Date(item.checkedAt));
  svg.innerHTML = `<g class="chart-grid">${lines}</g><path class="chart-line" pathLength="1" d="${path}"/><line class="chart-hover-guide" y1="35" y2="155" hidden/><circle class="chart-hover-halo" r="11" hidden/><circle class="chart-hover-dot" r="5" hidden/><g class="chart-labels"><text x="20" y="180">${esc(label(series[0]))}</text><text x="385" y="180" text-anchor="middle">${esc(label(series[Math.floor(series.length/2)]))}</text><text x="750" y="180" text-anchor="end">${esc(label(latest))}</text></g>`;
  const dot = svg.querySelector('.chart-hover-dot');
  const halo = svg.querySelector('.chart-hover-halo');
  const guide = svg.querySelector('.chart-hover-guide');
  svg.onpointermove = (event) => {
    const rect = svg.getBoundingClientRect();
    const svgX = (event.clientX - rect.left) / rect.width * 820;
    const index = Math.max(0, Math.min(series.length - 1, Math.round((svgX - 20) / 730 * (series.length - 1))));
    const point = series[index];
    dot.hidden = false;
    halo.hidden = false;
    guide.hidden = false;
    dot.setAttribute('cx', x(index));
    dot.setAttribute('cy', y(Number(point.responseMs)));
    halo.setAttribute('cx', x(index));
    halo.setAttribute('cy', y(Number(point.responseMs)));
    guide.setAttribute('x1', x(index));
    guide.setAttribute('x2', x(index));
    tooltip.innerHTML = `<span>${esc(formatDate(point.checkedAt, {dateStyle:'medium',timeStyle:'short'}))}</span><i></i><strong>${Math.round(point.responseMs)} ms</strong>`;
    tooltip.hidden = false;
  };
  svg.onpointerleave = () => { dot.hidden = true; halo.hidden = true; guide.hidden = true; tooltip.hidden = true; };
}

function render(data) {
  const monitor = data.monitor || {};
  const discordState = data.discordApi?.rateLimited ? 'outage' : ['operational','normal','ok','none'].includes(data.discordApi?.state) ? 'operational' : data.discordApi?.state === 'degraded' || data.discordApi?.state === 'minor' ? 'degraded' : !data.discordApi?.state || data.discordApi.state === 'unknown' ? 'unknown' : 'outage';
  const services = [{name:'TheSecretary.xyz Website',kind:'website',state:monitor.status || 'unknown',uptime:monitor.uptime?.['90']},{name:'The Secretary™ Discord',kind:'discord',state:discordState,uptime:null},...((data.servers?.length ? data.servers : defaultServers).map((server) => ({...server,kind:'server',state:server.status || 'operational'})))];
  const overall = services.some((item) => stateClass(item.state) === 'outage') ? 'outage' : services.some((item) => stateClass(item.state) === 'degraded') ? 'degraded' : 'operational';
  (data.incidents||[]).forEach(item=>sessionStorage.setItem(`status-record:incident:${item.slug}`,JSON.stringify(item)));
  (data.maintenance||[]).forEach(item=>sessionStorage.setItem(`status-record:maintenance:${item.slug}`,JSON.stringify(item)));
  root.innerHTML = `<main class="status-public-page"><div class="status-wrap"><div class="status-top"><button type="button" data-subscribe-open>Subscribe to updates</button></div><div class="overall-status ${overall}">${overall === 'operational' ? 'All Systems Operational' : overall === 'degraded' ? 'Some Systems Degraded' : 'Service Disruption'}</div><p class="uptime-caption">Uptime over the past 90 days.</p><section class="service-list">${services.map((service) => serviceRow(service, monitor, data.historyEvents||[])).join('')}</section>${chartMarkup()}<section class="past-incidents"><h2>Past incidents &amp; maintenance</h2>${incidentDays(data.incidents, data.maintenance)}</section></div></main><div class="status-tooltip" data-status-tooltip></div><dialog class="status-subscribe-dialog" data-status-subscribe-dialog><form data-status-subscribe-form><button class="status-dialog-close" type="button" data-subscribe-close aria-label="Close">×</button><h2>Subscribe to updates</h2><p>Receive incident and maintenance updates by email.</p><input type="email" name="email" required placeholder="you@example.com"><button type="submit">Subscribe</button><small data-subscribe-message></small></form></dialog>`;
  root.querySelectorAll('[data-chart-range]').forEach((button) => button.addEventListener('click', () => { root.querySelectorAll('[data-chart-range]').forEach((item) => item.classList.toggle('active', item === button)); drawChart(data, button.dataset.chartRange); }));
  const tooltip = root.querySelector('[data-status-tooltip]');
  root.querySelector('.service-list').addEventListener('pointermove', (event) => {
    const bar = event.target.closest('[data-history-date]');
    if (!bar) { tooltip.classList.remove('visible'); return; }
    tooltip.innerHTML = historyTooltip(bar, data);
    tooltip.classList.add('visible');
    const barRect = bar.getBoundingClientRect();
    const halfWidth = Math.max(145, tooltip.offsetWidth / 2);
    const barCenter = barRect.left + barRect.width / 2;
    tooltip.style.left = `${Math.max(halfWidth + 12, Math.min(innerWidth - halfWidth - 12, barCenter))}px`;
    tooltip.style.top = `${barRect.bottom + 14}px`;
  });
  root.querySelector('.service-list').addEventListener('pointerleave', () => tooltip.classList.remove('visible'));
  const dialog = root.querySelector('[data-status-subscribe-dialog]');
  root.querySelector('[data-subscribe-open]').onclick = () => dialog.showModal();
  root.querySelector('[data-subscribe-close]').onclick = () => dialog.close();
  root.querySelector('[data-status-subscribe-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('[data-subscribe-message]');
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try { await statusApi('subscribe', {email:new FormData(form).get('email')}); message.textContent = 'Subscription confirmed.'; form.reset(); }
    catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
  drawChart(data);
}

async function load() {
  await mountLayout('status');
  try { render(await statusApi('status')); }
  catch (error) { root.innerHTML = `<main class="status-public-page"><div class="status-wrap"><div class="status-load-error"><h1>Status data is temporarily unavailable.</h1><p>${esc(error.message)}</p><button data-retry>Retry</button></div></div></main>`; root.querySelector('[data-retry]').onclick = load; }
}

load();
