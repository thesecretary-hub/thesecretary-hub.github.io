import { currentAccount, publicImage, requireSupabase, supabase } from './supabase-client.js';
import { avatarUrl, esc, mountLayout, showToast } from './layout.js';

const profile=await mountLayout('');
const root=document.querySelector('[data-profile-editor-root]');
if(!profile){location.href='/login/?return=/profile/';}
else render();

function render(){
  const banner=publicImage('profile-media',profile.banner_path);
  root.innerHTML=`<main class="container page"><section class="profile-editor-page"><header><span class="eyebrow">Your profile</span><h1>Make it unmistakably yours.</h1><p>Customize the profile shown beside comments and forum discussions.</p></header><div class="profile-editor-grid"><section class="profile-live-preview effect-${esc(profile.profile_effect)}" data-preview style="--profile-primary:${esc(profile.accent_primary)};--profile-secondary:${esc(profile.accent_secondary)}"><div class="profile-preview-banner" data-banner style="${banner?`background-image:url('${banner}')`:''};background-position:center ${profile.banner_y}%"></div><div class="profile-preview-body"><span class="user-avatar avatar-profile"><img data-avatar src="${avatarUrl(profile)}" alt=""></span><h3 data-name>${esc(profile.display_name)}</h3><span>@${esc(profile.username)}</span><p data-bio>${esc(profile.bio||'No bio yet.')}</p></div></section><form class="profile-fields" data-profile-form><div class="split-fields"><label>Display name<input name="display_name" value="${esc(profile.display_name)}" required maxlength="80"></label><label>Username<input value="@${esc(profile.username)}" disabled></label></div><label>Bio<textarea name="bio" rows="4" maxlength="600">${esc(profile.bio||'')}</textarea></label><div class="split-fields"><label>Profile picture<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><label>Banner image<input name="banner" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label></div><div class="split-fields"><label>Primary glow<input name="accent_primary" type="color" value="${esc(profile.accent_primary)}"></label><label>Secondary glow<input name="accent_secondary" type="color" value="${esc(profile.accent_secondary)}"></label></div><label>Profile effect<select name="profile_effect">${['aurora','nebula','ember','ocean','none'].map(effect=>`<option ${profile.profile_effect===effect?'selected':''}>${effect}</option>`).join('')}</select></label><div class="profile-position-grid"><label>Avatar zoom<input name="avatar_scale" type="range" min="1" max="2" step=".05" value="${profile.avatar_scale}"></label><label>Avatar horizontal<input name="avatar_x" type="range" min="0" max="100" value="${profile.avatar_x}"></label><label>Avatar vertical<input name="avatar_y" type="range" min="0" max="100" value="${profile.avatar_y}"></label><label>Banner vertical<input name="banner_y" type="range" min="0" max="100" value="${profile.banner_y}"></label></div><button class="button primary" type="submit">Save profile</button></form></div></section></main>`;
  const form=root.querySelector('[data-profile-form]');
  form.display_name.oninput=()=>root.querySelector('[data-name]').textContent=form.display_name.value||'Your name';
  form.bio.oninput=()=>root.querySelector('[data-bio]').textContent=form.bio.value||'No bio yet.';
  const previewFile=(input,target,bg=false)=>input.onchange=()=>{const file=input.files[0];if(!file)return;const url=URL.createObjectURL(file);if(bg)target.style.backgroundImage=`url('${url}')`;else target.src=url;};
  previewFile(form.avatar,root.querySelector('[data-avatar]'));previewFile(form.banner,root.querySelector('[data-banner]'),true);
  form.onsubmit=save;
}

async function upload(file,kind){
  if(!file)return null;
  if(file.size>8*1024*1024)throw new Error('Profile images must be 8 MB or smaller.');
  const ext=(file.name.split('.').pop()||'webp').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=`${profile.id}/${kind}-${Date.now()}.${ext}`;
  const{error}=await requireSupabase().storage.from('profile-media').upload(path,file,{upsert:false,contentType:file.type});
  if(error)throw error;return path;
}

async function save(event){
  event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button');button.disabled=true;
  try{
    const values=Object.fromEntries(new FormData(form));
    const avatar=await upload(form.avatar.files[0],'avatar');const banner=await upload(form.banner.files[0],'banner');
    const update={display_name:values.display_name.trim(),bio:values.bio.trim(),accent_primary:values.accent_primary,accent_secondary:values.accent_secondary,profile_effect:values.profile_effect,avatar_scale:Number(values.avatar_scale),avatar_x:Number(values.avatar_x),avatar_y:Number(values.avatar_y),banner_y:Number(values.banner_y)};
    if(avatar)update.avatar_path=avatar;if(banner)update.banner_path=banner;
    const{error}=await supabase.from('profiles').update(update).eq('id',profile.id);if(error)throw error;
    showToast('Profile saved.');setTimeout(()=>location.reload(),700);
  }catch(error){showToast(error.message,'error');}finally{button.disabled=false;}
}
