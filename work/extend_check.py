from pathlib import Path
p=Path('work/check-mobile.cjs');s=p.read_text(encoding='utf-8');s=s.replace('const root=path.resolve', "let baseline=false;const originals=new Map();const {execFileSync}=require('child_process');\nconst root=path.resolve")
s=s.replace('res.end(fs.readFileSync(f));', "if(baseline && /\\.(html|css|js)$/.test(f)){const name=path.relative(process.cwd(),f).replaceAll('\\\\','/');if(!originals.has(name)){try{originals.set(name,execFileSync('git',['show','HEAD:'+name],{maxBuffer:20e6}));}catch{originals.set(name,'');}}return res.end(originals.get(name));}res.end(fs.readFileSync(f));")
s=s.replace('[320,375,390,640,768,960,1440]','[320,390,640,768,960]')
s=s.replace("console.log(JSON.stringify({results,errors:[...new Set(errors)]},null,2));", '''await page.setViewportSize({width:390,height:844});
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
console.log(JSON.stringify({results,desktop,interactions:'passed',errors:[...new Set(errors)]},null,2));''')
p.write_text(s,encoding='utf-8')
