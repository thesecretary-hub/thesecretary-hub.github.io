import { APP_CONFIG, isSupabaseConfigured } from './config.js';
import { currentAccount, publicImage, supabase } from './supabase-client.js';
import { FALLBACK_POST, getPublishedPosts, postDate, postHref } from './post-store.js';

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export { esc };

export function avatarUrl(profile) {
  return publicImage('profile-media', profile?.avatar_path) || '/assets/images/default-profile-avatar.png';
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
  return `<footer class="hub-footer"><div class="footer-top"><nav><a href="https://gshergd.github.io/forum/">Contact</a><a href="https://thesecretary.xyz/invite">Support</a><a href="/forums/">Community Resources</a><a href="${APP_CONFIG.mainSiteUrl}documentation">Documentation</a></nav></div><div class="footer-bottom"><nav><a href="https://thesecretary.xyz/privacy-policy">Privacy</a><a href="https://thesecretary.xyz/terms-of-service">Legal</a><a href="/status/">Status</a></nav><p>© ${new Date().getFullYear()} The Secretary</p><div class="footer-social"><a href="https://www.youtube.com/@TheSecretary-ts" aria-label="YouTube" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg></a><a href="http://gshergd.github.io/" aria-label="GitHub" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.5v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1.1.1-.8.4-1.4.8-1.7-2.7-.3-5.6-1.4-5.6-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.8 1.2 3.1 0 4.4-2.9 5.4-5.6 5.7.5.4.9 1.1.9 2.2v3.2c0 .3.2.6.8.5A11.5 11.5 0 0 0 12 .7Z"/></svg></a><a href="https://thesecretary.xyz/" aria-label="The Secretary website" target="_blank" rel="noopener"><img src="/assets/images/favicon.png" alt=""></a></div></div></footer>`;
}

function ensureHubAssets() {
  if (!document.querySelector('link[href*="hub.css"]')) document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/assets/hub.css?v=2.2.2">');
  ensureProfileStyles();
  if (!document.querySelector('link[href*="Bowlby+One+SC"]')) document.head.insertAdjacentHTML('beforeend', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bowlby+One+SC:wght@400&amp;display=swap" rel="stylesheet">');
}

let profileStylesPromise;
function ensureProfileStyles() {
  if (profileStylesPromise) return profileStylesPromise;
  let link = document.querySelector('link[data-profile-styles],link[href*="profile-ui.css"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/profile-ui.css?v=2.8.0';
    link.dataset.profileStyles = '';
    document.head.append(link);
  }
  if (link.sheet) return profileStylesPromise = Promise.resolve();
  profileStylesPromise = new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
  return profileStylesPromise;
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
  document.addEventListener('profile-updated', (event) => { if (profile && profile.id === event.detail.id) Object.assign(profile, event.detail); });
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-profile-user], [data-account-link]');
    if (!trigger || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const username = trigger.dataset.profileUser || profile?.username;
    if (!username) return;
    event.preventDefault();
    openProfile(username, profile, trigger).catch(() => showToast('Could not open profile. Please try again.', 'error'));
  });
  const shell = document.querySelector('[data-hub-header]');
  const drawer = document.querySelector('[data-posts-drawer]');
  const toggle = document.querySelector('[data-posts-toggle]');
  if (!shell || !drawer || !toggle) return;
  let drawerOpen = false;
  let lastY = scrollY;
  shell.classList.toggle('scrolled', scrollY > 10);
  const setDrawer = (open) => { drawerOpen = open; shell.classList.toggle('drawer-open', open); toggle.setAttribute('aria-expanded', String(open)); drawer.setAttribute('aria-hidden', String(!open)); };
  toggle.addEventListener('click', () => {
    if (matchMedia('(max-width: 960px)').matches) { location.href = '/posts/'; return; }
    setDrawer(!drawerOpen);
  });
  document.querySelector('[data-hub-menu]')?.addEventListener('click', (event) => { const open = shell.classList.toggle('mobile-open'); event.currentTarget.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { setDrawer(false); shell.classList.remove('mobile-open'); document.querySelector('[data-hub-menu]')?.setAttribute('aria-expanded', 'false'); } });
  addEventListener('scroll', () => { const y = Math.max(0, scrollY); shell.classList.toggle('scrolled', y > 10); if (!drawerOpen && !shell.classList.contains('mobile-open') && y > 110 && y > lastY + 5) shell.classList.add('hidden'); if (y < lastY - 2 || y < 50) shell.classList.remove('hidden'); lastY = y; }, { passive: true });
}

export function showToast(message, type = 'success', timeout = 5000) {
  const toast = document.createElement('div');
  toast.className = `community-toast ${type}`;
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), timeout);
}

export async function openProfile(username, viewerProfile = null, anchor = null) {
  if (!supabase) return showToast('Community database is not connected.', 'error');
  await ensureProfileStyles();
  const { showProfile } = await import('./profile-ui.js?v=2.8.0');
  return showProfile(username, viewerProfile, anchor);
}
