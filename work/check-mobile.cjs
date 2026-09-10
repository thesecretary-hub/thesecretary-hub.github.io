const {chromium}=require('C:/Users/diksh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),http=require('http');
let baseline=false;const originals=new Map();const {execFileSync}=require('child_process');
const root=path.resolve('site');
const server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');if(baseline && /\.(html|css|js)$/.test(f)){const name=path.relative(process.cwd(),f).replaceAll('\\','/');if(!originals.has(name)){try{originals.set(name,execFileSync('git',['show','HEAD:'+name],{maxBuffer:20e6}));}catch{originals.set(name,'');}}return res.end(originals.get(name));}res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(8765,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:"msedge"});const page=await browser.newPage();
await page.route('**/*',async route=>{const u=route.request().url();if(u.startsWith('http://127.0.0.1'))return route.continue();if(u.includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:`export function createClient(){
const result={data:[],error:null};
const q=new Proxy(function(){},{get:(_,k)=>k==='then'?((resolve)=>Promise.resolve(resolve(result))):()=>q,apply:()=>q});
return {from:()=>q, auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}};
}`});if(u.includes('script.google'))return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,monitor:{status:'operational',uptime:{30:99.8,90:99.2},history:[]},incidents:[],maintenance:[],historyEvents:[],servers:[],posts:[],items:[]})});return route.abort();});
const errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
for(const width of [320,390,640,768,960]){await page.setViewportSize({width,height:900});for(const route of ['/','/status/','/posts/','/incidents/','/maintenance/','/forums/','/topic/','/content/','/login/','/register/','/profile/','/admin/','/admin/posts/','/admin/incidents/','/admin/maintenance/','/admin/servers/','/admin/webhooks/','/unsubscribe/','/404.html']){await page.goto('http://127.0.0.1:8765'+route);await page.waitForTimeout(100);const r=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width&&s.position!=='absolute'&&s.position!=='fixed'&&((r.right>innerWidth+1)||(e.scrollWidth>e.clientWidth+2&&['auto','scroll'].includes(s.overflowX)))}).map(e=>e.tagName+'.'+e.className).slice(0,8),bars:document.querySelector('.status-history')?.children.length}));if(r.overflow||r.offenders.length||r.bars)results.push({width,route,...r});if(width===390&&['/','/status/','/login/','/forums/'].includes(route))await page.screenshot({path:'work/'+(route.replaceAll('/','')||'home')+'.png',fullPage:true});}}
await page.setViewportSize({width:390,height:844});
await page.goto('http://127.0.0.1:8765/status/');await page.waitForSelector('.status-history');
if(await page.locator('.status-history').first().locator('i').count()!==30)throw Error('Mobile history');
await page.click('[data-chart-range="week"]');
await page.click('[data-subscribe-open]');
if(await page.locator('dialog').evaluate(e=>e.scrollWidth>e.clientWidth))throw Error('Dialog overflow');
await page.click('[data-subscribe-close]');
await page.setViewportSize({width:1440,height:900});
if(await page.locator('.status-history').first().locator('i').count()!==90)throw Error('Desktop resize history');
if(await page.locator('[data-chart-range="week"]').getAttribute('class')!=='active')throw Error('Chart range lost');
await page.setViewportSize({width:390,height:844});
await page.goto('http://127.0.0.1:8765/');await page.waitForSelector('.hero-copy');
if(await page.locator('video source[src]').count())throw Error('Mobile loads video');
await page.click('[data-hub-menu]');await page.click('[data-posts-toggle]');await page.waitForURL('**/posts/');
const desktop=[];
for(const route of ['/','/status/','/login/','/forums/']){
const layouts=[];await page.setViewportSize({width:1440,height:900});
for(const original of [true,false]){baseline=original;await page.goto('http://127.0.0.1:8765'+route);await page.waitForTimeout(250);layouts.push(await page.evaluate(()=>[...document.querySelectorAll('main,main>section,.hub-header,.hub-footer,.status-wrap,.status-service,.account-portal,.forum-layout')].map(e=>{const r=e.getBoundingClientRect();return [e.className,...[r.x,r.y,r.width,r.height].map(x=>Math.round(x))]})));}
desktop.push({route,unchanged:JSON.stringify(layouts[0])===JSON.stringify(layouts[1])});}
console.log(JSON.stringify({results,desktop,interactions:'passed',errors:[...new Set(errors)]},null,2));await browser.close();server.close();})().catch(e=>{console.error(e);server.close();process.exitCode=1});

