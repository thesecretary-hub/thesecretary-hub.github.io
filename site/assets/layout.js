import { APP_CONFIG, isSupabaseConfigured } from './config.js';
import { currentAccount, publicImage, supabase } from './supabase-client.js';
import { FALLBACK_POST, getPublishedPosts, postDate, postHref } from './post-store.js';

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
  const accountHref = profile ? '/profile/' : '/login/';
  const accountTitle = profile ? ` title="@${esc(profile.username)}"` : '';
  return `<header class="hub-header" data-hub-header><div class="hub-nav-shell"><a class="hub-logo" href="/" aria-label="The Secretary home"><img src="/assets/images/favicon.png" alt=""></a><nav class="hub-nav" aria-label="Main navigation"><button class="hub-nav-link posts-toggle" type="button" data-posts-toggle aria-expanded="false">Posts <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button><a class="hub-nav-link" href="/forums/">Newswire</a><a class="hub-nav-link" href="https://www.youtube.com/@TheSecretary-ts" target="_blank" rel="noopener">Videos</a><a class="hub-nav-link" href="${APP_CONFIG.mainSiteUrl}invite" target="_blank" rel="noopener">Support <span>↗</span></a><a class="hub-nav-link" href="${APP_CONFIG.mainSiteUrl}documentation" target="_blank" rel="noopener">Documentation <span>↗</span></a></nav><div class="hub-actions"><a class="get-secretary" href="https://discord.com/oauth2/authorize?client_id=1382221868869746739&amp;permissions=1394656931071&amp;integration_type=0&amp;scope=bot%20applications.commands" target="_blank" rel="noopener">Get Secretary</a><a class="account-icon" data-account-link href="${accountHref}" aria-label="Account"${accountTitle}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25"/><path d="M5.8 20c.25-4 2.3-6 6.2-6s5.95 2 6.2 6"/></svg></a><button class="hub-menu" type="button" data-hub-menu aria-label="Open navigation" aria-expanded="false"><span></span><span></span></button></div></div><section class="posts-drawer" data-posts-drawer aria-hidden="true"><div class="drawer-inner"><div class="drawer-heading"><h2>Recent posts</h2><a href="/posts/">View all <span>→</span></a></div><div class="drawer-posts" data-drawer-posts></div></div></section></header>`;
}

function footer() {
  return `<footer class="hub-footer"><div class="footer-top"><nav><a href="${APP_CONFIG.mainSiteUrl}">Contact</a><a href="${APP_CONFIG.mainSiteUrl}invite">Support</a><a href="/forums/">Community Resources</a><a href="${APP_CONFIG.mainSiteUrl}documentation">Documentation</a></nav><div class="footer-language"><span>◎</span> English <b>⌄</b></div></div><div class="footer-bottom"><nav><a href="${APP_CONFIG.mainSiteUrl}">Corporate</a><a href="${APP_CONFIG.mainSiteUrl}">Privacy</a><a href="${APP_CONFIG.mainSiteUrl}">Legal</a><a href="/status/">System Status</a></nav><p>© ${new Date().getFullYear()} The Secretary</p><div class="footer-social"><a href="https://www.youtube.com/@TheSecretary-ts" aria-label="YouTube" target="_blank" rel="noopener">▶</a><a href="${APP_CONFIG.mainSiteUrl}invite" aria-label="Discord" target="_blank" rel="noopener">◈</a><a href="${APP_CONFIG.mainSiteUrl}" aria-label="The Secretary" target="_blank" rel="noopener">S</a></div></div></footer>`;
}

function ensureHubAssets() {
  if (!document.querySelector('link[href*="hub.css"]')) document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/assets/hub.css?v=2.1.0">');
  if (!document.querySelector('link[href*="Bowlby+One+SC"]')) document.head.insertAdjacentHTML('beforeend', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bowlby+One+SC:wght@400&amp;display=swap" rel="stylesheet">');
}

function renderDrawerPosts(posts) {
  const root = document.querySelector('[data-drawer-posts]');
  if (!root) return;
  const items = posts.length ? posts : Array.from({ length: 5 }, (_, index) => ({ ...FALLBACK_POST, id: `shell-fallback-${index}` }));
  root.innerHTML = items.slice(0, 5).map((post) => { const date = new Date(postDate(post)); const label = Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date) : 'Recently'; return `<a class="drawer-card" href="${esc(postHref(post))}"><img src="${esc(post.poster_url || FALLBACK_POST.poster_url)}" alt=""><span><small>${esc(label)}</small><strong>${esc(post.title)}</strong></span></a>`; }).join('');
}

export async function mountLayout(active = '') {
  ensureHubAssets();
  const { profile } = await currentAccount();
  if (!document.querySelector('[data-site-footer]')) { const footerHost = document.createElement('div'); footerHost.dataset.siteFooter = ''; document.body.append(footerHost); }
  document.querySelector('[data-site-header]')?.replaceChildren(document.createRange().createContextualFragment(header(active, profile)));
  document.querySelector('[data-site-footer]')?.replaceChildren(document.createRange().createContextualFragment(footer()));
  document.body.classList.add('public-shell-body');
  renderDrawerPosts([]);
  if (active !== 'hub') getPublishedPosts(5).then(renderDrawerPosts).catch(() => {});
  if (!isSupabaseConfigured()) showToast('Community features need the Supabase Project URL.', 'info', 8000);
  bindLayout(profile);
  return profile;
}

function bindLayout(profile) {
  const shell = document.querySelector('[data-hub-header]');
  const drawer = document.querySelector('[data-posts-drawer]');
  const toggle = document.querySelector('[data-posts-toggle]');
  if (!shell || !drawer || !toggle) return;
  let drawerOpen = false;
  let lastY = scrollY;
  const setDrawer = (open) => { drawerOpen = open; shell.classList.toggle('drawer-open', open); toggle.setAttribute('aria-expanded', String(open)); drawer.setAttribute('aria-hidden', String(!open)); };
  toggle.addEventListener('click', () => setDrawer(!drawerOpen));
  document.querySelector('[data-hub-menu]')?.addEventListener('click', (event) => { const open = shell.classList.toggle('mobile-open'); event.currentTarget.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setDrawer(false); });
  addEventListener('scroll', () => { const y = Math.max(0, scrollY); shell.classList.toggle('scrolled', y > 10); if (!drawerOpen && y > 110 && y > lastY + 5) shell.classList.add('hidden'); if (y < lastY - 2 || y < 50) shell.classList.remove('hidden'); lastY = y; }, { passive: true });
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
    ...comments.map((item) => ({ at:item.created_at, text:'Commented on a system post', href:`/posts/${encodeURIComponent(item.post_slug)}` })),
    ...replies.map((item) => ({ at:item.created_at, text:'Replied to a forum discussion', href:'/forums/' })),
  ].sort((a,b) => new Date(b.at)-new Date(a.at)).slice(0,6);
  const banner = publicImage('profile-media', profile.banner_path);
  const own = viewerProfile?.id === profile.id;
  dialog.innerHTML = `<div class="profile-dialog-shell"><button class="dialog-close profile-close" type="button">×</button><article class="profile-card effect-${esc(profile.profile_effect)}" style="--profile-primary:${esc(profile.accent_primary)};--profile-secondary:${esc(profile.accent_secondary)}"><div class="profile-banner" style="${banner ? `background-image:url('${banner}')` : ''};background-position:center ${Number(profile.banner_y)||50}%"></div><div class="profile-card-body"><span class="user-avatar avatar-profile" style="--avatar-scale:${Number(profile.avatar_scale)||1};--avatar-x:${Number(profile.avatar_x)||50}%;--avatar-y:${Number(profile.avatar_y)||50}%"><img src="${avatarUrl(profile)}" alt=""></span><h2>${esc(profile.display_name)}</h2><span>@${esc(profile.username)}</span><p>${esc(profile.bio || 'No bio yet.')}</p><small>Member since ${formatDate(profile.created_at, {dateStyle:'medium'})}</small>${own ? '<a class="button primary small" href="/profile/">Edit profile</a>' : ''}<section class="profile-activity"><strong>Activity</strong>${activity.length ? activity.map((item)=>`<a href="${item.href}"><span>${esc(item.text)}</span><small>${relativeTime(item.at)}</small></a>`).join('') : '<p>No public activity yet.</p>'}</section></div></article></div>`;
  dialog.querySelector('.dialog-close').onclick = () => dialog.close();
}
