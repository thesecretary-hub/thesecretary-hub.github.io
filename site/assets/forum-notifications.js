import { APP_CONFIG } from './config.js';
import { supabase } from './supabase-client.js';
import { esc, showToast } from './layout.js?v=4.5.0';

const preferenceKey='forum-notifications';
function decodeKey(value){
  const padding='='.repeat((4-value.length%4)%4);
  const raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from([...raw].map(character=>character.charCodeAt(0)));
}
async function registration(){return navigator.serviceWorker.register('/forum-notifications-sw.js',{scope:'/'});}
async function enable(viewer,container){
  if(!APP_CONFIG.forumVapidPublicKey)throw new Error('Forum notifications have not been configured yet.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Notifications were not allowed in this browser.');
  const worker=await registration();
  let subscription=await worker.pushManager.getSubscription();
  if(!subscription)subscription=await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(APP_CONFIG.forumVapidPublicKey)});
  const json=subscription.toJSON();
  const {error}=await supabase.rpc('save_forum_push_subscription',{push_endpoint:json.endpoint,push_p256dh:json.keys.p256dh,push_auth:json.keys.auth});
  if(error)throw error;
  localStorage.setItem(preferenceKey,'enabled');
  draw(container,viewer,'enabled');showToast('Forum notifications enabled.');
}
async function disable(viewer,container){
  const worker=await navigator.serviceWorker.getRegistration('/');
  const subscription=await worker?.pushManager.getSubscription();
  if(subscription){
    await supabase.from('forum_push_subscriptions').delete().eq('user_id',viewer.id).eq('endpoint',subscription.endpoint);
    await subscription.unsubscribe();
  }
  localStorage.setItem(preferenceKey,'disabled');
  draw(container,viewer,'disabled');showToast('Forum notifications disabled.','info');
}
function draw(container,viewer,state){
  if(!container||!viewer||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return;
  container.innerHTML=`<section class="forum-notification-card"><div><strong>Reply notifications</strong><p>${state==='enabled'?'Enabled — you will be notified about replies to your posts and comments.':state==='disabled'?'Disabled — this browser will not receive forum notifications.':'Get a browser notification when somebody replies to your post or comment.'}</p></div><div>${state!=='enabled'?'<button class="button small primary" data-notifications-enable>Enable</button>':''}${state!=='disabled'?'<button class="button small ghost" data-notifications-disable>Disable</button>':''}</div><p role="alert" data-notification-error></p></section>`;
  container.querySelector('[data-notifications-enable]')?.addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await enable(viewer,container);}catch(error){container.querySelector('[data-notification-error]').textContent=esc(error.message);event.currentTarget.disabled=false;}});
  container.querySelector('[data-notifications-disable]')?.addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await disable(viewer,container);}catch(error){container.querySelector('[data-notification-error]').textContent=esc(error.message);event.currentTarget.disabled=false;}});
}
export async function mountForumNotifications(viewer,container){
  if(!viewer||!container||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return;
  let state=localStorage.getItem(preferenceKey)||'';
  if(Notification.permission==='denied')state='disabled';
  if(Notification.permission==='granted'){
    const worker=await navigator.serviceWorker.getRegistration('/');
    if(await worker?.pushManager.getSubscription())state='enabled';
  }
  draw(container,viewer,state);
}

export async function notifyForumReply(replyId){
  try{const {error}=await supabase.functions.invoke('forum-reply-notification',{body:{reply_id:replyId}});if(error)throw error;}catch(error){console.warn('Reply notification could not be queued.',error);}
}
