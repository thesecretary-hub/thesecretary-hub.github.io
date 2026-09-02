import { currentAccount, supabase } from './supabase-client.js';
import { avatarUrl, esc, formatDate, showToast } from './layout.js';

const root=document.querySelector('[data-comments]');
const slug=root?.dataset.postSlug;
if(root&&slug)renderComments();

async function renderComments(){
  if(!supabase){root.innerHTML='';return;}
  const {profile}=await currentAccount();
  const {data:comments,error}=await supabase.from('post_comments').select('*, profiles!post_comments_user_id_fkey(display_name,username,avatar_path)').eq('post_slug',slug).order('created_at');
  if(error){root.innerHTML=`<div class="flash error">${esc(error.message)}</div>`;return;}
  root.innerHTML=`<section class="comments-section"><header><div><span class="eyebrow">Community</span><h2>Comments</h2></div><span>${comments.length}</span></header>${profile?`<form class="comment-composer" data-comment-form><span class="user-avatar avatar-medium"><img src="${avatarUrl(profile)}" alt=""></span><textarea name="body" rows="3" maxlength="5000" required placeholder="Add to the conversation…"></textarea><button class="button primary" type="submit">Post comment</button></form>`:'<div class="comment-login-callout"><div><strong>Join the conversation</strong><p>Log in to add a comment.</p></div><a class="button primary" href="/login/">Log in</a></div>'}<div class="comment-list">${comments.length?comments.map(comment=>`<article class="comment-card"><button class="avatar-button" data-profile-user="${esc(comment.profiles.username)}"><span class="user-avatar avatar-medium"><img src="${avatarUrl(comment.profiles)}" alt=""></span></button><div><header><strong>${esc(comment.profiles.display_name)}</strong><span>@${esc(comment.profiles.username)}</span><time>${formatDate(comment.created_at)}</time></header><p>${comment.is_deleted?'<em>Comment deleted.</em>':esc(comment.body)}</p>${profile?.id===comment.user_id&&!comment.is_deleted?`<button data-delete-comment="${comment.id}">Delete</button>`:''}</div></article>`).join(''):'<div class="community-empty"><p>No comments yet.</p></div>'}</div></section>`;
  root.querySelector('[data-comment-form]')?.addEventListener('submit',async event=>{event.preventDefault();const body=new FormData(event.currentTarget).get('body').trim();const{error}=await supabase.from('post_comments').insert({post_slug:slug,user_id:profile.id,body});if(error)showToast(error.message,'error');else renderComments();});
  root.querySelectorAll('[data-delete-comment]').forEach(button=>button.onclick=async()=>{const{error}=await supabase.from('post_comments').update({is_deleted:true,body:''}).eq('id',button.dataset.deleteComment);if(error)showToast(error.message,'error');else renderComments();});
}
