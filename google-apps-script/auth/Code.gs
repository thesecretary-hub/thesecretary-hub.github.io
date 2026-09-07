const AUTH_CONFIG = {
  OTP_MINUTES: 10,
  RESET_TICKET_MINUTES: 10,
  UNCONFIRMED_HOURS: 24,
  RESEND_SECONDS: 60,
  MAX_SENDS_PER_EMAIL_HOUR: 5,
  MAX_GLOBAL_SENDS_PER_HOUR: 120,
  MAX_CODE_ATTEMPTS: 6
};

function doGet() {
  return json_({ok:true,service:'The Secretary account verification'});
}

function doPost(e) {
  try {
    const data = e && e.parameter ? e.parameter : {};
    const action = String(data.action || '');
    let result;
    if (action === 'request_registration') result = requestRegistration_(data);
    else if (action === 'verify_registration') result = verifyRegistration_(data);
    else if (action === 'request_password_reset') result = requestPasswordReset_(data);
    else if (action === 'verify_password_reset') result = verifyPasswordReset_(data);
    else if (action === 'complete_password_reset') result = completePasswordReset_(data);
    else throw new Error('Unknown account action.');
    return json_({ok:true,...result});
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({ok:false,error:error && error.message ? error.message : 'The account service could not complete this request.'});
  }
}

function setupAuthBackend() {
  requireSecrets_();
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'cleanupUnconfirmedUsers') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('cleanupUnconfirmedUsers').timeBased().everyHours(1).create();
  return 'Account verification is configured.';
}

function requestRegistration_(data) {
  rejectBot_(data);
  const email = validEmail_(data.email);
  const username = validUsername_(data.username);
  const displayName = requiredText_(data.display_name, 80, 'Your name is required.');
  if (displayName.length < 2) throw new Error('Your name must contain at least 2 characters.');
  assertSendRate_(email);
  if (findUserByEmail_(email)) throw new Error('An account already exists for this email.');
  if (usernameExists_(username)) throw new Error('That username is already in use.');
  const issued = issueCode_('register', email, {username:username,displayName:displayName});
  try {
    sendCodeEmail_(email, issued.code, 'Confirm your The Secretary account', 'Enter this code to finish creating your account.');
  } catch (error) {
    deletePending_('register', email);
    throw error;
  }
  return {expiresInSeconds:AUTH_CONFIG.OTP_MINUTES * 60};
}

function verifyRegistration_(data) {
  rejectBot_(data);
  const email = validEmail_(data.email);
  const password = validPassword_(data.password);
  const pending = verifyCode_('register', email, data.code);
  const username = validUsername_(pending.payload.username);
  const displayName = requiredText_(pending.payload.displayName, 80, 'Your name is required.');
  if (findUserByEmail_(email)) {
    deletePending_('register', email);
    throw new Error('An account already exists for this email.');
  }
  if (usernameExists_(username)) throw new Error('That username was claimed while you were verifying. Choose another username and start again.');
  const user = supabaseRequest_('/auth/v1/admin/users', 'post', {
    email:email,
    password:password,
    email_confirm:true,
    user_metadata:{display_name:displayName,username:username}
  });
  deletePending_('register', email);
  return {created:true,userId:user.id};
}

function requestPasswordReset_(data) {
  rejectBot_(data);
  const email = validEmail_(data.email);
  assertSendRate_(email);
  const user = findUserByEmail_(email);
  if (user && user.email_confirmed_at) {
    const issued = issueCode_('reset', email, {userId:user.id});
    try {
      sendCodeEmail_(email, issued.code, 'Reset your The Secretary password', 'Enter this code on the login page to continue resetting your password.');
    } catch (error) {
      deletePending_('reset', email);
      throw error;
    }
  }
  return {message:'If an account exists for this email, a reset code has been sent.',expiresInSeconds:AUTH_CONFIG.OTP_MINUTES * 60};
}

function verifyPasswordReset_(data) {
  rejectBot_(data);
  const email = validEmail_(data.email);
  const pending = verifyCode_('reset', email, data.code);
  const ticket = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  pending.codeHash = '';
  pending.ticketHash = hash_(ticket);
  pending.ticketExpiresAt = Date.now() + AUTH_CONFIG.RESET_TICKET_MINUTES * 60000;
  pending.expiresAt = pending.ticketExpiresAt;
  savePending_('reset', email, pending);
  return {ticket:ticket,expiresInSeconds:AUTH_CONFIG.RESET_TICKET_MINUTES * 60};
}

function completePasswordReset_(data) {
  rejectBot_(data);
  const email = validEmail_(data.email);
  const password = validPassword_(data.password);
  const ticket = String(data.ticket || '');
  const pending = getPending_('reset', email);
  if (!pending || !pending.ticketHash || pending.ticketExpiresAt < Date.now() || hash_(ticket) !== pending.ticketHash) {
    throw new Error('This password-reset session has expired. Request a new code.');
  }
  const user = findUserByEmail_(email);
  if (!user || String(user.id) !== String(pending.payload.userId)) throw new Error('This account is no longer available.');
  supabaseRequest_('/auth/v1/admin/users/' + encodeURIComponent(user.id), 'put', {password:password});
  deletePending_('reset', email);
  return {updated:true};
}

function cleanupUnconfirmedUsers() {
  const cutoff = Date.now() - AUTH_CONFIG.UNCONFIRMED_HOURS * 3600000;
  let deleted = 0;
  listUsers_().forEach(function(user) {
    if (!user.email_confirmed_at && new Date(user.created_at).getTime() < cutoff) {
      supabaseRequest_('/auth/v1/admin/users/' + encodeURIComponent(user.id), 'delete');
      deleted += 1;
    }
  });
  cleanupExpiredProperties_();
  console.log('Deleted ' + deleted + ' unconfirmed Supabase account(s).');
  return deleted;
}

function issueCode_(purpose, email, payload) {
  const existing = getPending_(purpose, email);
  if (existing && Date.now() - Number(existing.sentAt || 0) < AUTH_CONFIG.RESEND_SECONDS * 1000) {
    throw new Error('Please wait before requesting another code.');
  }
  const code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % 1000000).padStart(6, '0');
  const record = {
    codeHash:hash_(purpose + '|' + email + '|' + code),
    expiresAt:Date.now() + AUTH_CONFIG.OTP_MINUTES * 60000,
    sentAt:Date.now(),
    attempts:0,
    payload:payload || {}
  };
  savePending_(purpose, email, record);
  return {code:code};
}

function verifyCode_(purpose, email, suppliedCode) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const pending = getPending_(purpose, email);
    if (!pending || pending.expiresAt < Date.now()) {
      deletePending_(purpose, email);
      throw new Error('This code has expired. Request a new one.');
    }
    if (Number(pending.attempts || 0) >= AUTH_CONFIG.MAX_CODE_ATTEMPTS) {
      deletePending_(purpose, email);
      throw new Error('Too many incorrect attempts. Request a new code.');
    }
    const expected = hash_(purpose + '|' + email + '|' + String(suppliedCode || '').trim());
    if (!/^\d{6}$/.test(String(suppliedCode || '').trim()) || expected !== pending.codeHash) {
      pending.attempts = Number(pending.attempts || 0) + 1;
      savePending_(purpose, email, pending);
      throw new Error('That verification code is incorrect.');
    }
    return pending;
  } finally {
    lock.releaseLock();
  }
}

function assertSendRate_(email) {
  const lock=LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const now = Date.now();
    const hourAgo = now - 3600000;
    const props = PropertiesService.getScriptProperties();
    const emailKey = 'RATE_EMAIL_' + shortHash_(email);
    const globalKey = 'RATE_GLOBAL';
    const emailTimes = parseTimes_(props.getProperty(emailKey)).filter(function(x){return x >= hourAgo;});
    const globalTimes = parseTimes_(props.getProperty(globalKey)).filter(function(x){return x >= hourAgo;});
    if (emailTimes.length >= AUTH_CONFIG.MAX_SENDS_PER_EMAIL_HOUR) throw new Error('Too many codes were requested. Try again later.');
    if (globalTimes.length >= AUTH_CONFIG.MAX_GLOBAL_SENDS_PER_HOUR) throw new Error('The email service is busy. Try again later.');
    emailTimes.push(now);
    globalTimes.push(now);
    props.setProperty(emailKey, JSON.stringify(emailTimes));
    props.setProperty(globalKey, JSON.stringify(globalTimes));
  } finally {
    lock.releaseLock();
  }
}

function usernameExists_(username) {
  const rows = supabaseRequest_('/rest/v1/profiles?select=id&username=eq.' + encodeURIComponent(username) + '&limit=1', 'get');
  return Array.isArray(rows) && rows.length > 0;
}

function findUserByEmail_(email) {
  const users = listUsers_();
  return users.find(function(user){return String(user.email || '').toLowerCase() === email;}) || null;
}

function listUsers_() {
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = supabaseRequest_('/auth/v1/admin/users?page=' + page + '&per_page=100', 'get');
    const batch = Array.isArray(result) ? result : (result.users || []);
    users.push.apply(users, batch);
    if (batch.length < 100) break;
  }
  return users;
}

function supabaseRequest_(path, method, body) {
  const secrets = requireSecrets_();
  const options = {
    method:method,
    muteHttpExceptions:true,
    headers:{apikey:secrets.serviceRole,Authorization:'Bearer ' + secrets.serviceRole}
  };
  if (body !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }
  const response = UrlFetchApp.fetch(secrets.url + path, options);
  const code = response.getResponseCode();
  const text = String(response.getContentText() || '');
  let parsed = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch (error) { parsed = {message:text}; }
  if (code < 200 || code >= 300) {
    throw new Error(parsed.msg || parsed.message || parsed.error_description || parsed.error || 'Supabase rejected the account request.');
  }
  return parsed;
}

function sendCodeEmail_(email, code, subject, message) {
  const remaining = MailApp.getRemainingDailyQuota();
  if (remaining < 1) throw new Error('The verification email quota is temporarily exhausted. Try again later.');
  MailApp.sendEmail({
    to:email,
    name:'The Secretary™',
    subject:subject,
    body:message + '\n\nVerification code: ' + code + '\n\nThis code expires in ' + AUTH_CONFIG.OTP_MINUTES + ' minutes. If you did not request this, ignore this email.',
    htmlBody:'<div style="padding:30px;background:#070708;color:#fff;font-family:Arial,sans-serif"><p style="color:#aaa;font-size:12px;letter-spacing:2px;text-transform:uppercase">The Secretary™</p><h2 style="margin:18px 0 8px">' + escapeHtml_(subject) + '</h2><p style="color:#c8c8cc">' + escapeHtml_(message) + '</p><div style="margin:26px 0;padding:18px;background:#111217;border:1px solid #30323b;font-size:34px;font-weight:800;letter-spacing:10px;text-align:center">' + code + '</div><p style="color:#888;font-size:12px">This code expires in ' + AUTH_CONFIG.OTP_MINUTES + ' minutes. If you did not request this, ignore this email.</p></div>'
  });
}

function requireSecrets_() {
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty('SUPABASE_URL') || '').replace(/\/$/, '');
  const serviceRole = String(props.getProperty('SUPABASE_SERVICE_ROLE_KEY') || '');
  const pepper = String(props.getProperty('OTP_PEPPER') || '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !serviceRole || pepper.length < 24) {
    throw new Error('Auth backend secrets are not configured.');
  }
  return {url:url,serviceRole:serviceRole,pepper:pepper};
}

function pendingKey_(purpose, email) { return 'PENDING_' + purpose.toUpperCase() + '_' + shortHash_(email); }
function getPending_(purpose, email) { const raw=PropertiesService.getScriptProperties().getProperty(pendingKey_(purpose,email));if(!raw)return null;try{return JSON.parse(raw);}catch(error){return null;} }
function savePending_(purpose, email, record) { PropertiesService.getScriptProperties().setProperty(pendingKey_(purpose,email),JSON.stringify(record)); }
function deletePending_(purpose, email) { PropertiesService.getScriptProperties().deleteProperty(pendingKey_(purpose,email)); }
function hash_(value) { const pepper=requireSecrets_().pepper;const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value)+pepper,Utilities.Charset.UTF_8);return Utilities.base64EncodeWebSafe(bytes); }
function shortHash_(value) { const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8);return Utilities.base64EncodeWebSafe(bytes).replace(/[^a-zA-Z0-9]/g,'').slice(0,32); }
function parseTimes_(raw) { try { const value=JSON.parse(raw||'[]');return Array.isArray(value)?value.map(Number).filter(Number.isFinite):[]; } catch(error) { return []; } }
function validEmail_(value) { const email=String(value||'').trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254)throw new Error('Enter a valid email address.');return email; }
function validUsername_(value) { const username=String(value||'').trim().toLowerCase();if(!/^[a-z0-9_]{3,32}$/.test(username))throw new Error('Username must use 3–32 letters, numbers, or underscores.');return username; }
function validPassword_(value) { const password=String(value||'');if(password.length<8||password.length>72)throw new Error('Password must contain 8–72 characters.');return password; }
function requiredText_(value,max,message) { const text=String(value||'').trim().slice(0,max);if(!text)throw new Error(message);return text; }
function rejectBot_(data) { if(String(data.website||''))throw new Error('Request rejected.'); }
function escapeHtml_(value) { return String(value||'').replace(/[&<>"']/g,function(char){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];}); }
function cleanupExpiredProperties_() {
  const props=PropertiesService.getScriptProperties();
  const all=props.getProperties();
  const now=Date.now();
  const hourAgo=now-3600000;
  Object.keys(all).forEach(function(key){
    if(key.indexOf('PENDING_')===0){
      try{const item=JSON.parse(all[key]);if(Math.max(Number(item.expiresAt||0),Number(item.ticketExpiresAt||0))<now)props.deleteProperty(key);}
      catch(error){props.deleteProperty(key);}
    } else if(key==='RATE_GLOBAL'||key.indexOf('RATE_EMAIL_')===0){
      const recent=parseTimes_(all[key]).filter(function(time){return time>=hourAgo;});
      if(recent.length)props.setProperty(key,JSON.stringify(recent));else props.deleteProperty(key);
    }
  });
}
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
