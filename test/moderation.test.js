const nm=()=>'T'+Math.random().toString(36).slice(2,10);
const B='http://localhost:3055',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const id=()=>'p_'+[...Array(24)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');
let AK={};
async function adminLogin(){const r=await fetch(B+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:'dev-admin-key-0000'})});const j=await r.json();if(!j.token)throw new Error('owner login failed: '+JSON.stringify(j));AK={'x-admin-token':j.token}}
async function call(p,body,h){const r=await fetch(B+'/api/'+p,{method:body?'POST':'GET',headers:Object.assign({'content-type':'application/json'},h||{}),body:body?JSON.stringify(body):undefined});let j={};try{j=await r.json()}catch(e){}return{s:r.status,j}}
let ok=0,fail=0;const t=(n,c)=>{c?ok++:(fail++,console.log('FAIL',n));};
async function play(pid,name,mode){
 let v=(await call('run/start',{id:pid,name,mode})).j;const rid=v.runId,first=v;
 const act=async(type,x)=>{await sleep(215);const r=await call('run/act',Object.assign({id:pid,runId:rid,type},x));if(r.s!==200)throw new Error(type+' '+r.s);v=r.j};
 for(let d=0;d<7;d++){for(const p of['rice','fab']){if(v.cash>=v.cost[p])await act('buy',{pid:p,dir:1})}
  await act('open');while(['haggle','nostock','result'].includes(v.phase)){v.phase==='haggle'?await act('accept'):await act('next')}
  if(v.phase==='dayend')await act('nextday')}
 return{first,v};
}
(async()=>{
 await adminLogin();
 // name filter: should block these (and rename), should allow these
 for(const n of['Fuck','sh1t','F u c k','Admin','08012345678','Hitler','n1gga','HAGGLE official','www.x.com'])
  {const rr=await call('run/start',{id:id(),name:n,mode:'practice'});t('rejects '+n,rr.s===400&&/^name_/.test(rr.j.error||''))}
 for(const n of['Shittu','Mama Ife','Classic','Adebayo Ogunleye','Scunthorpe','Kofi 2026','Assumpta'])
  {const rr=await call('run/start',{id:id(),name:n,mode:'practice'});t('allows '+n,rr.s===200)}
 // full flow: target T (ranked), reporters R1,R2 (ranked), R3 (practice, IP cap)
 const T=id(),R1=id(),R2=id(),R3=id(),NEW=id();
 const res=await Promise.all([play(T,'Target Trader','daily'),play(R1,'Reporter One','daily'),play(R2,'Reporter Two','daily'),play(R3,'Reporter Three','practice')]);
 let lb=(await call('leaderboard')).j.rows;console.log('leaderboard',JSON.stringify(lb.map(r=>[r.name,r.daily])));
 const tr=lb.find(r=>r.name==='Target Trader');t('target on board',!!tr&&/^[0-9a-f]{12}$/.test(tr.ref));
 t('no player id leaked on board',lb.every(r=>!JSON.stringify(r).includes('p_')));
 t('report needs a finished run',(await call('report',{id:NEW,ref:tr.ref})).s===403);
 t('self report ignored',(await call('report',{id:T,ref:tr.ref})).j.ok===1);
 await call('report',{id:R1,ref:tr.ref});await call('report',{id:R2,ref:tr.ref});
 await sleep(5200);lb=(await call('leaderboard')).j.rows;
 t('2 reports: still visible',lb.some(r=>r.name==='Target Trader'));
 await call('report',{id:R3,ref:tr.ref});await sleep(100);
 lb=(await call('leaderboard')).j.rows;
 t('3 reports: name hidden',!lb.some(r=>r.name==='Target Trader')&&lb.some(r=>r.name==='Hidden name'));
 t('reports need owner key',(await call('admin/reports')).s===401);
 const rp=await call('admin/reports',null,AK);t('owner sees report',rp.s===200&&rp.j.rows[0].reports===3);
 await call('admin/action',{ref:tr.ref,action:'clear'},AK);await sleep(100);
 lb=(await call('leaderboard')).j.rows;t('owner keeps name: visible again',lb.some(r=>r.name==='Target Trader'));
 t('action needs owner key',(await call('admin/action',{ref:tr.ref,action:'ban'})).s===401);
 await call('admin/action',{ref:tr.ref,action:'ban'},AK);await sleep(100);
 lb=(await call('leaderboard')).j.rows;t('ban removes score',!lb.some(r=>r.name==='Target Trader'));
 const again=(await call('run/start',{id:T,name:'Target Trader',mode:'daily'})).j;t('banned device cannot rank',again.ranked===false&&/turned off/.test(again.note));
 // erasure
 const before=(await call('admin',null,AK)).j.totals;
 t('erase ok',(await call('me/delete',{id:R1})).j.ok===1);
 const after=(await call('admin',null,AK)).j.totals;
 t('erase removed their data',after.visitors<before.visitors&&after.plays<before.plays);
 t('erased run is gone',(await call('run/start',{id:R1,resume:res[1].v.runId})).s===404);
 t('health check',(await fetch(B+'/healthz')).status===200);
 t('privacy page',(await fetch(B+'/privacy.html')).status===200&&(await fetch(B+'/terms.html')).status===200);
 console.log(ok+' passed, '+fail+' failed');
})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
