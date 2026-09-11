import { mountLayout, showToast } from './layout.js?v=4.5.0';
import { FALLBACK_POST, getPublishedPosts, postDate, postHref } from './post-store.js';
import { currentAccount } from './supabase-client.js';
import { statusApi } from './api.js';

await mountLayout('hub');
const {user:accountUser}=await currentAccount();

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const prettyDate = (post) => { const date = new Date(postDate(post)); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date) : 'Recently'; };
const fallbackSet = (count) => Array.from({ length: count }, (_, index) => ({ ...FALLBACK_POST, id: `fallback-${index}` }));
const image = (post, kind) => post?.[kind] || (kind === 'poster_url' ? FALLBACK_POST.poster_url : FALLBACK_POST.full_thumb_url);

async function setupUpdatesSubscription(){
  const button=document.querySelector('[data-updates-subscribe]');
  const status=document.querySelector('[data-updates-status]');
  if(!button)return;
  let subscribed=false;
  const sync=()=>{button.textContent=accountUser?(subscribed?'Unsubscribe':'Subscribe Now'):'Subscribe Now';button.setAttribute('aria-pressed',String(subscribed));status.textContent=accountUser?(subscribed?`Email updates are enabled for ${accountUser.email}.`:`Email updates are disabled for ${accountUser.email}.`):'';};
  if(accountUser){
    button.disabled=true;status.textContent='Checking your subscription…';
    try{subscribed=Boolean((await statusApi('subscription_status')).subscribed);sync();}
    catch(error){status.textContent='Could not check your subscription right now.';console.warn(error);}
    finally{button.disabled=false;}
    button.addEventListener('click',async()=>{button.disabled=true;try{subscribed=Boolean((await statusApi('toggle_account_subscription')).subscribed);sync();showToast(subscribed?'Email updates enabled.':'Email updates disabled.',subscribed?'success':'info');}catch(error){showToast(error.message,'error');}finally{button.disabled=false;}});
    return;
  }
  button.addEventListener('click',()=>openEmailSubscriptionDialog());
}

function openEmailSubscriptionDialog(){
  if(document.querySelector('[data-updates-dialog]'))return;
  const dialog=document.createElement('dialog');dialog.className='updates-dialog';dialog.dataset.updatesDialog='';
  dialog.innerHTML=`<form method="dialog" class="updates-dialog-form"><button class="updates-dialog-close" type="button" aria-label="Close">×</button><span>THE SECRETARY UPDATES</span><h2>Stay in the loop.</h2><p>Enter your email to receive new posts, announcements, and important service updates.</p><label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><button class="updates-dialog-submit" type="submit">Subscribe</button><small data-dialog-status role="status"></small></form>`;
  document.body.append(dialog);dialog.showModal();dialog.querySelector('input').focus();
  const close=()=>dialog.close();dialog.querySelector('.updates-dialog-close').onclick=close;dialog.onclick=event=>{if(event.target===dialog)close();};dialog.onclose=()=>dialog.remove();
  dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,submit=form.querySelector('[type=submit]'),message=form.querySelector('[data-dialog-status]');submit.disabled=true;message.textContent='Subscribing…';try{await statusApi('subscribe',{email:new FormData(form).get('email')});message.textContent='Subscribed. Check your inbox for confirmation.';submit.textContent='Done';setTimeout(close,1100);}catch(error){message.textContent=error.message;submit.disabled=false;}};
}

setupUpdatesSubscription();

function renderDrawer(posts) {
  document.querySelector('[data-drawer-posts]').innerHTML = posts.slice(0, 5).map((post) => `<a class="drawer-card" href="${postHref(post)}"><img src="${esc(image(post, 'poster_url'))}" alt=""><span><small>${esc(prettyDate(post))}</small><strong>${esc(post.title)}</strong></span></a>`).join('');
}

function renderPostGrid(selector, posts) {
  document.querySelector(selector).innerHTML = posts.slice(0, 6).map((post, index) => `<a class="pinned-card ${index === 0 ? 'pinned-lead' : ''}" href="${postHref(post)}"><img src="${esc(index === 0 ? image(post, 'full_thumb_url') : image(post, 'poster_url'))}" alt=""><span class="pinned-copy"><small>${esc(prettyDate(post))}</small><strong>${esc(post.title)}</strong><em>${esc(post.excerpt)}</em></span></a>`).join('');
}

let activeSlide = 0;
let paused = false;
let timer;
function renderHero(posts) {
  const slides = document.querySelector('[data-hero-slides]');
  const dots = document.querySelector('[data-hero-dots]');
  slides.innerHTML = posts.slice(0, 3).map((post, index) => `<article class="hero-slide ${index === 0 ? 'active initial' : ''}" aria-hidden="${index !== 0}"><img src="${esc(image(post, 'full_thumb_url'))}" alt=""><div class="hero-vignette"></div><div class="hero-copy"><img class="hero-poster-logo" src="${esc(image(post, 'poster_url'))}" alt=""><div class="hero-copy-text"><span>The Secretary / Posts</span><h1>${esc(post.title)}</h1><a href="${postHref(post)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5c3.3-.8 6-.2 8.5 1.8v12c-2.5-2-5.2-2.6-8.5-1.8zm17 0c-3.3-.8-6-.2-8.5 1.8v12c2.5-2 5.2-2.6 8.5-1.8z"/></svg>Read post</a></div></div></article>`).join('');
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
  const unpinned = posts.filter((post) => !post.is_pinned);
  renderDrawer(recent.length >= 5 ? recent : [...recent, ...fallbackSet(5 - recent.length)]);
  renderHero(heroes.length ? heroes : fallbackSet(3));
  renderPostGrid('[data-pinned-posts]', pinned.length ? pinned : fallbackSet(6));
  renderPostGrid('[data-recent-posts]', unpinned.length ? unpinned : fallbackSet(6));
  const video = document.querySelector('[data-showcase-video]');
  const showcase = document.querySelector('[data-showcase]');
  const videoToggle = document.querySelector('[data-showcase-toggle]');
  let showcaseVisible = false;
  let manuallyPaused = false;
  const simpleMotion = matchMedia('(max-width: 960px), (prefers-reduced-motion: reduce)');
  const syncShowcaseVideo = () => {
    const shouldPlay = !simpleMotion.matches && showcaseVisible && !manuallyPaused;
    if (shouldPlay) video.play().catch(() => {}); else video.pause();
    videoToggle.classList.toggle('paused', !shouldPlay);
    videoToggle.setAttribute('aria-pressed', String(!shouldPlay));
    videoToggle.setAttribute('aria-label', shouldPlay ? 'Pause background video' : 'Play background video');
  };
  const syncMedia = () => {
    [video, document.querySelector('[data-scroll-story-video]')].forEach(media => {
      const source = media.querySelector('source');
      if (simpleMotion.matches) {
        media.pause();
        if (source.hasAttribute('src')) { source.dataset.src = source.getAttribute('src'); source.removeAttribute('src'); media.load(); }
      } else if (!source.hasAttribute('src')) { source.src = source.dataset.src; media.load(); }
    });
    syncShowcaseVideo();
  };
  simpleMotion.addEventListener('change', syncMedia);
  syncMedia();
  video.addEventListener('canplay', () => document.querySelector('.showcase-media').classList.add('video-ready'));
  video.addEventListener('error', () => video.hidden = true, true);
  videoToggle.addEventListener('click', () => { manuallyPaused = !video.paused; syncShowcaseVideo(); });
  new IntersectionObserver(([entry]) => {
    showcaseVisible = entry.isIntersecting;
    manuallyPaused = false;
    syncShowcaseVideo();
  }, { threshold: .25 }).observe(showcase);
  const story = document.querySelector('[data-scroll-story]');
  const storyVideo = document.querySelector('[data-scroll-story-video]');
  const storyCopy = document.querySelector('[data-scroll-story-copy]');
  const storyControl = document.querySelector('[data-scroll-story-control]');
  const storyProgress = document.querySelector('[data-scroll-story-progress]');
  let storyDuration = storyVideo.readyState >= 1 && Number.isFinite(storyVideo.duration) ? storyVideo.duration : 5;
  let storyFrame = 0;
  storyVideo.addEventListener('loadedmetadata', () => { storyDuration = storyVideo.duration || 5; updateStory(); });
  storyVideo.addEventListener('error', () => story.classList.add('video-error'), true);
  const updateStory = () => {
    storyFrame = 0;
    if (simpleMotion.matches) return;
    const rect = story.getBoundingClientRect();
    const travel = Math.max(1, story.offsetHeight - innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / travel));
    if (storyVideo.readyState >= 1 && Number.isFinite(storyDuration)) {
      const targetTime = progress * Math.max(.01, storyDuration - .04);
      if (Math.abs(storyVideo.currentTime - targetTime) > .035) storyVideo.currentTime = targetTime;
    }
    const reveal = Math.min(1, Math.max(0, (progress - .14) / .28));
    storyCopy.style.opacity = String(reveal);
    storyCopy.style.transform = `translateY(${(1 - reveal) * 72}px)`;
    storyControl.style.setProperty('--story-progress', progress);
    storyControl.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    const thumbTravel = Math.max(0, storyControl.clientHeight - storyProgress.offsetHeight - 12);
    storyProgress.style.top = `${6 + progress * thumbTravel}px`;
  };
  const seekStory = (progress) => {
    const travel = Math.max(1, story.offsetHeight - innerHeight);
    scrollTo({ top: story.offsetTop + Math.min(1, Math.max(0, progress)) * travel, behavior: 'smooth' });
  };
  storyControl.addEventListener('click', (event) => {
    const rect = storyControl.getBoundingClientRect();
    seekStory((event.clientY - rect.top) / rect.height);
  });
  storyControl.addEventListener('keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = Number(storyControl.getAttribute('aria-valuenow')) / 100;
    if (event.key === 'Home') seekStory(0);
    else if (event.key === 'End') seekStory(1);
    else seekStory(current + (event.key === 'ArrowDown' ? .08 : -.08));
  });
  const queueStoryUpdate = () => { if (!simpleMotion.matches && !storyFrame) storyFrame = requestAnimationFrame(updateStory); };
  addEventListener('scroll', queueStoryUpdate, { passive: true });
  addEventListener('resize', queueStoryUpdate, { passive: true });
  updateStory();
}

init();
