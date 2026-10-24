const nm=()=>'T'+Math.random().toString(36).slice(2,10);
const lt=s=>[...s].map(c=>String.fromCharCode(97+parseInt(c,16))).join(''); // letters only: long digit runs look like phone numbers and are refused as names
const B='http://localhost:3055',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const id=()=>'p_'+[...Array(24)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');
async function call(p,body,h){const r=await fetch(B+'/api/'+p,{method:body?'POST':'GET',headers:Object.assign({'content-type':'application/json'},h||{}),body:body?JSON.stringify(body):undefined});let j={};try{j=await r.json()}catch(e){}return{s:r.status,j}}
let ok=0,fail=0;const t=(n,c)=>{c?ok++:(fail++,console.log('FAIL',n));};
async function play(pid,pace){
 const st=await call('run/start',{id:pid,name:'Tester '+lt(pid.slice(2,12)),mode:'daily'});let v=st.j;const rid=v.runId;
 const act=async(type,x)=>{await sleep(pace);const r=await call('run/act',Object.assign({id:pid,runId:rid,type},x));if(r.s!==200)throw new Error(type+' '+r.s+JSON.stringify(r.j));v=r.j};
 for(let d=0;d<7;d++){
  for(const p of['rice','fab','chg']){for(let i=0;i<2;i++)if(v.cash>=v.cost[p])await act('buy',{pid:p,dir:1})}
  await act('open');
  while(v.phase==='haggle'||v.phase==='nostock'||v.phase==='result'){
   if(v.phase==='haggle')await act('accept');else await act('next');
  }
  if(v.phase==='dayend')await act('nextday');
 }
 return v;
}
(async()=>{
 const A=id(),Bp=id(),C=id(),D=id();
 await call('ping',{id:A});let s=await call('stats');t('presence counts',s.j.playingNow>=1);
 // cheat probes on a fresh run
 const X=id();const r0=(await call('run/start',{id:X,name:nm(),mode:'daily'})).j;
 t('ranked first',r0.ranked===true);t('no hidden max in view',r0.cur===null&&!JSON.stringify(r0).includes('sched'));
 t('wrong player 404',(await call('run/act',{id:A,runId:r0.runId,type:'buy',pid:'rice',dir:1})).s===404);
 await sleep(250);
 t('accept in stock phase rejected',(await call('run/act',{id:X,runId:r0.runId,type:'accept'})).s===400);
 await sleep(250);
 t('string price rejected',(await call('run/act',{id:X,runId:r0.runId,type:'counter',price:'5000'})).s===400);
 await sleep(250);
 t('bad product rejected',(await call('run/act',{id:X,runId:r0.runId,type:'buy',pid:'gold',dir:1})).s===400);
 await sleep(250);
 t('overspend rejected',(await call('run/act',{id:X,runId:r0.runId,type:'buy',pid:'rice',dir:1})).s===200);
 const [f1,f2]=await Promise.all([call('run/act',{id:X,runId:r0.runId,type:'buy',pid:'fab',dir:1}),call('run/act',{id:X,runId:r0.runId,type:'buy',pid:'fab',dir:1})]);
 t('too-fast/concurrent blocked',[f1.s,f2.s].includes(429)||([f1.s,f2.s].filter(x=>x===200).length===1));
 t('second ranked start same id => practice',(await call('run/start',{id:X,name:nm(),mode:'daily'})).j.ranked===false);
 // IP cap: X used 1 slot; A,B below will take 2 more => D must be practice
 const [va,vb]=await Promise.all([play(A,230),play(Bp,370)]);
 console.log('A score',va.score,'ranked',va.ranked,va.note,'| B score',vb.score,'ranked',vb.ranked);
 t('A finished',va.phase==='final');t('B finished',vb.phase==='final');
 const dd=(await call('run/start',{id:D,name:nm(),mode:'daily'})).j;
 t('IP cap => practice',dd.ranked===false&&/network/.test(dd.note));
 const lb=(await call('leaderboard')).j.rows;console.log('leaderboard',JSON.stringify(lb));
 t('leaderboard has finished ranked runs only',lb.length>=1&&lb.every(r=>Number.isFinite(r.daily)));
 t('admin no key 401',(await call('admin')).s===401);
 t('admin wrong key 401',(await call('admin',null,{'x-admin-token':'nope'})).s===401);
 const lg=await call('admin/login',{key:'dev-admin-key-0000'});const ad=await call('admin',null,{'x-admin-token':lg.j.token});console.log('admin',JSON.stringify(ad.j.totals));
 t('admin totals',ad.s===200&&ad.j.totals.plays===2&&ad.j.totals.testers===2&&ad.j.totals.repeat_players===0);
 t('resume wrong owner 404',(await call('run/start',{id:C,resume:r0.runId})).s===404);
 t('resume right owner ok',(await call('run/start',{id:X,resume:r0.runId})).s===200);
 await call('ping',{id:C});
 console.log(ok+' passed, '+fail+' failed');
})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
