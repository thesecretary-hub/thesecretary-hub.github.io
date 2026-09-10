from pathlib import Path
p=Path('work/check-mobile.cjs');s=p.read_text(encoding='utf-8')
start=s.index('const result={data:[],error:null};');end=s.index('\n}`});if',start)
s=s[:start]+'''const person={username:'mobiletester',display_name:'Mobile test user',avatar_path:null};
const post={id:1,slug:'test',title:'A complete mobile update with a longer headline for small screens',excerpt:'Readable content on every screen size.',content_html:'<h2>A long heading</h2><p>'+('UnbrokenContent'.repeat(30))+'</p><pre>'+('code_example_'.repeat(30))+'</pre><img src="/assets/images/post-fallback-full.webp">',full_thumb_url:'/assets/images/post-fallback-full.webp',poster_url:'/assets/images/post-fallback-poster.webp',published_at:new Date().toISOString(),status:'published',is_hero:true,is_pinned:true};
const topic={id:1,user_id:'test',slug:'test',category:'bugs',title:post.title,body:'Long content '+('LongUrlWithoutSpaces'.repeat(30)),profiles:person,status:'open',views:5,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
function from(table){let single=false;const rows=table==='posts'?[post]:table==='forum_topics'?[topic]:[];const q=new Proxy(function(){},{get:(_,k)=>k==='then'?((resolve)=>Promise.resolve(resolve({data:single?rows[0]:rows,error:null}))):()=>{if(k==='single'||k==='maybeSingle')single=true;return q;},apply:()=>q});return q;}
return {from,rpc:async()=>({data:null,error:null}),auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}};'''+s[end:]
s=s.replace('[320,390,640,768,960]', '[320,390,768]')
a=s.index("for(const route of ['/','/status/'");b=s.index(']){await page.goto',a)
s=s[:a]+"for(const route of ['/','/posts/','/forums/','/topic/?slug=test','/content/?type=post&slug=test']"+s[b+1:]
a=s.index('await page.setViewportSize({width:390,height:844});');s=s[:a]+"console.log(JSON.stringify({results,errors:[...new Set(errors)]},null,2));await browser.close();server.close();})().catch(e=>{console.error(e);server.close();process.exitCode=1});"
s=s.replace("server.listen(8765", "server.listen(8766").replace('127.0.0.1:8765','127.0.0.1:8766')
Path('work/check-content.cjs').write_text(s,encoding='utf-8')
