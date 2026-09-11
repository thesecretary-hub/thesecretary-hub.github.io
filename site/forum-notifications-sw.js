self.addEventListener('push',event=>{
  let payload={};try{payload=event.data?.json()||{};}catch{payload={body:event.data?.text()||'You have a new forum reply.'};}
  event.waitUntil(self.registration.showNotification(payload.title||'New forum reply',{body:payload.body||'Someone replied to you.',icon:'/assets/images/favicon.png',badge:'/assets/images/favicon.png',tag:payload.tag||'forum-reply',data:{url:payload.url||'/forums/'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/forums/',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{const existing=windows.find(client=>client.url===target);return existing?existing.focus():clients.openWindow(target);}));
});
