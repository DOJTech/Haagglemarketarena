const nm=()=>'T'+Math.random().toString(36).slice(2,10);
const lt=s=>[...s].map(c=>String.fromCharCode(97+parseInt(c,16))).join(''); // letters only: long digit runs look like phone numbers and are refused as names
const B='http://localhost:3055',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const id=()=>'p_'+[...Array(24)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');
let AK={};
async function adminLogin(){const r=await fetch(B+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:'dev-admin-key-0000'})});const j=await r.json();if(!j.token)throw new Error('owner login failed: '+JSON.stringify(j));AK={'x-admin-token':j.token}}
async function call(p,body,h){const r=await fetch(B+'/api/'+p,{method:body?'POST':'GET',headers:Object.assign({'content-type':'application/json'},h||{}),body:body?JSON.stringify(body):undefined});let j={};try{j=await r.json()}catch(e){}return{s:r.status,j}}
let ok=0,fail=0;const t=(n,c)=>{c?ok++:(fail++,console.log('FAIL',n));};
async function play(pid,mode){
 let v=(await call('run/start',{id:pid,name:'Camp '+lt(pid.slice(2,12)),mode,country:'NG'})).j;const rid=v.runId;
 const act=async(type,x)=>{await sleep(215);const r=await call('run/act',Object.assign({id:pid,runId:rid,type},x));if(r.s!==200)throw new Error(type+' '+r.s);v=r.j};
 for(let d=0;d<7;d++){for(const p of['rice','noo','noo']){if(v.cash>=v.cost[p])await act('buy',{pid:p,dir:1})}
  await act('open');while(['haggle','nostock','result'].includes(v.phase)){v.phase==='haggle'?await act('accept'):await act('next')}
  if(v.phase==='dayend')await act('nextday')}
 return v;
}
(async()=>{
 await adminLogin();
 const good={brand:'Sunrise Foods',product:'Sunrise Noodles',tagline:'Ready in 3 minutes',category:'food',variants:[0.5],fee_ngn:150000};
 t('create needs owner key',(await call('admin/campaign',good)).s===401);
 t('alcohol category refused',(await call('admin/campaign',Object.assign({},good,{category:'alcohol'}),AK)).s===400);
 t('restricted term refused',(await call('admin/campaign',Object.assign({},good,{product:'Cold Beer'}),AK)).s===400);
 t('leet-speak restricted term refused',(await call('admin/campaign',Object.assign({},good,{tagline:'B3tt1ng odds'}),AK)).s===400);
 t('phone number in ad refused',(await call('admin/campaign',Object.assign({},good,{tagline:'Call 08012345678'}),AK)).s===400);
 t('profanity refused',(await call('admin/campaign',Object.assign({},good,{brand:'Fuck Foods'}),AK)).s===400);
 t('bad price multiplier refused',(await call('admin/campaign',Object.assign({},good,{variants:[0.1]}),AK)).s===400);
 t('too many variants refused',(await call('admin/campaign',Object.assign({},good,{variants:[1,1,1,1,1]}),AK)).s===400);
 const mk=await call('admin/campaign',good,AK);t('valid campaign created',mk.s===200&&/^[0-9a-f]{24}$/.test(mk.j.token));
 const cid=mk.j.id,tok=mk.j.token;
 const pend=(await call('run/start',{id:id(),name:nm(),mode:'practice'})).j;t('pending campaign is NOT served',pend.sponsor===null);
 t('approve needs key',(await call('admin/campaign/action',{id:cid,action:'approve'})).s===401);
 t('bad action refused',(await call('admin/campaign/action',{id:cid,action:'delete'},AK)).s===400);
 t('approve ok',(await call('admin/campaign/action',{id:cid,action:'approve'},AK)).s===200);
 const pr=(await call('run/start',{id:id(),name:nm(),mode:'practice'})).j;
 t('live campaign served',pr.sponsor&&pr.sponsor.product==='Sunrise Noodles');
 t('price test changes sponsored price (x0.5)',pr.cost.noo>=270&&pr.cost.noo<=330);
 const rk=(await call('run/start',{id:id(),name:nm(),mode:'daily'})).j;
 t('ranked game shows brand',rk.ranked===true&&rk.sponsor&&rk.sponsor.brand==='Sunrise Foods');
 t('ranked game price unchanged',rk.cost.noo>=540&&rk.cost.noo<=660);
 await call('admin/campaign/action',{id:cid,action:'pause'},AK);
 t('paused campaign not served',(await call('run/start',{id:id(),name:nm(),mode:'practice'})).j.sponsor===null);
 await call('admin/campaign/action',{id:cid,action:'resume'},AK);
 const [a1,a2]=await Promise.all([play(id(),'practice'),play(id(),'practice')]);
 t('two practice weeks finished',a1.phase==='final'&&a2.phase==='final');
 const rp=await call('report/'+tok);
 console.log('report',JSON.stringify(rp.j.rows));
 t('brand report loads by token',rp.s===200&&rp.j.campaign.brand==='Sunrise Foods'&&/not real sales data/.test(rp.j.disclaimer));
 const g=rp.j.rows.find(x=>x.variant===0);t('price-test group has finished games',g&&g.runs>=2&&!g.hidden&&g.units_bought>0);
 t('report leaks no player ids',!JSON.stringify(rp.j).includes('p_'));
 t('wrong token refused',(await call('report/'+'0'.repeat(24))).s===404&&(await call('report/abc')).s===404);
 t('invoice marking works',(await call('admin/campaign/action',{id:cid,action:'unpaid'},AK)).s===200&&(await call('admin/campaign/action',{id:cid,action:'paid'},AK)).s===200);
 const ls=await call('admin/campaigns',null,AK);t('owner list shows campaign + invoice',ls.s===200&&ls.j.rows[0].invoice==='paid'&&ls.j.rows[0].served>=3);
 t('owner list needs key',(await call('admin/campaigns')).s===401);
 await call('admin/campaign/action',{id:cid,action:'end'},AK);
 t('ended campaign not served',(await call('run/start',{id:id(),name:nm(),mode:'practice'})).j.sponsor===null);
 console.log(ok+' passed, '+fail+' failed');
})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
