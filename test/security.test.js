// Defensive checks against a LOCAL test server with test data only. Never point this at production.
const {spawn}=require('child_process'),fs=require('fs'),path=require('path');
const B='http://localhost:3055',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const id=()=>'p_'+[...Array(24)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');
const nm=()=>'T'+Math.random().toString(36).slice(2,10);
let ok=0,fail=0;const t=(n,c)=>{c?ok++:(fail++,console.log('FAIL',n));};
async function raw(base,p,o){const r=await fetch(base+p,o);return{s:r.status,h:r.headers,b:await r.text()}}
const post=(base,p,body,h)=>raw(base,p,{method:'POST',headers:Object.assign({'content-type':'application/json'},h||{}),body:typeof body==='string'?body:JSON.stringify(body)});
const J=r=>{try{return JSON.parse(r.b)}catch(e){return {}}};
function server(port,env){const c=spawn('node',['server.js'],{cwd:path.join(__dirname,'..'),env:Object.assign({},process.env,{PORT:String(port)},env),stdio:'ignore'});return c}
(async()=>{
 // 1. cross-site scripting and injection through display names
 for(const n of['<img src=x onerror=alert(1)>','<script>alert(1)</script>','"><svg/onload=alert(1)>','javascript:alert(1)',"Robert'); DROP TABLE players;--",'{{7*7}}','${7*7}','../../etc/passwd']){
  const r=await post(B,'/api/run/start',{id:id(),name:n,mode:'practice'});t('hostile name refused: '+n.slice(0,18),r.s===400&&/^name_/.test(J(r).error||''))}
 t('database still healthy after injection attempts',(await raw(B,'/api/stats')).s===200);
 // 2. injection through identifiers and parameters
 t('SQL-style device id refused',(await post(B,'/api/ping',{id:"p_' OR '1'='1"})).s===400);
 t('SQL-style report ref refused',(await post(B,'/api/report',{id:id(),ref:"' OR 1=1--"})).s===400);
 t('SQL-style report token is not found',(await raw(B,"/api/report/%27%20OR%201=1--")).s===404);
 t('SQL-style query parameters are ignored safely',(await raw(B,"/api/leaderboard?country=%27%20OR%201=1--&range=week%27--")).s===200);
 // 3. request size, malformed input, error messages
 const big=await post(B,'/api/ping','{"id":"'+'a'.repeat(10000)+'"}');t('oversized body refused with a plain error',big.s===413&&J(big).error==='too large');
 const bad=await post(B,'/api/ping','{bad');t('malformed JSON: generic error, no stack trace or file paths',bad.s===400&&J(bad).error==='bad request'&&!/node_modules|\.js|at /.test(bad.b));
 const nf=await raw(B,'/api/does-not-exist');t('unknown route leaks no internals',nf.s===404&&!/node_modules|\.js:\d|at /.test(nf.b));
 // 4. headers and cross-origin behaviour
 for(const p of['/api/stats','/']){const r=await raw(B,p,{headers:{Origin:'https://evil.example'}});
  t('security headers on '+p,!r.h.get('x-powered-by')&&/max-age/.test(r.h.get('strict-transport-security')||'')&&r.h.get('x-content-type-options')==='nosniff'&&r.h.get('x-frame-options')==='DENY'&&/frame-ancestors 'none'/.test(r.h.get('content-security-policy')||'')&&!!r.h.get('permissions-policy'));
  t('no CORS grant to other sites on '+p,!r.h.get('access-control-allow-origin'))}
 const pre=await raw(B,'/api/run/act',{method:'OPTIONS',headers:{Origin:'https://evil.example','Access-Control-Request-Method':'POST'}});t('cross-site preflight gets no permission',!pre.h.get('access-control-allow-origin'));
 // 5. server source and secrets are not served; no secrets in browser files
 for(const p of['/server.js','/engine.js','/package.json','/..%2fserver.js','/%2e%2e/server.js','/.env'])t('not served: '+p,(await raw(B,p)).s!==200||!/createEngine|require\(/.test((await raw(B,p)).b));
 const pub=fs.readdirSync(path.join(__dirname,'..','public')).filter(f=>/\.(js|html|css|webmanifest)$/.test(f)).map(f=>fs.readFileSync(path.join(__dirname,'..','public',f),'utf8')).join('\n');
 t('no database address, secret or key in browser files',!/postgres(ql)?:\/\/|SEED_SECRET\s*=|dev-admin-key|sk-[A-Za-z0-9]{10}/.test(pub));
 // 6. access control
 for(const p of['/api/admin','/api/admin/campaigns','/api/admin/reports','/api/admin/sponsor','/api/admin/ip','/api/admin/audit'])t('owner endpoint needs a session: '+p,(await raw(B,p)).s===401);
 t('score cannot be submitted by the browser',(await post(B,'/api/score',{id:id(),score:1000})).s===404&&(await post(B,'/api/run/finish',{id:id(),score:1000})).s===404);
 // 7. insecure direct object reference, tampering, races, replays
 const A=id(),Bp=id();
 let v=J(await post(B,'/api/run/start',{id:A,name:nm(),mode:'practice'}));const rid=v.runId;
 t("another player cannot read or act on someone else's game",(await post(B,'/api/run/start',{id:Bp,resume:rid})).s===404&&(await post(B,'/api/run/act',{id:Bp,runId:rid,type:'buy',pid:'rice',dir:1})).s===404);
 await sleep(260);
 const par=await Promise.all([1,2,3,4,5].map(()=>post(B,'/api/run/act',{id:A,runId:rid,type:'buy',pid:'rice',dir:1})));
 const wins=par.filter(r=>r.s===200).length;await sleep(260);
 v=J(await post(B,'/api/run/start',{id:A,resume:rid}));
 t('race: five simultaneous buys apply exactly once',wins===1&&v.fin.unitsBought===1);
 await sleep(260);
 const tamper=J(await post(B,'/api/run/act',{id:A,runId:rid,type:'buy',pid:'fab',dir:1,cash:999999,score:1000,hist:[],fin:{cash:1}}));
 t('tampered fields are ignored (balance comes from the server only)',tamper.fin&&tamper.fin.cash<20000&&tamper.score===null);
 for(const b of[{type:'buy',pid:'rice',dir:1,qty:1e9},{type:'buy',pid:'rice',dir:1,qty:-3},{type:'counter',price:1e12},{type:'sudo'}]){await sleep(260);t('unreasonable action refused: '+JSON.stringify(b).slice(0,40),(await post(B,'/api/run/act',Object.assign({id:A,runId:rid},b))).s===400)}
 for(const p of['tom','chg','noo']){await sleep(260);await post(B,'/api/run/act',{id:A,runId:rid,type:'buy',pid:p,dir:1})}
 await sleep(260);await post(B,'/api/run/act',{id:A,runId:rid,type:'buy',pid:'rice',dir:1});
 await sleep(260);let o=J(await post(B,'/api/run/act',{id:A,runId:rid,type:'open'}));
 if(o.phase==='haggle'){await sleep(260);const a1=await post(B,'/api/run/act',{id:A,runId:rid,type:'accept'});await sleep(260);const a2=await post(B,'/api/run/act',{id:A,runId:rid,type:'accept'});
  t('replayed sale request is refused (cannot sell the same customer twice)',a1.s===200&&a2.s===400);
  const w=J(a1);const f=w.fin;t('books balance after the sale (cash + stock = start + profit)',f.cash+f.invCost-20000===f.rev-f.cogs-f.writeOff)}
 // 8. servers with special settings
 const s1=server(3056,{ALLOWED_ORIGINS:'https://haggle.example.com'}),s2=server(3057,{RATE_MAX:'20'}),s3=server(3058,{});await sleep(2500);
 const O='http://localhost:3056';
 t('origin lock: no Origin refused',(await post(O,'/api/ping',{id:id()})).s===403);
 t('origin lock: other site refused',(await post(O,'/api/ping',{id:id()},{Origin:'https://evil.example'})).s===403);
 t('origin lock: your site allowed',(await post(O,'/api/ping',{id:id()},{Origin:'https://haggle.example.com'})).s===200);
 let limited=0;for(let i=0;i<30;i++){const r=await raw('http://localhost:3057','/api/stats');if(r.s===429){limited++;t('rate-limit answer is plain JSON',J(r).error==='slow down')}}t('rate limit triggers',limited>0);
 let last=0;for(let i=0;i<8;i++)last=(await post('http://localhost:3058','/api/admin/login',{key:'wrong-key-number-'+i})).s;
 t('owner-key guessing is locked out',last===429);
 t('the owner key in a header no longer opens anything',(await raw('http://localhost:3058','/api/admin',{headers:{'x-admin-key':'dev-admin-key-0000'}})).s===401);
 [s1,s2,s3].forEach(s=>s.kill());
 console.log(ok+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack||e.message);process.exit(1)});
