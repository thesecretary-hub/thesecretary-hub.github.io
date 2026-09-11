import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const origins=new Set(['https://hub.thesecretary.xyz','https://the-secretary-status.github.io','https://thesecretary-hub.github.io']);
function cors(request:Request){const origin=request.headers.get('origin')||'';return {'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://hub.thesecretary.xyz','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};}
Deno.serve(async request=>{
  const headers=cors(request);if(request.method==='OPTIONS')return new Response('ok',{headers});
  try{
    const authorization=request.headers.get('Authorization')||'';
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const {data:{user},error:userError}=await caller.auth.getUser();if(userError||!user)throw new Error('Log in to send reply notifications.');
    const {reply_id}=await request.json();if(!Number.isInteger(Number(reply_id)))throw new Error('A reply ID is required.');
    const admin=createClient(url,service,{auth:{persistSession:false}});
    const {data:reply,error:replyError}=await admin.from('forum_replies').select('id,topic_id,user_id,parent_id,body').eq('id',Number(reply_id)).single();
    if(replyError||!reply||reply.user_id!==user.id)throw new Error('Reply was not found.');
    const {data:topic,error:topicError}=await admin.from('forum_topics').select('id,user_id,title,slug').eq('id',reply.topic_id).single();if(topicError)throw topicError;
    const recipients=new Set<string>();if(topic.user_id!==user.id)recipients.add(topic.user_id);
    if(reply.parent_id){const {data:parent}=await admin.from('forum_replies').select('user_id').eq('id',reply.parent_id).single();if(parent?.user_id!==user.id)recipients.add(parent.user_id);}
    if(!recipients.size)return Response.json({sent:0},{headers});
    const deliverable:string[]=[];
    for(const recipient of recipients){const {error}=await admin.from('forum_reply_notification_deliveries').insert({reply_id:reply.id,recipient_id:recipient});if(!error)deliverable.push(recipient);else if(error.code!=='23505')throw error;}
    if(!deliverable.length)return Response.json({sent:0,duplicate:true},{headers});
    const {data:profile}=await admin.from('profiles').select('display_name,username').eq('id',user.id).single();
    const {data:subscriptions,error:subscriptionError}=await admin.from('forum_push_subscriptions').select('id,endpoint,p256dh,auth').in('user_id',deliverable);if(subscriptionError)throw subscriptionError;
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:admin@thesecretary.xyz',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!);
    const payload=JSON.stringify({title:`${profile?.display_name||profile?.username||'Someone'} replied`,body:`${topic.title}: ${String(reply.body).slice(0,120)}`,url:`/topic/?slug=${encodeURIComponent(topic.slug)}#reply-${reply.id}`,tag:`forum-reply-${reply.id}`});
    let sent=0;for(const subscription of subscriptions||[]){try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload);sent++;}catch(error){if(error?.statusCode===404||error?.statusCode===410)await admin.from('forum_push_subscriptions').delete().eq('id',subscription.id);else console.error(error);}}
    return Response.json({sent},{headers});
  }catch(error){return Response.json({error:error.message||'Notification failed.'},{status:400,headers});}
});
