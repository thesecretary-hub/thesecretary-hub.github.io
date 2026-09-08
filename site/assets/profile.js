import { mountLayout, esc } from './layout.js?v=3.0.0';
import { showFullProfile, editProfile } from './profile-ui.js?v=1.0.0';
const profile=await mountLayout('');
const root=document.querySelector('[data-profile-editor-root]');
if(!profile)location.replace('/login/?return=/profile/');
else {
 const render=()=>{root.innerHTML=`<main class="identity-home"><span class="identity-kicker">YOUR CORNER OF THE HUB</span><h1>Hey, ${esc(profile.display_name)}.</h1><p>A profile with a little more personality.<br>Make it yours, and take it everywhere in the community.</p><div class="identity-home-actions"><button data-view>View profile</button><button data-edit>Edit profile</button></div></main>`;root.querySelector('[data-view]').onclick=()=>showFullProfile(profile,profile);root.querySelector('[data-edit]').onclick=()=>editProfile(profile);};
 render();showFullProfile(profile,profile);
 document.addEventListener('profile-updated',e=>{Object.assign(profile,e.detail);render();});
}
