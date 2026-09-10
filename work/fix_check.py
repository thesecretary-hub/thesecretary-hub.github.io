from pathlib import Path
p=Path('work/check-mobile.cjs');s=p.read_text(encoding='utf-8');start=s.index('export function createClient()');end=s.index('`});if(u.includes',start)
s=s[:start]+'''export function createClient(){
const result={data:[],error:null};
const q=new Proxy(function(){},{get:(_,k)=>k==='then'?((resolve)=>Promise.resolve(resolve(result))):()=>q,apply:()=>q});
return {from:()=>q, auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}};
}'''+s[end:];p.write_text(s,encoding='utf-8')
