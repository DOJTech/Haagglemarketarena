const nm=()=>'T'+Math.random().toString(36).slice(2,10);
const B='http://localhost:3055',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const id=()=>'p_'+[...Array(24)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');
let AK={};
async function adminLogin(){const r=await fetch(B+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:'dev-admin-key-0000'})});const j=await r.json();if(!j.token)throw new Error('owner login failed: '+JSON.stringify(j));AK={'x-admin-token':j.token}}
async function call(p,body,h){const r=await fetch(B+'/api/'+p,{method:body?'POST':'GET',headers:Object.assign({'content-type':'application/json'},h||{}),body:body?JSON.stringify(body):undefined});let j={};try{j=await r.json()}catch(e){}return{s:r.status,j}}
let ok=0,fail=0;const t=(n,c)=>{c?ok++:(fail++,console.log('FAIL',n));};
async function play(pid,name,country){
 let v=(await call('run/start',{id:pid,name,mode:'daily',country})).j;const rid=v.runId;
 const act=async(type,x)=>{await sleep(215);const r=await call('run/act',Object.assign({id:pid,runId:rid,type},x));if(r.s!==200)throw new Error(type+' '+r.s);v=r.j};
 for(let d=0;d<7;d++){for(const p of['rice','fab','chg','noo']){if(v.cash>=v.cost[p])await act('buy',{pid:p,dir:1})}
  await act('open');while(['haggle','nostock','result'].includes(v.phase)){v.phase==='haggle'?await act('accept'):await act('next')}
  if(v.phase==='dayend')await act('nextday')}
 return v;
}
(async()=>{
 await adminLogin();
 const N1=id(),G1=id(),X=id();
 await Promise.all([play(N1,'Ngozi Lagos','NG'),play(G1,'Kofi Accra','GH')]);
 await sleep(5200);
 const ng=(await call('leaderboard?country=NG')).j.rows,gh=(await call('leaderboard?country=GH')).j.rows,all=(await call('leaderboard')).j.rows;
 t('NG league only NG',ng.length===1&&ng[0].country==='NG'&&ng[0].name==='Ngozi Lagos');
 t('GH league only GH',gh.length===1&&gh[0].country==='GH');
 t('all countries has both',all.length===2);
 t('bad country param ignored',(await call('leaderboard?country=ZZ')).j.rows.length===2);
 const wk=(await call('leaderboard?range=week')).j.rows;
 t('weekly board works',wk.length===2&&wk.every(r=>r.days===1&&Number.isFinite(r.daily)));
 const pf=(await call('me/profile',{id:N1})).j,pn=(await call('me/profile',{id:X})).j;
 t('streak 1 after a finished run',pf.streak===1&&pf.plays===1);
 t('new device streak 0',pn.streak===0&&pn.plays===0);
 const ad=(await call('admin',null,AK)).j;
 t('retention fields',ad.retention&&'d1' in ad.retention&&Array.isArray(ad.retention.cohorts));
 t('countries listed',ad.countries.some(c=>c.country==='NG')&&ad.countries.some(c=>c.country==='GH'));
 const sp=await call('admin/sponsor',null,AK);
 t('sponsor insights rows',sp.s===200&&sp.j.rows.length>=1);
 console.log('sponsor',JSON.stringify(sp.j.rows));
 t('sponsor needs owner key',(await call('admin/sponsor')).s===401);
 const ip=await call('admin/ip',null,AK);t('ip check route',ip.s===200&&!!ip.j.seenAs);
 t('ip check needs key',(await call('admin/ip')).s===401);
 const hz=await fetch(B+'/healthz');t('healthz checks db',hz.status===200);
 const h=await fetch(B+'/');t('security headers',/frame-ancestors/.test(h.headers.get('content-security-policy')||'')&&!!h.headers.get('permissions-policy'));
 t('pwa files',(await fetch(B+'/manifest.webmanifest')).status===200&&(await fetch(B+'/sw.js')).status===200&&(await fetch(B+'/icon-512.png')).status===200);
 console.log(ok+' passed, '+fail+' failed');
})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
