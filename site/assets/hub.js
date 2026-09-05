import { currentAccount } from './supabase-client.js';
import { FALLBACK_POST, getPublishedPosts, postDate, postHref } from './post-store.js';

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const prettyDate = (post) => { const date = new Date(postDate(post)); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date) : 'Recently'; };
const fallbackSet = (count) => Array.from({ length: count }, (_, index) => ({ ...FALLBACK_POST, id: `fallback-${index}` }));
const image = (post, kind) => post?.[kind] || (kind === 'poster_url' ? FALLBACK_POST.poster_url : FALLBACK_POST.full_thumb_url);

const header = document.querySelector('[data-hub-header]');
const drawer = document.querySelector('[data-posts-drawer]');
const toggle = document.querySelector('[data-posts-toggle]');
let drawerOpen = false;
let lastY = 0;

function setDrawer(open) {
  drawerOpen = open;
  header.classList.toggle('drawer-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  drawer.setAttribute('aria-hidden', String(!open));
}

toggle.addEventListener('click', () => setDrawer(!drawerOpen));
document.querySelector('[data-hub-menu]').addEventListener('click', (event) => {
  const open = header.classList.toggle('mobile-open');
  event.currentTarget.setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setDrawer(false); });
window.addEventListener('scroll', () => {
  const y = Math.max(0, scrollY);
  header.classList.toggle('scrolled', y > 10);
  if (!drawerOpen && y > 110 && y > lastY + 5) header.classList.add('hidden');
  if (y < lastY - 2 || y < 50) header.classList.remove('hidden');
  lastY = y;
}, { passive: true });

function renderDrawer(posts) {
  document.querySelector('[data-drawer-posts]').innerHTML = posts.slice(0, 5).map((post) => `<a class="drawer-card" href="${postHref(post)}"><img src="${esc(image(post, 'poster_url'))}" alt=""><span><small>${esc(prettyDate(post))}</small><strong>${esc(post.title)}</strong></span></a>`).join('');
}

function renderPinned(posts) {
  document.querySelector('[data-pinned-posts]').innerHTML = posts.slice(0, 6).map((post, index) => `<a class="pinned-card ${index === 0 ? 'pinned-lead' : ''}" href="${postHref(post)}"><img src="${esc(index === 0 ? image(post, 'full_thumb_url') : image(post, 'poster_url'))}" alt=""><span class="pinned-copy"><small>${esc(prettyDate(post))}</small><strong>${esc(post.title)}</strong><em>${esc(post.excerpt)}</em></span></a>`).join('');
}

let activeSlide = 0;
let paused = false;
let timer;
function renderHero(posts) {
  const slides = document.querySelector('[data-hero-slides]');
  const dots = document.querySelector('[data-hero-dots]');
  slides.innerHTML = posts.slice(0, 3).map((post, index) => `<article class="hero-slide ${index === 0 ? 'active initial' : ''}" aria-hidden="${index !== 0}"><img src="${esc(image(post, 'full_thumb_url'))}" alt=""><div class="hero-vignette"></div><div class="hero-copy"><span>The Secretary / Posts</span><h1>${esc(post.title)}</h1><a href="${postHref(post)}">Read post <b>→</b></a></div></article>`).join('');
  dots.innerHTML = posts.slice(0, 3).map((_, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-slide="${index}" aria-label="Show post ${index + 1}"><i></i></button>`).join('');
  dots.querySelectorAll('button').forEach((button) => button.onclick = () => showSlide(Number(button.dataset.slide), posts.length));
  startTimer(posts.length);
}
function showSlide(index, total) {
  const count = Math.min(total, 3);
  const nextIndex = (index + count) % count;
  if (nextIndex === activeSlide) return;
  const allSlides = [...document.querySelectorAll('.hero-slide')];
  const previous = allSlides[activeSlide];
  const next = allSlides[nextIndex];
  previous.classList.remove('initial');
  previous.classList.add('leaving');
  previous.setAttribute('aria-hidden', 'true');
  next.classList.remove('leaving', 'initial');
  next.classList.add('active');
  next.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => { previous.classList.remove('active', 'leaving'); }, 900);
  activeSlide = nextIndex;
  document.querySelectorAll('[data-hero-dots] button').forEach((dot, i) => dot.classList.toggle('active', i === activeSlide));
}
function startTimer(total) { clearInterval(timer); timer = setInterval(() => { if (!paused) showSlide(activeSlide + 1, total); }, 6500); }
document.querySelector('[data-hero-pause]').addEventListener('click', (event) => { paused = !paused; event.currentTarget.classList.toggle('paused', paused); event.currentTarget.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow'); });

async function init() {
  let posts = [];
  try { posts = await getPublishedPosts(); } catch (error) { console.warn('Posts unavailable; using fallback content.', error); }
  const recent = posts.length ? posts : fallbackSet(5);
  const heroes = posts.filter((post) => post.is_hero);
  const pinned = posts.filter((post) => post.is_pinned);
  renderDrawer(recent.length >= 5 ? recent : [...recent, ...fallbackSet(5 - recent.length)]);
  renderHero(heroes.length ? heroes : fallbackSet(3));
  renderPinned(pinned.length ? pinned : fallbackSet(6));
  document.querySelector('[data-year]').textContent = new Date().getFullYear();
  try {
    const { profile } = await currentAccount();
    if (profile) {
      const link = document.querySelector('[data-account-link]');
      link.href = '/profile/';
      link.title = `@${profile.username}`;
    }
  } catch {}
  const video = document.querySelector('[data-showcase-video]');
  const showcase = document.querySelector('[data-showcase]');
  const videoToggle = document.querySelector('[data-showcase-toggle]');
  let showcaseVisible = false;
  let manuallyPaused = false;
  const syncShowcaseVideo = () => {
    const shouldPlay = showcaseVisible && !manuallyPaused;
    if (shouldPlay) video.play().catch(() => {}); else video.pause();
    videoToggle.classList.toggle('paused', !shouldPlay);
    videoToggle.setAttribute('aria-pressed', String(!shouldPlay));
    videoToggle.setAttribute('aria-label', shouldPlay ? 'Pause background video' : 'Play background video');
  };
  video.addEventListener('canplay', () => document.querySelector('.showcase-media').classList.add('video-ready'));
  video.addEventListener('error', () => video.hidden = true, true);
  videoToggle.addEventListener('click', () => { manuallyPaused = !video.paused; syncShowcaseVideo(); });
  new IntersectionObserver(([entry]) => {
    showcaseVisible = entry.isIntersecting;
    manuallyPaused = false;
    syncShowcaseVideo();
  }, { threshold: .25 }).observe(showcase);
}

init();
