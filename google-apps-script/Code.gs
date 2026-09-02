const STATUS_CONFIG = {
  SITE_URL: 'https://the-secretary-status.github.io',
  ADMIN_EMAIL: 'dikshitaggarwal007@gmail.com',
  TIMEZONE: 'Asia/Kolkata',
  CHECK_INTERVAL_MINUTES: 5,
  RETENTION_DAYS: 130,
  SHEETS: {
    settings: ['key', 'value'],
    checks: ['checkedAt', 'up', 'statusCode', 'responseMs', 'error', 'discordRateLimited', 'discordState', 'discordCheckedAt'],
    incidents: ['id', 'slug', 'json', 'updatedAt'],
    maintenance: ['id', 'slug', 'json', 'updatedAt'],
    posts: ['id', 'slug', 'json', 'updatedAt'],
    hostSwitches: ['id', 'slug', 'json', 'updatedAt'],
    subscribers: ['email', 'token', 'active', 'createdAt'],
  },
};

const HOST_CONFIG = {
  DOMAINS: ['thesecretary.xyz', 'www.thesecretary.xyz'],
  VALIDATION_MINUTES: 20,
  AUTOMATIC_OFFLINE_HOURS: 48,
  MANUAL_RATE_LIMIT_MINUTES: 20,
  MAX_AUTOMATIC_SWITCHES: 2,
  DEFAULT_BANDWIDTH_GB: 5,
  DEFAULT_PIPELINE_MINUTES: 500,
  INVENTORY_CACHE_MINUTES: 10,
};

// Credentials never belong in this source file. Add each referenced property in
// Apps Script > Project settings > Script properties.
const HOST_SERVERS = [
  {key:'virginia', name:'The-Secretary Virginia US', region:'Virginia US', serviceIdProperty:'RENDER_VIRGINIA_SERVICE_ID', apiKeyProperty:'RENDER_VIRGINIA_API_KEY'},
  {key:'singapore_n2', name:'The-Secretary Singapore N-2', region:'Singapore N-2', serviceIdProperty:'RENDER_SINGAPORE_N2_SERVICE_ID', apiKeyProperty:'RENDER_SINGAPORE_N2_API_KEY'},
  {key:'singapore_n1', name:'The-Secretary Singapore N-1', region:'Singapore N-1', serviceIdProperty:'RENDER_SINGAPORE_N1_SERVICE_ID', apiKeyProperty:'RENDER_SINGAPORE_N1_API_KEY'},
  {key:'frankfurt', name:'The-Secretary Frankfurt EU', region:'Frankfurt EU', serviceIdProperty:'RENDER_FRANKFURT_SERVICE_ID', apiKeyProperty:'RENDER_FRANKFURT_API_KEY'},
  {key:'ohio', name:'The-Secretary Ohio US', region:'Ohio US', serviceIdProperty:'RENDER_OHIO_SERVICE_ID', apiKeyProperty:'RENDER_OHIO_API_KEY'},
];

const DEFAULT_SETTINGS = {
  monitorName: 'The Secretary',
  description: 'Discord bot, dashboard, and public web service.',
  targetUrl: 'https://thesecretary.xyz/',
  discordStatusUrl: 'https://thesecretary.xyz/api/status/discord-rate-limit',
  failureThreshold: 1,
  webhookHttp: '',
  webhookDiscord: '',
  webhookPost: '',
  webhookMaintenance: '',
};

const DEFAULT_TEMPLATES = {
  http_down: '<:01:1539883590928834622><:02:1539883622016884817> **Failed check**\n<:03:1539883671488561172><:04:1539883702899703848> <@&1499339296929218681>\n-# <t:{timestamp}:F>\n<:quickfix:1539635325050298508> **The Secretary** ran into a fatal issue. Developers are currently investigating the issue and it will be solved shortly. [Read more↗]({page_url})\n\n-# We always appreciate your support\n~ The Secretary Dev Team',
  http_up: '<:01:1539883590928834622><:02:1539883622016884817> **Back Online**\n<:03:1539883671488561172><:04:1539883702899703848> <@&1499339296929218681>\n-# <t:{timestamp}:F>\n<:quickfix:1539635325050298508> **The Secretary** previously reported issue has been resolved. [Read more↗]({page_url})\n\n-# We always appreciate your support\n~ The Secretary Dev Team',
  discord_limited: '<:01:1539883590928834622><:02:1539883622016884817> **Discord API Request**\n<:03:1539883671488561172><:04:1539883702899703848> <@&1499339296929218681>\n-# <t:{timestamp}:F>\n<:support:1539635221622947970> **The Secretary** responded with 429, **Rate Limited**. This is from Discord\'s end; the bot may return failed interactions while the limitation is active. [Read more↗]({page_url})\n\n-# We always appreciate your support\n~ The Secretary Dev Team',
  discord_normal: '<:01:1539883590928834622><:02:1539883622016884817> **Discord API Request**\n<:03:1539883671488561172><:04:1539883702899703848> <@&1499339296929218681>\n-# <t:{timestamp}:F>\n<:support:1539635221622947970> **The Secretary** is back to normal. All interactions should now respond normally. [Read more↗]({page_url})\n\n-# We always appreciate your support\n~ The Secretary Dev Team',
  post: '<:01:1539883590928834622><:02:1539883622016884817> **New System Post**\n<:03:1539883671488561172><:04:1539883702899703848> <@&1541394162795151400>\n-# <t:{timestamp}:F>\n<:log:1539637794232868985> A new post has been uploaded on **The Secretary** system page. [See post↗]({page_url})\n\n-# We always appreciate your support\n~ The Secretary Dev Team',
  maintenance_start: '<:01:1539883590928834622><:02:1539883622016884817> **Maintenance Started**\n<:03:1539883671488561172><:04:1539883702899703848> <@&1499339296929218681>\n-# <t:{timestamp}:F>\n<:settings:1539635298785431644> A new maintenance has started. Some bot functions may be affected until the work is concluded. [Read more↗]({page_url})\n\n-# We always appreciate your support\n~ The Secretary Dev Team',
  maintenance_end: '<:01:1539883590928834622><:02:1539883622016884817> **Maintenance Concluded**\n<:03:1539883671488561172><:04:1539883702899703848> <@&1499339296929218681>\n-# <t:{timestamp}:F>\n<:settings:1539635298785431644> Maintenance has concluded with immediate effect. If errors persist, restart your system or report the bug. [Read more↗]({page_url})\n\n-# We always appreciate your support\n~ The Secretary Dev Team',
};

function setupStatusBackend() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('STATUS_SPREADSHEET_ID')) {
    const db = SpreadsheetApp.create('The Secretary Status Data');
    props.setProperty('STATUS_SPREADSHEET_ID', db.getId());
  }
  initializeSheets_();
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (['runScheduledChecks', 'checkService'].indexOf(trigger.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('runScheduledChecks').timeBased().everyMinutes(5).create();
  runScheduledChecks();
}

function cleanupLegacyStatusTriggers() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'checkService') {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });
  console.log('Removed ' + removed + ' obsolete checkService trigger(s).');
  return removed;
}

function doGet(e) { return route_(String((e.parameter || {}).action || 'status'), e.parameter || {}, false); }
function doPost(e) { return route_(String((e.parameter || {}).action || ''), e.parameter || {}, true); }

function route_(action, data, isPost) {
  try {
    initializeSheets_();
    if (['status', 'archive', 'content', 'subscribe', 'unsubscribe'].indexOf(action) === -1) requireAdmin_(data.access_token);
    let result;
    switch (action) {
      case 'status': result = statusPayload_(false); break;
      case 'admin_status': result = statusPayload_(true); break;
      case 'archive': result = archivePayload_(data.type); break;
      case 'content': result = contentPayload_(data.type, data.slug); break;
      case 'subscribe': result = subscribe_(data.email); break;
      case 'unsubscribe': result = unsubscribe_(data.token); break;
      case 'check_now': runScheduledChecks(); result = {ok: true}; break;
      case 'send_otp': result = sendOtp_(data.code); break;
      case 'update_settings': result = updateSettings_(data); break;
      case 'create_incident': result = createIncident_(data, false); break;
      case 'add_incident_update': result = addIncidentUpdate_(data); break;
      case 'create_maintenance': result = createMaintenance_(data); break;
      case 'edit_maintenance': result = editMaintenance_(data); break;
      case 'cancel_maintenance': result = concludeMaintenance_(data.id); break;
      case 'delete_maintenance': deleteRecord_('maintenance', data.id); result = {}; break;
      case 'create_post': result = createPost_(data); break;
      case 'resend_post_discord': result = resendPostDiscord_(data.id); break;
      case 'resend_post_email': result = resendPostEmail_(data.id); break;
      case 'delete_post': result = deletePost_(data.id); break;
      case 'test_webhook': result = testWebhook_(data.kind); break;
      case 'edit_content': result = editContent_(data); break;
      case 'update_webhooks': result = updateWebhooks_(data); break;
      case 'refresh_servers': result = {servers: getServerAdminPayload_(true)}; break;
      case 'switch_server': result = manualHostSwitch_(data.server_key, data.reason); break;
      case 'set_server_offline': result = setServerOffline_(data.server_key, data.hours, data.reason); break;
      case 'clear_server_offline': result = clearServerOffline_(data.server_key); break;
      default: throw new Error('Unknown action.');
    }
    return json_({ok: true, ...result});
  } catch (error) {
    console.error('Status action "' + action + '" failed: ' + (error && error.stack ? error.stack : error));
    return json_({ok: false, error: error && error.message ? error.message : 'Unexpected status service error.'});
  }
}

function runScheduledChecks() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    initializeSheets_();
    const settings = getSettings_();
    updateMaintenanceStates_(settings);
    const http = probeHttp_(settings.targetUrl);
    const discord = probeDiscord_(settings.discordStatusUrl);
    appendCheck_(http, discord);
    processHttpTransition_(http, settings);
    processDiscordTransition_(discord, settings);
    processHostAutomation_(http, discord, settings);
    pruneChecks_();
  } finally {
    lock.releaseLock();
  }
}

function probeHttp_(url) {
  const started = Date.now();
  try {
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: true, headers: {'User-Agent': 'TheSecretaryStatus/2.0'}});
    const code = response.getResponseCode();
    return {checkedAt: new Date().toISOString(), up: code >= 200 && code < 400, statusCode: code, responseMs: Date.now() - started, error: ''};
  } catch (error) {
    return {checkedAt: new Date().toISOString(), up: false, statusCode: null, responseMs: Date.now() - started, error: error.message || String(error)};
  }
}

function probeDiscord_(url) {
  try {
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true, followRedirects: true, headers: {'User-Agent': 'TheSecretaryStatus/2.0'}});
    const payload = JSON.parse(response.getContentText() || '{}');
    const rateLimited = Boolean(payload.rate_limited || payload.rateLimited || payload.discord_http_global_blocked || Number(payload.http_status) === 429);
    return {rateLimited: rateLimited, state: rateLimited ? 'rate_limited' : String(payload.state || 'unknown'), checkedAt: payload.checked_at || payload.checkedAt || new Date().toISOString(), raw: payload};
  } catch (error) {
    return {rateLimited: false, state: 'unavailable', checkedAt: new Date().toISOString(), error: error.message || String(error)};
  }
}

function processHttpTransition_(result, settings) {
  const props = PropertiesService.getScriptProperties();
  let failures = Number(props.getProperty('HTTP_FAILURES') || 0);
  const wasDown = props.getProperty('HTTP_DOWN') === '1';
  const maintenanceActive = readRecords_('maintenance').some(function (item) { return item.status === 'active'; });
  if (!result.up) failures += 1; else failures = 0;
  props.setProperty('HTTP_FAILURES', String(failures));
  if (!result.up && !wasDown && !maintenanceActive && failures >= Number(settings.failureThreshold || 1)) {
    const incident = createIncident_({title: 'The Secretary is unavailable', slug: uniqueSlug_('incidents', 'service-unavailable-' + Utilities.formatDate(new Date(), STATUS_CONFIG.TIMEZONE, 'yyyy-MM-dd-HHmm')), impact: 'critical', source: 'http', message: 'Automated monitoring detected a failed HTTP health check' + (result.statusCode ? ' (HTTP ' + result.statusCode + ').' : '.'), excerpt: 'Automated monitoring detected that The Secretary could not be reached.', content_html: '<h2>What happened</h2><p>The five-minute availability monitor could not complete a successful request. Developers have been notified and are investigating.</p>'}, true).item;
    props.setProperties({HTTP_DOWN: '1', HTTP_INCIDENT_ID: incident.id});
    deliverAutomatedEvent_('http_down', incident, settings, 'incidents');
  } else if (result.up && wasDown && !hostSwitchBlocksRecovery_()) {
    const incident = resolveIncident_(props.getProperty('HTTP_INCIDENT_ID'), 'Automated monitoring confirms the service has recovered (HTTP ' + result.statusCode + ', ' + result.responseMs + ' ms).');
    props.deleteProperty('HTTP_DOWN'); props.deleteProperty('HTTP_INCIDENT_ID');
    if (incident) deliverAutomatedEvent_('http_up', incident, settings, 'incidents');
  }
}

function processDiscordTransition_(discord, settings) {
  const props = PropertiesService.getScriptProperties();
  const wasLimited = props.getProperty('DISCORD_LIMITED') === '1';
  if (discord.rateLimited && !wasLimited) {
    const incident = createIncident_({title: 'Discord API rate limited', slug: uniqueSlug_('incidents', 'discord-api-rate-limited-' + Utilities.formatDate(new Date(), STATUS_CONFIG.TIMEZONE, 'yyyy-MM-dd-HHmm')), impact: 'critical', source: 'discord', message: 'The Secretary received HTTP 429 from Discord. Interactions may fail until Discord lifts the rate limit.', excerpt: 'Discord is rate limiting The Secretary API requests.', content_html: '<h2>Discord API limitation</h2><p>The bot-authenticated health probe reported HTTP 429. This is a Discord-side limit. Commands and interactions may be delayed or fail until the restriction clears.</p><blockquote>Our low-frequency probe continues to monitor recovery without adding excessive Discord traffic.</blockquote>'}, true).item;
    props.setProperties({DISCORD_LIMITED: '1', DISCORD_INCIDENT_ID: incident.id});
    deliverAutomatedEvent_('discord_limited', incident, settings, 'incidents');
  } else if (!discord.rateLimited && wasLimited && discord.state === 'operational' && !hostSwitchBlocksRecovery_()) {
    const incident = resolveIncident_(props.getProperty('DISCORD_INCIDENT_ID'), 'The Discord API probe is back to normal. All interactions should now respond normally.');
    props.deleteProperty('DISCORD_LIMITED'); props.deleteProperty('DISCORD_INCIDENT_ID');
    if (incident) deliverAutomatedEvent_('discord_normal', incident, settings, 'incidents');
  }
}

function statusPayload_(admin) {
  // Public/admin reads must remain read-only. Maintenance transitions and their
  // notifications are handled only by runScheduledChecks().
  const settings = getSettings_();
  const checks = getChecks_();
  const incidents = sortRecords_(readRecords_('incidents'), 'startedAt');
  const maintenance = sortRecords_(readRecords_('maintenance'), 'startAt');
  const posts = sortRecords_(readRecords_('posts'), 'publishedAt');
  const latest = checks.length ? checks[checks.length - 1] : null;
  const discord = latest ? {rateLimited: Boolean(latest.discordRateLimited), state: latest.discordState, checkedAt: latest.discordCheckedAt} : {rateLimited: false, state: 'unknown', checkedAt: null};
  const activeIncidents = incidents.filter(function (x) { return x.status !== 'resolved'; });
  const activeMaintenance = maintenance.filter(function (x) { return x.status === 'active' || x.status === 'scheduled'; });
  let status = latest ? (latest.up ? 'operational' : 'down') : 'unknown';
  let headline = status === 'operational' ? 'All systems operational' : (status === 'unknown' ? 'Awaiting the first check' : 'The Secretary is unavailable');
  let message = status === 'operational' ? 'The Secretary is responding normally.' : (status === 'unknown' ? 'Monitoring data will appear after setup completes.' : 'Automated monitoring detected an availability issue.');
  if (discord.rateLimited) { status = 'down'; headline = 'Discord API rate limited'; message = 'Discord is currently limiting The Secretary API requests.'; }
  else if (activeIncidents.some(function (x) { return x.impact === 'critical'; })) { status = 'down'; headline = activeIncidents[0].title; message = activeIncidents[0].excerpt || 'A critical incident is being investigated.'; }
  else if (activeMaintenance.some(function (x) { return x.status === 'active'; })) { status = 'maintenance'; headline = 'Maintenance in progress'; message = 'Some systems may not work to their fullest.'; }
  const monitor = buildMonitor_(settings, checks, latest);
  const payload = {generatedAt: new Date().toISOString(), monitor: monitor, summary: {status: status, headline: headline, message: message}, discordApi: discord, incidents: incidents.slice(0, admin ? 250 : 5), maintenance: maintenance.slice(0, admin ? 250 : 5), posts: posts.slice(0, admin ? 250 : 6)};
  if (admin) Object.assign(payload, {settings: settings, recentChecks: checks.slice(-50).reverse(), subscriberCount: activeSubscribers_().length, webhooks: {http: settings.webhookHttp, discord: settings.webhookDiscord, post: settings.webhookPost, maintenance: settings.webhookMaintenance}, webhookTemplates: getTemplates_(), deliveryIssues: collectDeliveryIssues_(incidents, maintenance), hostManagement: getServerAdminPayload_(false)});
  return payload;
}

function buildMonitor_(settings, checks, latest) {
  const now = Date.now();
  function uptime(days) {
    const cutoff = now - days * 86400000;
    const scoped = checks.filter(function (x) { return new Date(x.checkedAt).getTime() >= cutoff; });
    return scoped.length ? scoped.filter(function (x) { return x.up; }).length / scoped.length * 100 : null;
  }
  const responseSeries = checks.filter(function (x) { return now - new Date(x.checkedAt).getTime() <= 48 * 3600000 && Number.isFinite(Number(x.responseMs)); }).map(function (x) { return {checkedAt: x.checkedAt, responseMs: Number(x.responseMs), up: Boolean(x.up)}; });
  const responseValues = responseSeries.map(function (x) { return x.responseMs; });
  const dayGroups = {};
  checks.forEach(function (x) { const day = String(x.checkedAt).slice(0, 10); if (!dayGroups[day]) dayGroups[day] = []; dayGroups[day].push(x); });
  const history = Object.keys(dayGroups).sort().map(function (date) { const rows = dayGroups[date]; return {date: date, uptime: rows.filter(function (x) { return x.up; }).length / rows.length * 100}; });
  return {name: settings.monitorName, description: settings.description, status: latest ? (latest.up ? 'operational' : 'down') : 'unknown', statusCode: latest ? latest.statusCode : null, responseMs: latest ? latest.responseMs : null, lastCheckAt: latest ? latest.checkedAt : null, checkIntervalMinutes: 5, consecutiveFailures: Number(PropertiesService.getScriptProperties().getProperty('HTTP_FAILURES') || 0), uptime: {'24h': uptime(1), '7': uptime(7), '30': uptime(30), '90': uptime(90), '120': uptime(120)}, response: {periodHours: 48, samples: responseSeries.length, series: responseSeries, averageMs: responseValues.length ? responseValues.reduce(function (a,b) { return a+b; },0)/responseValues.length : null, minimumMs: responseValues.length ? Math.min.apply(null,responseValues) : null, maximumMs: responseValues.length ? Math.max.apply(null,responseValues) : null}, history: history};
}

function createIncident_(data, automated) {
  const now = new Date().toISOString();
  const title = requiredText_(data.title, 120, 'Incident title is required.');
  const slug = uniqueSlug_('incidents', data.slug || title);
  const item = {id: Utilities.getUuid(), slug: slug, title: title, excerpt: cleanText_(data.excerpt || data.message, 300), contentHtml: cleanHtml_(data.content_html), impact: ['minor','major','critical'].indexOf(data.impact) >= 0 ? data.impact : 'minor', status: 'investigating', source: cleanText_(data.source, 20) || (automated ? 'http' : 'manual'), startedAt: now, resolvedAt: null, updatedAt: now, automated: Boolean(automated), updates: [{status: 'investigating', message: requiredText_(data.message, 3000, 'Incident update is required.'), createdAt: now}]};
  writeRecord_('incidents', item);
  if (!automated) notifyEvent_('http_down', item, getSettings_());
  return {item: item};
}

function addIncidentUpdate_(data) {
  const item = findRecordById_('incidents', data.id); if (!item) throw new Error('Incident not found.');
  const status = ['investigating','identified','monitoring','resolved'].indexOf(data.status) >= 0 ? data.status : 'monitoring';
  item.status = status; item.updatedAt = new Date().toISOString(); item.updates.push({status: status, message: requiredText_(data.message,3000,'Update is required.'), createdAt: item.updatedAt});
  if (status === 'resolved') item.resolvedAt = item.updatedAt;
  writeRecord_('incidents', item);
  if (status === 'resolved') notifyEvent_(item.source === 'discord' ? 'discord_normal' : 'http_up', item, getSettings_());
  return {item: item};
}

function resolveIncident_(id, message) {
  const item = findRecordById_('incidents', id); if (!item) return null;
  item.status = 'resolved'; item.resolvedAt = new Date().toISOString(); item.updatedAt = item.resolvedAt; item.updates.push({status:'resolved',message:message,createdAt:item.resolvedAt}); writeRecord_('incidents',item); return item;
}

function createMaintenance_(data) {
  const start = new Date(data.start_at); const end = new Date(data.end_at); if (!start.getTime() || !end.getTime() || end <= start) throw new Error('Maintenance dates are invalid.');
  const now = new Date().toISOString(); const title = requiredText_(data.title,120,'Maintenance title is required.');
  const item = {id:Utilities.getUuid(),slug:uniqueSlug_('maintenance',data.slug||title),title:title,excerpt:cleanText_(data.description,300),description:requiredText_(data.description,3000,'Maintenance description is required.'),contentHtml:cleanHtml_(data.content_html),status:'scheduled',startAt:start.toISOString(),endAt:end.toISOString(),createdAt:now,updatedAt:now,notifiedStart:false,notifiedEnd:false};
  writeRecord_('maintenance',item); updateMaintenanceStates_(getSettings_()); return {item:item};
}

function concludeMaintenance_(id) { const item=findRecordById_('maintenance',id); if(!item)throw new Error('Maintenance not found.'); item.status='completed';item.endAt=new Date().toISOString();item.updatedAt=item.endAt;writeRecord_('maintenance',item);notifyEvent_('maintenance_end',item,getSettings_());return{item:item}; }
function createPost_(data) {
  const now = new Date().toISOString();
  const title = requiredText_(data.title, 120, 'Post title is required.');
  const item = {
    id: Utilities.getUuid(),
    slug: uniqueSlug_('posts', data.slug || title),
    title: title,
    excerpt: requiredText_(data.excerpt, 300, 'Post excerpt is required.'),
    contentHtml: cleanHtml_(data.content_html),
    createdAt: now,
    publishedAt: now,
    updatedAt: now
  };

  // Deliver first. A post is not written to the public data sheet unless every
  // configured Discord delivery and every email delivery succeeds.
  const delivery = notifyEvent_('post', item, getSettings_());
  writeRecord_('posts', item);
  return {item: item, delivery: delivery};
}

function resendPostDiscord_(id) {
  const item = findRecordById_('posts', id);
  if (!item) throw new Error('Post not found.');
  return {
    delivery: notifyEvent_('post', item, getSettings_(), {
      discord: true,
      email: false,
      requireWebhook: true
    })
  };
}

function resendPostEmail_(id) {
  const item = findRecordById_('posts', id);
  if (!item) throw new Error('Post not found.');
  return {
    delivery: notifyEvent_('post', item, getSettings_(), {
      discord: false,
      email: true
    })
  };
}

function deletePost_(id) {
  const item = findRecordById_('posts', id);
  if (!item) throw new Error('Post not found. It may already have been deleted.');
  deleteRecord_('posts', id);
  return {deleted: true, id: item.id, slug: item.slug};
}

function testWebhook_(kind) {
  const settings = getSettings_();
  const destinations = {
    http: settings.webhookHttp,
    discord: settings.webhookDiscord,
    post: settings.webhookPost,
    maintenance: settings.webhookMaintenance
  };
  kind = String(kind || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(destinations, kind)) {
    throw new Error('Unknown webhook destination.');
  }
  if (!destinations[kind]) {
    throw new Error('Save a ' + kind + ' webhook URL before testing it.');
  }
  const eventMap = {
    http: 'http_down',
    discord: 'discord_limited',
    post: 'post',
    maintenance: 'maintenance_start'
  };
  const event = eventMap[kind];
  const item = {
    title: 'Webhook test - no live event created',
    slug: 'webhook-test',
    excerpt: 'This is a safe delivery test from The Secretary Status control room.'
  };
  const pageUrl = STATUS_CONFIG.SITE_URL + '/';
  const content = '🧪 **TEST DELIVERY - NO LIVE EVENT**\n' + applyTemplate_(getTemplates_()[event] || '', item, pageUrl);
  return {kind: kind, webhook: sendWebhook_(destinations[kind], content, {suppressMentions: true})};
}

function editContent_(data) {
  const map={incident:'incidents',maintenance:'maintenance',post:'posts'};const sheet=map[data.type];if(!sheet)throw new Error('Unknown page type.');const item=findRecordById_(sheet,data.id);if(!item)throw new Error('Page not found.');
  item.title=requiredText_(data.title,120,'Title is required.');item.slug=normalizeSlug_(data.slug||item.title);ensureSlugAvailable_(sheet,item.slug,item.id);item.excerpt=cleanText_(data.excerpt||item.excerpt,300);item.contentHtml=cleanHtml_(data.content_html);item.updatedAt=new Date().toISOString();writeRecord_(sheet,item);return{item:item};
}

function updateMaintenanceStates_(settings) {
  const now = Date.now();
  readRecords_('maintenance').forEach(function (item) {
    const events = [];
    let changed = false;
    if (item.status === 'scheduled' && new Date(item.startAt).getTime() <= now) {
      item.status = 'active';
      item.updatedAt = new Date().toISOString();
      changed = true;
      if (!item.notifiedStart) {
        item.notifiedStart = true;
        events.push('maintenance_start');
      }
    }
    if (item.status === 'active' && new Date(item.endAt).getTime() <= now) {
      item.status = 'completed';
      item.updatedAt = new Date().toISOString();
      changed = true;
      if (!item.notifiedEnd) {
        item.notifiedEnd = true;
        events.push('maintenance_end');
      }
    }
    if (!changed) return;

    // Persist the transition before contacting Discord/Gmail. A provider error
    // can no longer cause the same transition to repeat forever or block checks.
    writeRecord_('maintenance', item);
    events.forEach(function (event) { deliverAutomatedEvent_(event, item, settings, 'maintenance'); });
  });
}

function updateSettings_(data) { const settings=getSettings_();settings.monitorName=cleanText_(data.monitor_name,80)||settings.monitorName;settings.description=cleanText_(data.description,240);settings.targetUrl=validHttps_(data.target_url);settings.discordStatusUrl=validHttps_(data.discord_status_url);settings.failureThreshold=Math.max(1,Math.min(3,Number(data.failure_threshold)||1));saveSettings_(settings);return{settings:settings}; }
function updateWebhooks_(data) { const settings=getSettings_();['http','discord','post','maintenance'].forEach(function(k){settings['webhook'+capitalize_(k)]=validWebhook_(data['webhook_'+k]);});saveSettings_(settings);const templates=getTemplates_();Object.keys(DEFAULT_TEMPLATES).forEach(function(k){templates[k]=cleanText_(data['template_'+k],4000)||DEFAULT_TEMPLATES[k];});saveSettingMap_('template.',templates);return{}; }

function archivePayload_(type) { const map={incidents:'incidents',maintenance:'maintenance',posts:'posts'};if(!map[type])throw new Error('Unknown archive.');return{type:type,items:sortRecords_(readRecords_(map[type]),type==='posts'?'publishedAt':type==='maintenance'?'startAt':'startedAt')}; }
function contentPayload_(type,slug) { const map={incident:'incidents',maintenance:'maintenance',post:'posts'};if(!map[type])throw new Error('Unknown page type.');const item=findRecordBySlug_(map[type],slug);if(!item)throw new Error('Page not found.');return{type:type,item:item}; }

function subscribe_(email) { email=String(email||'').trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error('Valid email required.');const sheet=getSheet_('subscribers');const rows=sheet.getDataRange().getValues();for(let i=1;i<rows.length;i++){if(String(rows[i][0]).toLowerCase()===email){sheet.getRange(i+1,3).setValue(true);return{};}}const token=Utilities.getUuid().replace(/-/g,'');sheet.appendRow([email,token,true,new Date().toISOString()]);MailApp.sendEmail({to:email,subject:'Subscribed to The Secretary status',body:'You will now receive operational alerts and system posts from The Secretary.',htmlBody:'<p>You will now receive operational alerts and system posts from The Secretary.</p><p><a href="'+STATUS_CONFIG.SITE_URL+'/unsubscribe/?token='+token+'">Unsubscribe</a></p>'});return{}; }
function unsubscribe_(token) { const sheet=getSheet_('subscribers');const rows=sheet.getDataRange().getValues();for(let i=1;i<rows.length;i++){if(String(rows[i][1])===String(token)){sheet.getRange(i+1,3).setValue(false);return{};}}throw new Error('Subscription not found.'); }
function sendOtp_(code) { code=String(code||'').trim();if(!/^\d{6}$/.test(code))throw new Error('Invalid sign-in code.');MailApp.sendEmail({to:STATUS_CONFIG.ADMIN_EMAIL,subject:'The Secretary Status sign-in code',body:'Your sign-in code is '+code+'. It expires in 10 minutes.',htmlBody:'<div style="font-family:Arial,sans-serif;background:#080808;color:#fff;padding:28px"><p style="color:#f2eb00;font-weight:bold">THE SECRETARY STATUS</p><h2>Your sign-in code</h2><p style="font-size:34px;letter-spacing:8px;font-weight:bold">'+code+'</p><p>This code expires in 10 minutes. If you did not request it, ignore this message.</p></div>'});return{}; }

function notifyEvent_(event, item, settings, channels) {
  const urlMap = {
    http_down: settings.webhookHttp,
    http_up: settings.webhookHttp,
    discord_limited: settings.webhookDiscord,
    discord_normal: settings.webhookDiscord,
    post: settings.webhookPost,
    maintenance_start: settings.webhookMaintenance,
    maintenance_end: settings.webhookMaintenance
  };
  const subjectMap = {
    http_down: 'The Secretary is unavailable',
    http_up: 'The Secretary is back online',
    discord_limited: 'Discord API rate limited',
    discord_normal: 'Discord API is back to normal',
    post: 'New post: ' + item.title,
    maintenance_start: 'Maintenance started: ' + item.title,
    maintenance_end: 'Maintenance concluded: ' + item.title
  };
  const pageType = event === 'post' ? 'post' : event.indexOf('maintenance_') === 0 ? 'maintenance' : 'incident';
  const pageUrl = STATUS_CONFIG.SITE_URL + '/content/?type=' + encodeURIComponent(pageType) + '&slug=' + encodeURIComponent(item.slug);
  const content = applyTemplate_(getTemplates_()[event] || '', item, pageUrl);
  const selected = channels || {discord: true, email: true, requireWebhook: false};
  const result = {};

  if (selected.discord !== false) {
    if (urlMap[event]) {
      result.discord = sendWebhook_(urlMap[event], content);
    } else if (selected.requireWebhook) {
      throw new Error('No Discord webhook is configured for this notification.');
    } else {
      result.discord = {skipped: true, reason: 'not_configured'};
    }
  }
  if (selected.email !== false) {
    result.email = notifySubscribers_(
      subjectMap[event] || item.title,
      item.excerpt || item.description || content,
      pageUrl
    );
  }
  return result;
}
function applyTemplate_(template,item,pageUrl) { return String(template||'').replace(/\{timestamp\}/g,String(Math.floor(Date.now()/1000))).replace(/\{page_url\}/g,pageUrl).replace(/\{slug\}/g,item.slug||'').replace(/\{title\}/g,item.title||''); }
function sendWebhook_(url, content, options) {
  content = String(content || '').trim();
  if (!content) throw new Error('Discord webhook message is empty.');
  if (content.length > 2000) {
    throw new Error('Discord rejected delivery before sending: the webhook message is ' + content.length + ' characters; Discord allows 2,000.');
  }

  let response;
  try {
    const payload = {content: content};
    if (options && options.suppressMentions) payload.allowed_mentions = {parse: []};
    response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (error) {
    console.error('Discord webhook request failed: ' + (error && error.stack ? error.stack : error));
    throw new Error('Discord webhook request failed: ' + (error.message || String(error)));
  }

  const statusCode = response.getResponseCode();
  const responseBody = String(response.getContentText() || '').trim();
  console.log('Discord webhook response: HTTP ' + statusCode + (responseBody ? ' - ' + responseBody.slice(0, 500) : ''));
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error('Discord webhook rejected the message (HTTP ' + statusCode + ')' + (responseBody ? ': ' + responseBody.slice(0, 500) : '.'));
  }
  return {ok: true, statusCode: statusCode};
}

function notifySubscribers_(subject, message, pageUrl) {
  const subscribers = activeSubscribers_();
  const requiredQuota = subscribers.length + 1;
  const remainingQuota = MailApp.getRemainingDailyQuota();
  if (remainingQuota < requiredQuota) {
    throw new Error('Email delivery stopped: ' + requiredQuota + ' recipients are required but only ' + remainingQuota + ' daily sends remain.');
  }

  const plain = String(message || 'A new status update is available.') + '\n\nRead more: ' + pageUrl;
  const html = '<h2>' + escapeHtml_(subject) + '</h2><p>' + escapeHtml_(message || 'A new status update is available.') + '</p><p><a href="' + pageUrl + '">Read the full update</a></p><p style="color:#777;font-size:12px">You receive this because you subscribed to The Secretary status.</p>';
  let sent = 0;
  try {
    subscribers.forEach(function (subscriber) {
      MailApp.sendEmail({
        to: subscriber.email,
        subject: subject,
        body: plain,
        htmlBody: html + '<p><a href="' + STATUS_CONFIG.SITE_URL + '/unsubscribe/?token=' + subscriber.token + '">Unsubscribe</a></p>'
      });
      sent += 1;
    });
    MailApp.sendEmail({
      to: STATUS_CONFIG.ADMIN_EMAIL,
      subject: subject,
      body: plain,
      htmlBody: html
    });
    sent += 1;
  } catch (error) {
    console.error('Email delivery failed after ' + sent + ' successful recipient(s): ' + (error && error.stack ? error.stack : error));
    throw new Error('Email delivery failed after ' + sent + ' successful recipient(s): ' + (error.message || String(error)));
  }
  return {ok: true, sent: sent};
}

function deliverAutomatedEvent_(event, item, settings, sheetName) {
  if (!Array.isArray(item.notificationDeliveries)) item.notificationDeliveries = [];
  const attemptedAt = new Date().toISOString();
  try {
    const result = notifyEvent_(event, item, settings);
    item.notificationDeliveries.push({event: event, status: 'delivered', attemptedAt: attemptedAt, result: result});
    if (item.notificationDeliveries.length > 20) item.notificationDeliveries = item.notificationDeliveries.slice(-20);
    writeRecord_(sheetName, item);
    return {ok: true};
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    item.notificationDeliveries.push({event: event, status: 'failed', attemptedAt: attemptedAt, error: message});
    if (item.notificationDeliveries.length > 20) item.notificationDeliveries = item.notificationDeliveries.slice(-20);
    writeRecord_(sheetName, item);
    console.error('Automated ' + event + ' notification failed without stopping monitoring: ' + message);
    return {ok: false, error: message};
  }
}

function collectDeliveryIssues_(incidents, maintenance) {
  const issues = [];
  [{type: 'incident', items: incidents}, {type: 'maintenance', items: maintenance}].forEach(function (group) {
    group.items.forEach(function (item) {
      const attempts = Array.isArray(item.notificationDeliveries) ? item.notificationDeliveries : [];
      attempts.filter(function (attempt) { return attempt.status === 'failed'; }).forEach(function (attempt) {
        issues.push({
          type: group.type,
          id: item.id,
          title: item.title,
          slug: item.slug,
          event: attempt.event,
          error: attempt.error,
          attemptedAt: attempt.attemptedAt
        });
      });
    });
  });
  return issues.sort(function (a, b) { return new Date(b.attemptedAt || 0) - new Date(a.attemptedAt || 0); }).slice(0, 20);
}

function processHostAutomation_(http, discord, settings) {
  let state = getHostSwitchState_();
  if (state) {
    try {
      advanceHostSwitch_(state, http, discord, settings);
    } catch (error) {
      state.lastError = error.message || String(error);
      state.stepFailures = Number(state.stepFailures || 0) + 1;
      state.updatedAt = new Date().toISOString();
      saveHostSwitchState_(state);
      if (state.stepFailures >= 3) retryOrEmergency_(state, 'Host-switch step failed repeatedly: ' + state.lastError);
    }
    return;
  }

  const props = PropertiesService.getScriptProperties();
  const failureActive = props.getProperty('HTTP_DOWN') === '1' || props.getProperty('DISCORD_LIMITED') === '1';
  if (!failureActive) {
    props.deleteProperty('HOST_AUTOMATION_EMERGENCY');
    enforceStandbySuspension_();
    return;
  }
  if (props.getProperty('HOST_AUTOMATION_EMERGENCY') === '1') return;
  const maintenanceActive = readRecords_('maintenance').some(function (item) { return item.status === 'active'; });
  if (maintenanceActive) return;

  const reason = props.getProperty('DISCORD_LIMITED') === '1'
    ? 'Automatic failover: Discord API rate limit detected.'
    : 'Automatic failover: public HTTP health check failed.';
  try {
    startAutomaticHostSwitch_(reason);
  } catch (error) {
    enterHostEmergency_(null, reason + ' ' + (error.message || String(error)));
  }
}

function editMaintenance_(data) {
  const item = findRecordById_('maintenance', data.id); if (!item) throw new Error('Maintenance page not found.');
  const title = requiredText_(data.title,120,'Maintenance title is required.');
  const slug = normalizeSlug_(data.slug || title); ensureSlugAvailable_('maintenance',slug,item.id);
  const startAt = new Date(data.start_at); const endAt = new Date(data.end_at);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) throw new Error('Maintenance end must be after its start.');
  const now = Date.now();
  item.title=title; item.slug=slug; item.excerpt=cleanText_(data.description,300); item.description=cleanText_(data.description,3000);
  item.contentHtml=cleanHtml_(data.content_html); item.startAt=startAt.toISOString(); item.endAt=endAt.toISOString(); item.updatedAt=new Date().toISOString();
  if (item.status !== 'cancelled') item.status = now < startAt.getTime() ? 'scheduled' : (now < endAt.getTime() ? 'active' : 'completed');
  writeRecord_('maintenance',item); return{item:item};
}

function startAutomaticHostSwitch_(reason) {
  const inventory = refreshServerInventory_();
  const activeKey = discoverActiveServerKey_(inventory);
  if (!activeKey) throw new Error('The active Render service could not be identified from Cloudflare DNS.');
  const candidate = selectBestServer_(inventory, [activeKey]);
  if (!candidate) throw new Error('No eligible standby server is available.');
  const now = new Date().toISOString();
  const state = {
    id: Utilities.getUuid(), mode: 'automatic', reason: cleanText_(reason, 500), phase: 'preparing',
    attempts: 1, maxAttempts: HOST_CONFIG.MAX_AUTOMATIC_SWITCHES,
    originalKey: activeKey, sourceKey: activeKey, targetKey: candidate.key,
    triedKeys: [activeKey, candidate.key], createdAt: now, updatedAt: now, lastError: ''
  };
  saveHostSwitchState_(state);
  writeHostSwitchLog_(state, 'started', 'Automatic host switch started.');
  try { beginHostSwitchAttempt_(state); }
  catch (error) { retryOrEmergency_(state, 'The first host-switch attempt could not start: ' + (error.message || String(error))); }
}

function manualHostSwitch_(serverKey, reason) {
  serverKey = String(serverKey || '').trim();
  reason = requiredText_(reason, 500, 'A reason is required for a manual host switch.');
  if (getHostSwitchState_()) throw new Error('A host switch is already in progress.');
  const target = getConfiguredServers_().find(function (server) { return server.key === serverKey; });
  if (!target) throw new Error('Unknown or unconfigured Render server.');
  const offline = getOfflineServers_();
  if (offline[serverKey] && new Date(offline[serverKey].until).getTime() > Date.now()) throw new Error('That server is marked offline. Clear its offline hold first.');
  const props = PropertiesService.getScriptProperties();
  const lastManual = Number(props.getProperty('HOST_LAST_MANUAL_SWITCH_AT') || 0);
  const retryAt = lastManual + HOST_CONFIG.MANUAL_RATE_LIMIT_MINUTES * 60000;
  if (Date.now() < retryAt) throw new Error('Manual host switches are limited to one every 20 minutes. Try again after ' + new Date(retryAt).toISOString() + '.');

  const inventory = getServerInventory_(false);
  const activeKey = discoverActiveServerKey_(inventory);
  if (!activeKey) throw new Error('The active Render service could not be identified. Refresh server data and try again.');
  if (activeKey === serverKey) throw new Error('That server is already the active host.');

  const now = new Date().toISOString();
  const state = {
    id: Utilities.getUuid(), mode: 'manual', reason: reason, phase: 'preparing', attempts: 1, maxAttempts: 1,
    originalKey: activeKey, sourceKey: activeKey, targetKey: serverKey,
    triedKeys: [activeKey, serverKey], createdAt: now, updatedAt: now, lastError: ''
  };
  props.setProperties({HOST_LAST_MANUAL_SWITCH_AT: String(Date.now()), HOST_AUTOMATION_EMERGENCY: '0'});
  saveHostSwitchState_(state);
  writeHostSwitchLog_(state, 'started', 'Manual host switch started: ' + reason);
  try { beginHostSwitchAttempt_(state); }
  catch (error) {
    props.deleteProperty('HOST_SWITCH_STATE');
    writeHostSwitchLog_(state, 'attempt_failed', 'Manual switch could not start: ' + (error.message || String(error)));
    throw error;
  }
  return {switchState: sanitizeSwitchState_(state)};
}

function beginHostSwitchAttempt_(state) {
  const target = requireServerByKey_(state.targetKey);
  const service = renderRequest_(target, '/services/' + encodeURIComponent(target.serviceId), 'get', null, [200]).data;
  if (String(service.suspended || '').toLowerCase() === 'suspended' || service.suspended === true) {
    renderRequest_(target, '/services/' + encodeURIComponent(target.serviceId) + '/resume', 'post', null, [202]);
  }
  const deployment = renderRequest_(target, '/services/' + encodeURIComponent(target.serviceId) + '/deploys', 'post', {clearCache:'do_not_clear'}, [201, 202]).data;
  const deploy = deployment.deploy || deployment;
  if (!deploy.id) throw new Error('Render accepted the deploy but did not return a deploy ID.');
  state.deployId = deploy.id;
  state.phase = 'waiting_deploy';
  state.stepFailures = 0;
  state.attemptStartedAt = new Date().toISOString();
  state.updatedAt = state.attemptStartedAt;
  saveHostSwitchState_(state);
  writeHostSwitchLog_(state, 'deploying', 'Deploying the latest commit to ' + target.name + '.');
}

function advanceHostSwitch_(state, http, discord, settings) {
  if (state.phase === 'waiting_deploy' || state.phase === 'preparing') {
    if (!state.deployId) return beginHostSwitchAttempt_(state);
    const target = requireServerByKey_(state.targetKey);
    const deployment = renderRequest_(target, '/services/' + encodeURIComponent(target.serviceId) + '/deploys/' + encodeURIComponent(state.deployId), 'get', null, [200]).data;
    const deploy = deployment.deploy || deployment;
    const status = String(deploy.status || '').toLowerCase();
    if (['live', 'succeeded'].indexOf(status) >= 0) {
      state.phase = 'cutover';
      state.stepFailures = 0;
      state.updatedAt = new Date().toISOString();
      saveHostSwitchState_(state);
      performHostCutover_(state);
      return;
    }
    if (['build_failed','update_failed','failed','canceled','cancelled','deactivated'].indexOf(status) >= 0) {
      return retryOrEmergency_(state, 'Render deployment ended with status "' + status + '".');
    }
    if (Date.now() - new Date(state.attemptStartedAt || state.createdAt).getTime() > 120 * 60000) {
      return retryOrEmergency_(state, 'Render deployment did not become live within two hours.');
    }
    return;
  }

  if (state.phase === 'cutover') return performHostCutover_(state);
  if (state.phase !== 'validating' || Date.now() < new Date(state.validateAfter).getTime()) return;

  const healthy = Boolean(http.up) && !discord.rateLimited && discord.state === 'operational';
  if (healthy) {
    finalizeSuccessfulHostSwitch_(state, http, discord, settings);
  } else {
    const reason = !http.up ? 'HTTP health check is still failing after validation.' : 'Discord API health is not operational after validation.';
    retryOrEmergency_(state, reason);
  }
}

function performHostCutover_(state) {
  const source = requireServerByKey_(state.sourceKey);
  const target = requireServerByKey_(state.targetKey);
  const targetServiceResponse = renderRequest_(target, '/services/' + encodeURIComponent(target.serviceId), 'get', null, [200]).data;
  const targetService = targetServiceResponse.service || targetServiceResponse;
  const targetHost = hostnameFromUrl_(targetService.url);
  if (!targetHost) throw new Error('Render did not return the target service hostname.');

  HOST_CONFIG.DOMAINS.forEach(function (domain) {
    deleteRenderDomain_(source, domain);
  });
  HOST_CONFIG.DOMAINS.forEach(function (domain) {
    ensureRenderDomain_(target, domain);
  });
  HOST_CONFIG.DOMAINS.forEach(function (domain) {
    updateCloudflareRecord_(domain, targetHost);
  });
  HOST_CONFIG.DOMAINS.forEach(function (domain) {
    renderRequest_(target, '/services/' + encodeURIComponent(target.serviceId) + '/custom-domains/' + encodeURIComponent(domain) + '/verify', 'post', null, [200, 202]);
  });

  const now = new Date();
  PropertiesService.getScriptProperties().setProperty('HOST_ACTIVE_KEY', target.key);
  setServerOfflineInternal_(source.key, HOST_CONFIG.AUTOMATIC_OFFLINE_HOURS, 'Previous active host after switch to ' + target.name + '.', 'automatic');
  state.phase = 'validating';
  state.stepFailures = 0;
  state.cutoverAt = now.toISOString();
  state.validateAfter = new Date(now.getTime() + HOST_CONFIG.VALIDATION_MINUTES * 60000).toISOString();
  state.targetHostname = targetHost;
  state.updatedAt = now.toISOString();
  saveHostSwitchState_(state);
  suspendAllExcept_(target.key);
  writeHostSwitchLog_(state, 'validating', 'Traffic moved to ' + target.name + '; validation ends at ' + state.validateAfter + '.');
  sendAdminHostEmail_('The Secretary host switched to ' + target.name, [
    'Reason: ' + state.reason,
    'Previous host: ' + source.name,
    'New host: ' + target.name,
    'Validation ends: ' + state.validateAfter,
    'Attempt: ' + state.attempts + ' of ' + state.maxAttempts
  ].join('\n'));
}

function retryOrEmergency_(state, reason) {
  state.lastError = cleanText_(reason, 1000);
  writeHostSwitchLog_(state, 'attempt_failed', state.lastError);
  if (state.attempts >= state.maxAttempts) return enterHostEmergency_(state, state.lastError);

  setServerOfflineInternal_(state.targetKey, HOST_CONFIG.AUTOMATIC_OFFLINE_HOURS, state.lastError, 'automatic');
  const inventory = refreshServerInventory_();
  const candidate = selectBestServer_(inventory, state.triedKeys || []);
  if (!candidate) return enterHostEmergency_(state, state.lastError + ' No additional eligible server is available.');
  state.sourceKey = PropertiesService.getScriptProperties().getProperty('HOST_ACTIVE_KEY') || state.targetKey;
  state.targetKey = candidate.key;
  state.triedKeys = (state.triedKeys || []).concat([candidate.key]);
  state.attempts += 1;
  state.phase = 'preparing';
  state.deployId = '';
  state.stepFailures = 0;
  state.attemptStartedAt = '';
  state.validateAfter = '';
  state.updatedAt = new Date().toISOString();
  saveHostSwitchState_(state);
  writeHostSwitchLog_(state, 'retrying', 'Starting final automatic attempt on ' + candidate.name + '.');
  try {
    beginHostSwitchAttempt_(state);
  } catch (error) {
    enterHostEmergency_(state, 'Final host-switch attempt could not start: ' + (error.message || String(error)));
  }
}

function finalizeSuccessfulHostSwitch_(state, http, discord, settings) {
  const target = requireServerByKey_(state.targetKey);
  suspendAllExcept_(target.key);
  PropertiesService.getScriptProperties().setProperty('HOST_LAST_SWITCH_JSON', JSON.stringify({
    id: state.id, mode: state.mode, reason: state.reason, sourceKey: state.originalKey,
    targetKey: target.key, attempts: state.attempts, completedAt: new Date().toISOString()
  }));
  finalizePublicRecovery_(http, discord, settings);
  writeHostSwitchLog_(state, 'completed', 'Host switch validated successfully on ' + target.name + '.');
  sendAdminHostEmail_('The Secretary host switch validated', 'The Secretary is healthy on ' + target.name + '.\nAttempts: ' + state.attempts + '\nReason: ' + state.reason);
  PropertiesService.getScriptProperties().deleteProperty('HOST_SWITCH_STATE');
  PropertiesService.getScriptProperties().deleteProperty('HOST_AUTOMATION_EMERGENCY');
  invalidateServerInventory_();
}

function finalizePublicRecovery_(http, discord, settings) {
  const props = PropertiesService.getScriptProperties();
  if (http.up && props.getProperty('HTTP_DOWN') === '1') {
    const incident = resolveIncident_(props.getProperty('HTTP_INCIDENT_ID'), 'Automated monitoring confirms the service has recovered after host validation (HTTP ' + http.statusCode + ', ' + http.responseMs + ' ms).');
    props.deleteProperty('HTTP_DOWN'); props.deleteProperty('HTTP_INCIDENT_ID'); props.setProperty('HTTP_FAILURES', '0');
    if (incident) deliverAutomatedEvent_('http_up', incident, settings, 'incidents');
  }
  if (!discord.rateLimited && discord.state === 'operational' && props.getProperty('DISCORD_LIMITED') === '1') {
    const incident = resolveIncident_(props.getProperty('DISCORD_INCIDENT_ID'), 'The Discord API probe is back to normal after host validation.');
    props.deleteProperty('DISCORD_LIMITED'); props.deleteProperty('DISCORD_INCIDENT_ID');
    if (incident) deliverAutomatedEvent_('discord_normal', incident, settings, 'incidents');
  }
}

function enterHostEmergency_(state, reason) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('HOST_AUTOMATION_EMERGENCY', '1');
  if (state) {
    state.phase = 'emergency'; state.lastError = cleanText_(reason, 1000); state.updatedAt = new Date().toISOString();
    writeHostSwitchLog_(state, 'emergency', state.lastError);
    props.setProperty('HOST_LAST_SWITCH_JSON', JSON.stringify(sanitizeSwitchState_(state)));
    props.deleteProperty('HOST_SWITCH_STATE');
  }
  sendAdminHostEmail_('EMERGENCY: all automatic host switches failed', 'The Secretary host controller stopped after its allowed attempts.\n\n' + reason + '\n\nManual intervention is required.');
  return {emergency: true};
}

function hostSwitchBlocksRecovery_() {
  const state = getHostSwitchState_();
  return Boolean(state && ['preparing','waiting_deploy','cutover','validating'].indexOf(state.phase) >= 0);
}

function getHostSwitchState_() {
  const raw = PropertiesService.getScriptProperties().getProperty('HOST_SWITCH_STATE');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (error) { return null; }
}

function saveHostSwitchState_(state) {
  PropertiesService.getScriptProperties().setProperty('HOST_SWITCH_STATE', JSON.stringify(state));
}

function sanitizeSwitchState_(state) {
  if (!state) return null;
  return {
    id:state.id, mode:state.mode, reason:state.reason, phase:state.phase, attempts:state.attempts,
    maxAttempts:state.maxAttempts, sourceKey:state.sourceKey, targetKey:state.targetKey,
    createdAt:state.createdAt, updatedAt:state.updatedAt, cutoverAt:state.cutoverAt || null,
    validateAfter:state.validateAfter || null, lastError:state.lastError || ''
  };
}

function getConfiguredServers_() {
  const props = PropertiesService.getScriptProperties();
  return HOST_SERVERS.map(function (definition) {
    return Object.assign({}, definition, {
      serviceId: String(props.getProperty(definition.serviceIdProperty) || '').trim(),
      apiKey: String(props.getProperty(definition.apiKeyProperty) || '').trim(),
      bandwidthLimitGb: Number(props.getProperty('HOST_' + definition.key.toUpperCase() + '_BANDWIDTH_GB') || HOST_CONFIG.DEFAULT_BANDWIDTH_GB),
      pipelineLimitMinutes: Number(props.getProperty('HOST_' + definition.key.toUpperCase() + '_PIPELINE_MINUTES') || HOST_CONFIG.DEFAULT_PIPELINE_MINUTES)
    });
  }).filter(function (server) { return server.serviceId && server.apiKey; });
}

function requireServerByKey_(key) {
  const server = getConfiguredServers_().find(function (item) { return item.key === key; });
  if (!server) throw new Error('Render credentials are missing for server "' + key + '".');
  return server;
}

function getServerAdminPayload_(forceRefresh) {
  let inventory;
  try { inventory = getServerInventory_(Boolean(forceRefresh)); }
  catch (error) { inventory = getCachedServerInventory_(); if (!inventory.length) throw error; }
  const activeKey = discoverActiveServerKey_(inventory);
  const offline = getOfflineServers_();
  const switchState = getHostSwitchState_();
  return {
    generatedAt: new Date().toISOString(), activeKey: activeKey, servers: inventory.map(function (server) {
      const hold = offline[server.key] || null;
      return Object.assign({}, server, {
        active: server.key === activeKey,
        offlineUntil: hold ? hold.until : null,
        offlineReason: hold ? hold.reason : '',
        eligible: server.key !== activeKey && !hold && !server.error
      });
    }),
    switchState: sanitizeSwitchState_(switchState),
    lastSwitch: parseJsonProperty_('HOST_LAST_SWITCH_JSON'),
    emergency: PropertiesService.getScriptProperties().getProperty('HOST_AUTOMATION_EMERGENCY') === '1',
    manualRetryAt: manualRetryAt_(),
    pipelineUsageIsEstimate: true,
    recentSwitches: sortRecords_(readRecords_('hostSwitches'), 'updatedAt').slice(0, 20)
  };
}

function getServerInventory_(forceRefresh) {
  const cache = parseJsonProperty_('HOST_INVENTORY_CACHE');
  if (!forceRefresh && cache && Array.isArray(cache.servers)) return cache.servers;
  return refreshServerInventory_();
}

function getCachedServerInventory_() {
  const cache = parseJsonProperty_('HOST_INVENTORY_CACHE');
  return cache && Array.isArray(cache.servers) ? cache.servers : [];
}

function invalidateServerInventory_() { PropertiesService.getScriptProperties().deleteProperty('HOST_INVENTORY_CACHE'); }

function refreshServerInventory_() {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);
  const now = new Date();
  const configured = getConfiguredServers_();
  const requests = [];
  configured.forEach(function (server) {
    const headers = {Authorization:'Bearer ' + server.apiKey,Accept:'application/json'};
    requests.push({url:'https://api.render.com/v1/services/' + encodeURIComponent(server.serviceId),method:'get',headers:headers,muteHttpExceptions:true,followRedirects:true});
    requests.push({url:'https://api.render.com/v1/metrics/bandwidth?startTime=' + encodeURIComponent(monthStart.toISOString()) + '&endTime=' + encodeURIComponent(now.toISOString()) + '&resource=' + encodeURIComponent(server.serviceId),method:'get',headers:headers,muteHttpExceptions:true,followRedirects:true});
    requests.push({url:'https://api.render.com/v1/services/' + encodeURIComponent(server.serviceId) + '/deploys?limit=100&createdAfter=' + encodeURIComponent(monthStart.toISOString()),method:'get',headers:headers,muteHttpExceptions:true,followRedirects:true});
  });
  const responses = requests.length ? UrlFetchApp.fetchAll(requests) : [];
  const servers = configured.map(function (server, index) {
    const safe = {key:server.key,name:server.name,region:server.region,serviceId:server.serviceId,bandwidthLimitGb:server.bandwidthLimitGb,pipelineLimitMinutes:server.pipelineLimitMinutes};
    try {
      const serviceResponse = decodeJsonResponse_(responses[index * 3], [200], 'Render').data;
      const service = serviceResponse.service || serviceResponse;
      const bandwidth = decodeJsonResponse_(responses[index * 3 + 1], [200], 'Render').data;
      const deployResponse = decodeJsonResponse_(responses[index * 3 + 2], [200], 'Render').data;
      const usedBytes = Math.max(0, sumBandwidthBytes_(bandwidth));
      const deploys = Array.isArray(deployResponse) ? deployResponse.map(function (entry) { return entry.deploy || entry; }) : [];
      const pipelineUsed = estimatePipelineMinutes_(deploys, monthStart);
      const details = service.serviceDetails || {};
      const serviceUrl = details.url || service.url || '';
      return Object.assign(safe, {
        url: serviceUrl, hostname: hostnameFromUrl_(serviceUrl),
        suspended: service.suspended === true || String(service.suspended || '').toLowerCase() === 'suspended',
        renderRegion: details.region || service.region || server.region, plan: details.plan || service.plan || '', branch: service.branch || '',
        bandwidthUsedBytes: usedBytes,
        bandwidthRemainingBytes: Math.max(0, server.bandwidthLimitGb * 1000000000 - usedBytes),
        bandwidthRemainingPercent: Math.max(0, Math.min(100, (1 - usedBytes / (server.bandwidthLimitGb * 1000000000)) * 100)),
        pipelineUsedMinutesEstimate: pipelineUsed,
        pipelineRemainingMinutesEstimate: Math.max(0, server.pipelineLimitMinutes - pipelineUsed),
        error: ''
      });
    } catch (error) {
      return Object.assign(safe, {url:'',hostname:'',suspended:null,bandwidthUsedBytes:null,bandwidthRemainingBytes:null,bandwidthRemainingPercent:null,pipelineUsedMinutesEstimate:null,pipelineRemainingMinutesEstimate:null,error:error.message || String(error)});
    }
  });
  PropertiesService.getScriptProperties().setProperty('HOST_INVENTORY_CACHE', JSON.stringify({generatedAt:new Date().toISOString(),servers:servers}));
  return servers;
}

function selectBestServer_(inventory, excludedKeys) {
  const excluded = {};
  (excludedKeys || []).forEach(function (key) { excluded[key] = true; });
  const offline = getOfflineServers_();
  return inventory.filter(function (server) {
    return !excluded[server.key] && !offline[server.key] && !server.error && Number.isFinite(Number(server.bandwidthRemainingBytes));
  }).sort(function (a, b) {
    const bandwidth = Number(b.bandwidthRemainingBytes) - Number(a.bandwidthRemainingBytes);
    if (bandwidth !== 0) return bandwidth;
    return Number(b.pipelineRemainingMinutesEstimate || 0) - Number(a.pipelineRemainingMinutesEstimate || 0);
  })[0] || null;
}

function discoverActiveServerKey_(inventory) {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('HOST_ACTIVE_KEY');
  let dnsTarget = '';
  try { dnsTarget = getCloudflareDnsRecord_(HOST_CONFIG.DOMAINS[0]).content || ''; } catch (error) {}
  const normalizedTarget = String(dnsTarget || '').toLowerCase().replace(/^https?:\/\//,'').replace(/[\/.]+$/,'');
  const found = inventory.find(function (server) { return server.hostname && server.hostname.toLowerCase().replace(/\.$/,'') === normalizedTarget; });
  if (found) { props.setProperty('HOST_ACTIVE_KEY', found.key); return found.key; }
  const running = inventory.filter(function (server) { return !server.error && server.suspended === false; });
  if (running.length === 1) { props.setProperty('HOST_ACTIVE_KEY', running[0].key); return running[0].key; }
  return stored && inventory.some(function (server) { return server.key === stored; }) ? stored : '';
}

function setServerOffline_(serverKey, hours, reason) {
  serverKey = String(serverKey || '').trim();
  hours = Number(hours);
  reason = requiredText_(reason, 500, 'A reason is required for an offline hold.');
  if ([24,48].indexOf(hours) < 0) throw new Error('Offline duration must be 24 or 48 hours.');
  requireServerByKey_(serverKey);
  return setServerOfflineInternal_(serverKey, hours, reason, 'manual');
}

function setServerOfflineInternal_(serverKey, hours, reason, source) {
  const offline = getOfflineServers_();
  offline[serverKey] = {until:new Date(Date.now() + Number(hours) * 3600000).toISOString(),reason:cleanText_(reason,500),source:source||'manual',createdAt:new Date().toISOString()};
  PropertiesService.getScriptProperties().setProperty('HOST_OFFLINE_JSON', JSON.stringify(offline));
  return {serverKey:serverKey,offline:offline[serverKey]};
}

function clearServerOffline_(serverKey) {
  serverKey = String(serverKey || '').trim();
  requireServerByKey_(serverKey);
  const offline = getOfflineServers_();
  delete offline[serverKey];
  PropertiesService.getScriptProperties().setProperty('HOST_OFFLINE_JSON', JSON.stringify(offline));
  return {serverKey:serverKey};
}

function getOfflineServers_() {
  const props = PropertiesService.getScriptProperties();
  const raw = parseJsonProperty_('HOST_OFFLINE_JSON') || {};
  let changed = false;
  Object.keys(raw).forEach(function (key) {
    if (!raw[key] || new Date(raw[key].until).getTime() <= Date.now()) { delete raw[key]; changed = true; }
  });
  if (changed) props.setProperty('HOST_OFFLINE_JSON', JSON.stringify(raw));
  return raw;
}

function suspendAllExcept_(activeKey) {
  getConfiguredServers_().forEach(function (server) {
    if (server.key === activeKey) return;
    try {
      const response = renderRequest_(server, '/services/' + encodeURIComponent(server.serviceId), 'get', null, [200]).data;
      const service = response.service || response;
      const suspended = service.suspended === true || String(service.suspended || '').toLowerCase() === 'suspended';
      if (!suspended) renderRequest_(server, '/services/' + encodeURIComponent(server.serviceId) + '/suspend', 'post', null, [202]);
    } catch (error) {
      console.error('Unable to suspend ' + server.name + ': ' + (error.message || String(error)));
    }
  });
  invalidateServerInventory_();
}

function enforceStandbySuspension_() {
  try {
    const inventory = getServerInventory_(false);
    const activeKey = discoverActiveServerKey_(inventory);
    if (!activeKey) return;
    let changed = false;
    inventory.forEach(function (item) {
      if (item.key === activeKey || item.suspended !== false) return;
      const server = requireServerByKey_(item.key);
      renderRequest_(server, '/services/' + encodeURIComponent(server.serviceId) + '/suspend', 'post', null, [202]);
      item.suspended = true; changed = true;
    });
    if (changed) PropertiesService.getScriptProperties().setProperty('HOST_INVENTORY_CACHE', JSON.stringify({generatedAt:new Date().toISOString(),servers:inventory}));
  } catch (error) {
    console.error('Standby suspension enforcement failed: ' + (error.message || String(error)));
  }
}

function deleteRenderDomain_(server, domain) {
  renderRequest_(server, '/services/' + encodeURIComponent(server.serviceId) + '/custom-domains/' + encodeURIComponent(domain), 'delete', null, [204,404]);
}

function ensureRenderDomain_(server, domain) {
  const created = renderRequest_(server, '/services/' + encodeURIComponent(server.serviceId) + '/custom-domains', 'post', {name:domain}, [201,409]);
  if (created.statusCode === 409) {
    renderRequest_(server, '/services/' + encodeURIComponent(server.serviceId) + '/custom-domains/' + encodeURIComponent(domain), 'get', null, [200]);
  }
}

function updateCloudflareRecord_(hostname, target) {
  const record = getCloudflareDnsRecord_(hostname);
  const zoneId = requiredScriptProperty_('CLOUDFLARE_ZONE_ID');
  return cloudflareRequest_('/zones/' + encodeURIComponent(zoneId) + '/dns_records/' + encodeURIComponent(record.id), 'patch', {
    type:'CNAME', name:hostname, content:target, proxied:true, ttl:1
  }, [200]).data;
}

function getCloudflareDnsRecord_(hostname) {
  const zoneId = requiredScriptProperty_('CLOUDFLARE_ZONE_ID');
  const response = cloudflareRequest_('/zones/' + encodeURIComponent(zoneId) + '/dns_records?type=CNAME&name=' + encodeURIComponent(hostname), 'get', null, [200]).data;
  const records = response.result || [];
  if (!records.length) throw new Error('Cloudflare CNAME record not found for ' + hostname + '.');
  return records[0];
}

function renderRequest_(server, path, method, body, acceptedCodes) {
  return externalJsonRequest_('https://api.render.com/v1' + path, method, body, {
    Authorization:'Bearer ' + server.apiKey,
    Accept:'application/json'
  }, acceptedCodes, 'Render');
}

function cloudflareRequest_(path, method, body, acceptedCodes) {
  return externalJsonRequest_('https://api.cloudflare.com/client/v4' + path, method, body, {
    Authorization:'Bearer ' + requiredScriptProperty_('CLOUDFLARE_API_TOKEN'),
    Accept:'application/json'
  }, acceptedCodes, 'Cloudflare');
}

function externalJsonRequest_(url, method, body, headers, acceptedCodes, provider) {
  const options = {method:String(method || 'get').toLowerCase(),muteHttpExceptions:true,followRedirects:true,headers:headers};
  if (body !== null && body !== undefined) { options.contentType = 'application/json'; options.payload = JSON.stringify(body); }
  const response = UrlFetchApp.fetch(url, options);
  return decodeJsonResponse_(response, acceptedCodes, provider);
}

function decodeJsonResponse_(response, acceptedCodes, provider) {
  const code = response.getResponseCode();
  const text = response.getContentText() || '';
  let data = {};
  if (text) { try { data = JSON.parse(text); } catch (error) { data = {raw:text}; } }
  if ((acceptedCodes || [200]).indexOf(code) < 0) {
    const detail = data.message || (data.errors && data.errors[0] && data.errors[0].message) || text || 'No response body';
    throw new Error(provider + ' API returned HTTP ' + code + ': ' + String(detail).slice(0,500));
  }
  if (provider === 'Cloudflare' && data.success === false) throw new Error('Cloudflare API rejected the request.');
  return {statusCode:code,data:data};
}

function sumMetricValues_(node) {
  if (node === null || node === undefined) return 0;
  if (Array.isArray(node)) {
    if (node.length === 2 && Number.isFinite(Number(node[1])) && (typeof node[0] === 'string' || Number(node[0]) > 1000000000)) return Number(node[1]);
    return node.reduce(function (sum, item) { return sum + sumMetricValues_(item); }, 0);
  }
  if (typeof node !== 'object') return 0;
  if (Object.prototype.hasOwnProperty.call(node, 'value') && Number.isFinite(Number(node.value))) return Number(node.value);
  if (Object.prototype.hasOwnProperty.call(node, 'values')) return sumMetricValues_(node.values);
  return ['data','result','series'].reduce(function (sum, key) { return sum + (Object.prototype.hasOwnProperty.call(node,key) ? sumMetricValues_(node[key]) : 0); }, 0);
}

function sumBandwidthBytes_(payload) {
  const series = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.data) ? payload.data : []);
  if (!series.length) return sumMetricValues_(payload);
  return series.reduce(function (total, item) {
    const unit = String((item && item.unit) || 'bytes').toLowerCase().replace(/\s+/g,'');
    let multiplier = 1;
    if (unit === 'kb' || unit === 'kilobytes') multiplier = 1000;
    else if (unit === 'kib') multiplier = 1024;
    else if (unit === 'mb' || unit === 'megabytes') multiplier = 1000000;
    else if (unit === 'mib') multiplier = 1048576;
    else if (unit === 'gb' || unit === 'gigabytes') multiplier = 1000000000;
    else if (unit === 'gib') multiplier = 1073741824;
    else if (unit === 'tb' || unit === 'terabytes') multiplier = 1000000000000;
    return total + sumMetricValues_(item && Object.prototype.hasOwnProperty.call(item,'values') ? item.values : item) * multiplier;
  }, 0);
}

function estimatePipelineMinutes_(deploys, monthStart) {
  return Math.round(deploys.reduce(function (minutes, deploy) {
    const start = new Date(deploy.startedAt || deploy.createdAt || 0).getTime();
    const end = new Date(deploy.finishedAt || deploy.updatedAt || 0).getTime();
    if (!start || !end || end <= start || start < monthStart.getTime()) return minutes;
    return minutes + (end - start) / 60000;
  }, 0));
}

function hostnameFromUrl_(value) {
  const match = String(value || '').match(/^https?:\/\/([^\/:?#]+)/i);
  return match ? match[1].toLowerCase() : '';
}

function requiredScriptProperty_(name) {
  const value = String(PropertiesService.getScriptProperties().getProperty(name) || '').trim();
  if (!value) throw new Error('Missing Apps Script property: ' + name + '.');
  return value;
}

function parseJsonProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) return null;
  try { return JSON.parse(value); } catch (error) { return null; }
}

function manualRetryAt_() {
  const last = Number(PropertiesService.getScriptProperties().getProperty('HOST_LAST_MANUAL_SWITCH_AT') || 0);
  return last ? new Date(last + HOST_CONFIG.MANUAL_RATE_LIMIT_MINUTES * 60000).toISOString() : null;
}

function sendAdminHostEmail_(subject, body) {
  try { MailApp.sendEmail({to:STATUS_CONFIG.ADMIN_EMAIL,subject:subject,body:body}); }
  catch (error) { console.error('Host-management email failed: ' + (error.message || String(error))); }
}

function writeHostSwitchLog_(state, status, message) {
  const now = new Date().toISOString();
  const existing = findRecordById_('hostSwitches', state.id);
  const item = existing || {id:state.id,slug:state.id,createdAt:state.createdAt || now,events:[]};
  item.mode = state.mode; item.reason = state.reason; item.sourceKey = state.sourceKey; item.targetKey = state.targetKey;
  item.attempts = state.attempts; item.status = status; item.message = cleanText_(message,1000); item.updatedAt = now;
  item.events = item.events || [];
  item.events.push({status:status,message:item.message,createdAt:now,targetKey:state.targetKey,attempt:state.attempts});
  writeRecord_('hostSwitches', item);
}

function initializeSheets_() { const db=getDb_();Object.keys(STATUS_CONFIG.SHEETS).forEach(function(name){let sheet=db.getSheetByName(name);if(!sheet)sheet=db.insertSheet(name);if(sheet.getLastRow()===0)sheet.appendRow(STATUS_CONFIG.SHEETS[name]);});const first=db.getSheets()[0];if(first&&first.getName()==='Sheet1'&&first.getLastRow()===0&&Object.keys(STATUS_CONFIG.SHEETS).length>0)db.deleteSheet(first);if(!Object.keys(readSettings_()).length)saveSettings_(DEFAULT_SETTINGS); }
function getDb_() { const id=PropertiesService.getScriptProperties().getProperty('STATUS_SPREADSHEET_ID');if(!id)throw new Error('Run setupStatusBackend once before deployment.');return SpreadsheetApp.openById(id); }
function getSheet_(name) { const sheet=getDb_().getSheetByName(name);if(!sheet)throw new Error('Missing data sheet: '+name);return sheet; }
function readSettings_() { const rows=getSheet_('settings').getDataRange().getValues();const out={};for(let i=1;i<rows.length;i++)if(rows[i][0])out[String(rows[i][0])]=String(rows[i][1]);return out; }
function getSettings_() { const raw=readSettings_();return {monitorName:raw.monitorName||DEFAULT_SETTINGS.monitorName,description:raw.description||DEFAULT_SETTINGS.description,targetUrl:raw.targetUrl||DEFAULT_SETTINGS.targetUrl,discordStatusUrl:raw.discordStatusUrl||DEFAULT_SETTINGS.discordStatusUrl,failureThreshold:Number(raw.failureThreshold||1),webhookHttp:raw.webhookHttp||'',webhookDiscord:raw.webhookDiscord||'',webhookPost:raw.webhookPost||'',webhookMaintenance:raw.webhookMaintenance||''}; }
function saveSettings_(settings) { const current=readSettings_();Object.keys(settings).forEach(function(k){current[k]=String(settings[k]);});saveSettingMap_('',current); }
function saveSettingMap_(prefix,map) { const sheet=getSheet_('settings');const rows=sheet.getDataRange().getValues();const index={};for(let i=1;i<rows.length;i++)index[String(rows[i][0])]=i+1;Object.keys(map).forEach(function(k){const key=prefix+k;if(index[key])sheet.getRange(index[key],2).setValue(String(map[k]));else sheet.appendRow([key,String(map[k])]);}); }
function getTemplates_() { const raw=readSettings_();const out={};Object.keys(DEFAULT_TEMPLATES).forEach(function(k){out[k]=raw['template.'+k]||DEFAULT_TEMPLATES[k];});return out; }

function appendCheck_(http,discord) { getSheet_('checks').appendRow([http.checkedAt,http.up,http.statusCode,http.responseMs,http.error||'',discord.rateLimited,discord.state,discord.checkedAt]); }
function getChecks_() { const rows=getSheet_('checks').getDataRange().getValues();return rows.slice(1).filter(function(r){return r[0];}).map(function(r){return{checkedAt:new Date(r[0]).toISOString(),up:r[1]===true||String(r[1]).toLowerCase()==='true',statusCode:r[2]===''?null:Number(r[2]),responseMs:r[3]===''?null:Number(r[3]),error:String(r[4]||''),discordRateLimited:r[5]===true||String(r[5]).toLowerCase()==='true',discordState:String(r[6]||'unknown'),discordCheckedAt:r[7]?new Date(r[7]).toISOString():null};}); }
function pruneChecks_() { const sheet=getSheet_('checks');const rows=sheet.getDataRange().getValues();const cutoff=Date.now()-STATUS_CONFIG.RETENTION_DAYS*86400000;let remove=0;for(let i=1;i<rows.length;i++){if(new Date(rows[i][0]).getTime()<cutoff)remove++;else break;}if(remove>0)sheet.deleteRows(2,remove); }

function readRecords_(name) { const rows=getSheet_(name).getDataRange().getValues();return rows.slice(1).map(function(r){try{return JSON.parse(String(r[2]||'{}'));}catch(error){return null;}}).filter(Boolean); }
function writeRecord_(name,item) { const sheet=getSheet_(name);const rows=sheet.getDataRange().getValues();for(let i=1;i<rows.length;i++){if(String(rows[i][0])===String(item.id)){sheet.getRange(i+1,1,1,4).setValues([[item.id,item.slug,JSON.stringify(item),item.updatedAt||new Date().toISOString()]]);return;}}sheet.appendRow([item.id,item.slug,JSON.stringify(item),item.updatedAt||new Date().toISOString()]); }
function deleteRecord_(name,id) { const sheet=getSheet_(name);const rows=sheet.getDataRange().getValues();for(let i=1;i<rows.length;i++){if(String(rows[i][0])===String(id)){sheet.deleteRow(i+1);return;}}throw new Error('Record not found.'); }
function findRecordById_(name,id) { return readRecords_(name).find(function(x){return String(x.id)===String(id);})||null; }
function findRecordBySlug_(name,slug) { return readRecords_(name).find(function(x){return String(x.slug)===String(slug);})||null; }
function sortRecords_(items,key) { return items.sort(function(a,b){return new Date(b[key]||b.updatedAt||0)-new Date(a[key]||a.updatedAt||0);}); }
function activeSubscribers_() { const rows=getSheet_('subscribers').getDataRange().getValues();return rows.slice(1).filter(function(r){return r[2]===true||String(r[2]).toLowerCase()==='true';}).map(function(r){return{email:String(r[0]),token:String(r[1])};}); }

function uniqueSlug_(sheet,value) { const base=normalizeSlug_(value)||'update';let slug=base;let n=2;while(findRecordBySlug_(sheet,slug)){slug=base+'-'+n++;}return slug; }
function ensureSlugAvailable_(sheet,slug,id) { const found=findRecordBySlug_(sheet,slug);if(found&&String(found.id)!==String(id))throw new Error('That slug is already in use.'); }
function normalizeSlug_(value) { return String(value||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120); }
function requiredText_(value,max,message) { const text=cleanText_(value,max);if(!text)throw new Error(message);return text; }
function cleanText_(value,max) { return String(value||'').trim().slice(0,max); }
function cleanHtml_(value) { return String(value||'').trim().slice(0,50000); }
function validHttps_(value) { value=String(value||'').trim();if(!/^https:\/\//i.test(value))throw new Error('A valid HTTPS URL is required.');return value; }
function validWebhook_(value) { value=String(value||'').trim();if(value&&!/^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\//i.test(value))throw new Error('Invalid Discord webhook URL.');return value; }
function capitalize_(s) { return s.charAt(0).toUpperCase()+s.slice(1); }
function escapeHtml_(s) { return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function requireAdmin_(accessToken) {
  accessToken = String(accessToken || '').trim();
  if (!accessToken) throw new Error('Administrator login required.');
  const props = PropertiesService.getScriptProperties();
  const baseUrl = String(props.getProperty('SUPABASE_URL') || '').replace(/\/$/, '');
  const publishableKey = String(props.getProperty('SUPABASE_PUBLISHABLE_KEY') || '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(baseUrl) || !publishableKey) {
    throw new Error('Supabase administrator verification is not configured.');
  }
  const headers = {apikey: publishableKey, Authorization: 'Bearer ' + accessToken};
  const userResponse = UrlFetchApp.fetch(baseUrl + '/auth/v1/user', {headers: headers, muteHttpExceptions: true});
  if (userResponse.getResponseCode() !== 200) throw new Error('Administrator session is invalid or expired.');
  const user = JSON.parse(userResponse.getContentText() || '{}');
  if (!user.id || String(user.email || '').toLowerCase() !== STATUS_CONFIG.ADMIN_EMAIL.toLowerCase()) {
    throw new Error('This account is not authorized for the control room.');
  }
  const profileResponse = UrlFetchApp.fetch(baseUrl + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=role', {headers: headers, muteHttpExceptions: true});
  if (profileResponse.getResponseCode() !== 200) throw new Error('Administrator profile could not be verified.');
  const profiles = JSON.parse(profileResponse.getContentText() || '[]');
  if (!profiles.length || profiles[0].role !== 'admin') throw new Error('Administrator role required.');
  return user;
}
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
