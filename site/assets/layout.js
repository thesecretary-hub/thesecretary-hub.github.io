import { APP_CONFIG, isSupabaseConfigured } from './config.js';
import { currentAccount, publicImage, supabase } from './supabase-client.js';

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export { esc };

export function avatarUrl(profile) {
  return publicImage('profile-media', profile?.avatar_path) || '/assets/images/favicon.png';
}

export function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, options).format(date) : 'Not available';
}

export function relativeTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'recently';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const divisions = [[60,'second'],[60,'minute'],[24,'hour'],[7,'day'],[4.345,'week'],[12,'month'],[Infinity,'year']];
  let duration = seconds;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(duration), unit);
    duration /= amount;
  }
  return 'recently';
}

function header(active, profile) {
  const links = [
    ['Status', '/', 'status'],
    ['Posts', '/posts/', 'posts'],
    ['Forums', '/forums/', 'forums'],
    ['Incidents', '/incidents/', 'incidents'],
    ['Support ↗', `${APP_CONFIG.mainSiteUrl}invite`, 'support'],
  ];
  const nav = links.map(([label, href, key]) => `<a ${active === key ? 'class="active-link" aria-current="page"' : ''} href="${href}">${label}</a>`).join('');
  const account = profile
    ? `<button class="header-account-button" type="button" data-account-toggle aria-expanded="false"><span class="user-avatar avatar-header"><img src="${avatarUrl(profile)}" alt=""></span></button>
       <div class="account-popover" data-account-menu hidden><div class="account-popover-user"><span class="user-avatar avatar-medium"><img src="${avatarUrl(profile)}" alt=""></span><span><strong>${esc(profile.display_name)}</strong><small>@${esc(profile.username)}</small></span></div><button type="button" data-profile-user="${esc(profile.username)}">View profile</button><a href="/profile/">Edit profile</a><button class="danger" type="button" data-logout>Log out</button></div>`
    : `<a class="button small account-login" href="/login/">Log in</a>`;
  return `<header class="site-header public-header"><div class="container header-inner"><a class="brand public-brand" href="/"><span class="brand-mark"><img src="/assets/images/favicon.png" alt=""></span><strong>The <em>Secretary</em></strong></a><nav class="header-nav public-nav">${nav}</nav><div class="public-header-actions"><a class="header-support" href="${APP_CONFIG.mainSiteUrl}invite">Get support</a>${account}<button class="mobile-nav-toggle" type="button" data-mobile-nav aria-expanded="false"><span></span><span></span><span></span></button></div></div><nav class="mobile-nav" data-mobile-menu hidden>${nav}</nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-grid footer-grid-new"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark"><img src="/assets/images/favicon.png" alt=""></span><strong>The <em>Secretary</em></strong></a><p>Personal tools, monitored in public.</p><span class="footer-language">Language <b>English⌄</b></span></div><div class="footer-menu"><strong>Product</strong><a href="${APP_CONFIG.mainSiteUrl}">Main site</a><a href="/posts/">System posts</a><a href="/forums/">Forums</a></div><div class="footer-menu"><strong>Resources</strong><a href="${APP_CONFIG.mainSiteUrl}documentation">Documentation</a><a href="${APP_CONFIG.mainSiteUrl}invite">Support</a><a href="/incidents/">Incidents</a></div><div class="footer-menu"><strong>Control</strong><a href="/maintenance/">Maintenance</a><a href="/admin/">Admin</a><a href="/profile/">Account</a></div><div class="footer-menu"><strong>Legal</strong><a href="/">Status</a><a href="${APP_CONFIG.mainSiteUrl}">The Secretary</a></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} The Secretary</span><span>Built for clarity</span></div><div class="footer-wordmark">SECRETARY</div></footer>`;
}

export async function mountLayout(active = '') {
  const { profile } = await currentAccount();
  document.querySelector('[data-site-header]')?.replaceChildren(document.createRange().createContextualFragment(header(active, profile)));
  document.querySelector('[data-site-footer]')?.replaceChildren(document.createRange().createContextualFragment(footer()));
  if (!isSupabaseConfigured()) showToast('Community features need the Supabase Project URL.', 'info', 8000);
  bindLayout(profile);
  return profile;
}

function bindLayout(profile) {
  const menu = document.querySelector('[data-account-menu]');
  document.querySelector('[data-account-toggle]')?.addEventListener('click', () => { menu.hidden = !menu.hidden; });
  document.querySelector('[data-mobile-nav]')?.addEventListener('click', (event) => {
    const mobile = document.querySelector('[data-mobile-menu]');
    mobile.hidden = !mobile.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!mobile.hidden));
  });
  document.querySelector('[data-logout]')?.addEventListener('click', async () => { await supabase?.auth.signOut(); location.href = '/'; });
  document.addEventListener('click', (event) => {
    if (menu && !menu.hidden && !event.target.closest('[data-account-menu]') && !event.target.closest('[data-account-toggle]')) menu.hidden = true;
    const trigger = event.target.closest('[data-profile-user]');
    if (trigger) openProfile(trigger.dataset.profileUser, profile);
  });
}

export function showToast(message, type = 'success', timeout = 5000) {
  const toast = document.createElement('div');
  toast.className = `community-toast ${type}`;
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), timeout);
}

export async function openProfile(username, viewerProfile = null) {
  if (!supabase) return showToast('Community database is not connected.', 'error');
  let dialog = document.querySelector('[data-profile-dialog]');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'profile-dialog';
    dialog.dataset.profileDialog = '';
    document.body.append(dialog);
  }
  dialog.innerHTML = '<div class="profile-dialog-shell"><button class="dialog-close profile-close" type="button">×</button><div class="profile-loading">Loading profile…</div></div>';
  dialog.querySelector('.dialog-close').onclick = () => dialog.close();
  dialog.showModal();
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
  if (error || !profile) return dialog.querySelector('.profile-dialog-shell').insertAdjacentHTML('beforeend', '<div class="profile-not-found"><h2>Profile unavailable</h2></div>');
  const [{ data: topics = [] }, { data: comments = [] }, { data: replies = [] }] = await Promise.all([
    supabase.from('forum_topics').select('title,slug,created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(4),
    supabase.from('post_comments').select('post_slug,created_at').eq('user_id', profile.id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(4),
    supabase.from('forum_replies').select('topic_id,created_at').eq('user_id', profile.id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(4),
  ]);
  const activity = [
    ...topics.map((item) => ({ at:item.created_at, text:`Started “${item.title}”`, href:`/topic/?slug=${encodeURIComponent(item.slug)}` })),
    ...comments.map((item) => ({ at:item.created_at, text:'Commented on a system post', href:`/content/?type=post&slug=${encodeURIComponent(item.post_slug)}` })),
    ...replies.map((item) => ({ at:item.created_at, text:'Replied to a forum discussion', href:'/forums/' })),
  ].sort((a,b) => new Date(b.at)-new Date(a.at)).slice(0,6);
  const banner = publicImage('profile-media', profile.banner_path);
  const own = viewerProfile?.id === profile.id;
  dialog.innerHTML = `<div class="profile-dialog-shell"><button class="dialog-close profile-close" type="button">×</button><article class="profile-card effect-${esc(profile.profile_effect)}" style="--profile-primary:${esc(profile.accent_primary)};--profile-secondary:${esc(profile.accent_secondary)}"><div class="profile-banner" style="${banner ? `background-image:url('${banner}')` : ''};background-position:center ${Number(profile.banner_y)||50}%"></div><div class="profile-card-body"><span class="user-avatar avatar-profile" style="--avatar-scale:${Number(profile.avatar_scale)||1};--avatar-x:${Number(profile.avatar_x)||50}%;--avatar-y:${Number(profile.avatar_y)||50}%"><img src="${avatarUrl(profile)}" alt=""></span><h2>${esc(profile.display_name)}</h2><span>@${esc(profile.username)}</span><p>${esc(profile.bio || 'No bio yet.')}</p><small>Member since ${formatDate(profile.created_at, {dateStyle:'medium'})}</small>${own ? '<a class="button primary small" href="/profile/">Edit profile</a>' : ''}<section class="profile-activity"><strong>Activity</strong>${activity.length ? activity.map((item)=>`<a href="${item.href}"><span>${esc(item.text)}</span><small>${relativeTime(item.at)}</small></a>`).join('') : '<p>No public activity yet.</p>'}</section></div></article></div>`;
  dialog.querySelector('.dialog-close').onclick = () => dialog.close();
}
