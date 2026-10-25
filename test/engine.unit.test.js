const test=require('node:test'),assert=require('node:assert/strict');
const {createEngine,START,P,CAMPAIGN,money,WX,TYPES,PER,PER_MIN,FORECAST_RIGHT}=require('../engine');
const E=createEngine('unit-test-secret-0123456789'),RUN={id:'r1',ranked:false};
const lcg=seed=>{let a=seed>>>0;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296}};
const clone=o=>JSON.parse(JSON.stringify(o));
function invariants(s){
 assert.ok(Number.isInteger(s.cash),'cash integer');
 for(const p of P){assert.ok(Number.isInteger(s.spent[p.id])&&s.spent[p.id]>=0,'spent integer >=0');assert.ok(Number.isInteger(s.stock[p.id])&&s.stock[p.id]>=0,'stock integer >=0')}
 const f=E.finance(s);
 for(const k of['rev','cogs','writeOff','unitsBought','unitsSold','invCost'])assert.ok(Number.isInteger(f[k]),k+' integer');
 assert.equal(s.cash+f.invCost-START,f.rev-f.cogs-f.writeOff,'cash identity: cash + stock at cost - start = revenue - cogs - spoilage');
 assert.equal(f.unitsBought-f.unitsSold-s.acct.spoiledUnits-f.invUnits,0,'unit conservation');
}
function playRandom(s,rnd){
 let g=0;
 while(s.phase!=='final'&&g++<6000){
  const ph=s.phase;let b;
  if(ph==='stock')b=rnd()<.8?{type:'buy',pid:P[Math.floor(rnd()*P.length)].id,dir:1,qty:1+Math.floor(rnd()*3)}:{type:'open'};
  else if(ph==='haggle'){const x=rnd();b=x<.35?{type:'accept'}:x<.85?{type:'counter',price:Math.max(1,Math.round(s.cur.offer*(1+rnd())))}:{type:'leave'}}
  else if(ph==='result'||ph==='nostock')b={type:'next'};else b={type:'nextday'};
  const before=JSON.stringify(s),err=E.apply(s,b);
  if(err)assert.equal(JSON.stringify(s),before,'a rejected action must not change state: '+JSON.stringify(b));
  invariants(s);
 }
 assert.equal(s.phase,'final');return s;
}
test('engine refuses a short secret',()=>assert.throws(()=>createEngine('short')));
test('new game: ₦20,000, empty stock, margin is null (no divide by zero)',()=>{
 const s=E.fresh(true,'2026-10-19','a'),f=E.finance(s);
 assert.equal(s.cash,20000);assert.equal(f.rev,0);assert.equal(f.margin,null);assert.equal(f.satisfaction,null);invariants(s)});
test('campaign: seven distinct documented days',()=>{
 assert.equal(CAMPAIGN.length,7);assert.equal(new Set(CAMPAIGN.map(c=>c.t)).size,7);
 for(const c of CAMPAIGN){assert.ok(c.t&&c.d&&c.obj)}});
test('same inputs give the same market; other inputs give another',()=>{
 const a=E.build(true,'2026-10-19','r1'),b=E.build(true,'2026-10-19','r1');assert.deepEqual(a,b);
 const other=E.build(true,'2026-10-20','r1');assert.notDeepEqual(a.map(x=>x.cost),other.map(x=>x.cost));
 const E2=createEngine('another-secret-9876543210');assert.notDeepEqual(a.map(x=>x.cost),E2.build(true,'2026-10-19','r1').map(x=>x.cost));
 const p1=E.build(false,'2026-10-19','run-A'),p2=E.build(false,'2026-10-19','run-B');assert.notDeepEqual(p1.map(x=>x.cost),p2.map(x=>x.cost))});
test('ranked markets: same costs and shoppers for everyone, hidden limits vary slightly per run',()=>{
 const a=E.build(true,'2026-10-19','run-A'),b=E.build(true,'2026-10-19','run-B');
 assert.deepEqual(a.map(x=>x.cost),b.map(x=>x.cost));assert.deepEqual(a[0].cs.map(c=>c.p),b[0].cs.map(c=>c.p));
 assert.ok(a.some((d,i)=>d.cs.some((c,j)=>c.max!==b[i].cs[j].max)))});
test('buy: rejects bad products, directions and quantities, state unchanged',()=>{
 const s=E.fresh(true,'d','a'),snap=clone(s);
 for(const b of[{pid:'gold',dir:1},{pid:'rice',dir:0},{pid:'rice',dir:2},{pid:'rice',dir:'1'},{pid:'rice'},
  ...[0,-1,1.5,NaN,Infinity,-Infinity,'3',1e9,100,null,{}].map(q=>({pid:'rice',dir:1,qty:q}))]){
  assert.ok(E.apply(s,Object.assign({type:'buy'},b)),'should reject '+JSON.stringify(b));assert.deepEqual(clone(s),snap)}});
test('buy: insufficient funds is rejected and nothing changes',()=>{
 const s=E.fresh(true,'d','a'),snap=clone(s);
 assert.equal(E.apply(s,{type:'buy',pid:'rice',dir:1,qty:99}),'cash');assert.deepEqual(clone(s),snap);invariants(s)});
test('buy then take back restores money and stock exactly',()=>{
 const s=E.fresh(true,'d','a');assert.equal(E.apply(s,{type:'buy',pid:'fab',dir:1,qty:3}),null);
 assert.equal(E.apply(s,{type:'buy',pid:'fab',dir:-1,qty:3}),null);
 assert.equal(s.cash,START);assert.equal(s.stock.fab,0);assert.equal(s.spent.fab,0);invariants(s);
 assert.ok(E.apply(s,{type:'buy',pid:'fab',dir:-1}),'cannot take back what you did not buy today')});
test('actions in the wrong phase are rejected (no sale without a customer)',()=>{
 const s=E.fresh(true,'d','a');for(const t of['accept','leave','next','nextday'])assert.ok(E.apply(s,{type:t}),t);
 assert.ok(E.apply(s,{type:'counter',price:500}));assert.ok(E.apply(s,{type:'nonsense'}))});
test('no stock: shopper leaves, nothing can be sold',()=>{
 const s=E.fresh(true,'d','a');E.apply(s,{type:'open'});assert.equal(s.phase,'nostock');assert.ok(E.apply(s,{type:'accept'}));assert.equal(s.missed,1)});
function toHaggle(s,pid){ // buy stock the first customer wants, then open
 const first=s.sched[0].cs[0].p;assert.equal(E.apply(s,{type:'buy',pid:first,dir:1,qty:2}),null);E.apply(s,{type:'open'});assert.equal(s.phase,'haggle');return first}
test('invalid offers are rejected, state unchanged',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);const snap=clone(s);
 for(const price of[NaN,'500',-5,0,1.5,Infinity,1e9,null,undefined,{}]){assert.ok(E.apply(s,{type:'counter',price}),String(price));assert.deepEqual(clone(s),snap)}});
test('successful negotiation: accept sells at the offer, books revenue and cost',()=>{
 const s=E.fresh(true,'d','a'),pid=toHaggle(s,0),offer=s.cur.offer,cost=s.sched[0].cost[pid];
 assert.equal(E.apply(s,{type:'accept'}),null);const f=E.finance(s);
 const u=f.unitsSold;assert.ok(u===1||u===2);assert.equal(f.rev,offer*u);assert.ok(f.cogs>=cost*u-u&&f.cogs<=cost*u+u);assert.equal(f.gross,f.rev-f.cogs);invariants(s)});
test('repeated submission: a second accept of the same sale is rejected',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);assert.equal(E.apply(s,{type:'accept'}),null);const snap=clone(s);
 assert.ok(E.apply(s,{type:'accept'}));assert.deepEqual(clone(s),snap)});
test('rejected negotiation: asking too much costs patience, then the shopper walks',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);s.cur.type='sharp';s.cur.pat=s.cur.patMax=3;const max=s.cur.max;let g=0;
 while(s.phase==='haggle'&&g++<10){assert.equal(E.apply(s,{type:'counter',price:Math.round(max*1.2)}),null)}
 assert.equal(s.phase,'result');assert.equal(s.res.ok,0);assert.equal(s.walked,1);assert.ok(g<=3,'3 patience, each refusal costs 1');invariants(s)});
test('a counter at or under the limit sells, never below their offer',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);const o=s.cur.offer;E.apply(s,{type:'counter',price:Math.max(1,o-1)});assert.equal(s.res.price,o)});
test('profit and gross margin: exact and zero-safe',()=>{
 const s=E.fresh(true,'d','a');s.acct.rev=1000;s.acct.cogs=700;assert.equal(E.finance(s).margin,30);
 s.acct.cogs=1100;assert.equal(E.finance(s).margin,-10);s.acct.rev=0;s.acct.cogs=0;assert.equal(E.finance(s).margin,null);
 s.acct.rev=3;s.acct.cogs=2;assert.equal(E.finance(s).margin,33.3)});
test('large values stay exact integers',()=>{const s=E.fresh(true,'d','a');s.acct.rev=900000000;s.acct.cogs=600000001;const f=E.finance(s);assert.equal(f.gross,299999999);assert.ok(Number.isInteger(f.gross))});
test('money formatting',()=>{assert.equal(money(1234567),'₦1,234,567');assert.equal(money(0),'₦0')});
test('property test: 60 random full weeks keep every invariant and never corrupt state',()=>{
 for(let i=1;i<=60;i++){const s=E.fresh(i%2===0,'2026-10-19','run'+i),r=playRandom(s,lcg(i*7919));
  const sc=r.score;assert.ok(Number.isInteger(sc)&&sc>=0&&sc<=1000,'score range '+sc);
  assert.ok(Object.entries(r.breakdown.parts).every(([k,v])=>Number.isInteger(v)&&v>=0))}});
test('a full week with the same inputs gives the same result (reproducible)',()=>{
 const a=playRandom(E.fresh(true,'2026-10-19','same'),lcg(42)),b=playRandom(E.fresh(true,'2026-10-19','same'),lcg(42));
 assert.equal(a.score,b.score);assert.deepEqual(a.acct,b.acct)});
function scored(rev,cogs,satAvg,goodDays){
 const s=E.fresh(true,'d','a');s.acct.rev=rev;s.acct.cogs=cogs;s.cash=START+rev-cogs;s.sat={sum:satAvg*7,n:7};
 s.dayLog=Array.from({length:7},(_,i)=>({d:i+1,rev:1,cogs:i<goodDays?0:5,gross:i<goodDays?1:-4,sold:1}));return E.scoreOf(s)}
test('scoring: doing nothing scores zero',()=>assert.equal(E.scoreOf(E.fresh(true,'d','a')).total,0));
test('scoring: profit beats revenue alone',()=>{
 const balanced=scored(8000,5000,70,7).total,bigRevenueThinMargin=scored(20000,19500,70,7).total;assert.ok(balanced>bigRevenueThinMargin)});
test('scoring: the lowest price is not automatically the best',()=>{
 const giveaway=scored(5000,5000,100,7).total,balanced=scored(8000,5000,70,7).total;assert.ok(balanced>giveaway)});
test('scoring: never above 1000 or below 0',()=>{const best=scored(1e7,1e6,100,7);assert.ok(best.total<=1000&&best.total>=0);const worst=scored(0,50000,0,0);assert.equal(worst.total,0+worst.parts.inventory)});
test('sponsor price test only changes the sponsored product',()=>{
 const s=E.fresh(true,'d','a');const base=E.view(s,RUN).cost;s.camp={id:1,variant:0,mult:.5};const v=E.view(s,RUN).cost;
 assert.equal(v.noo,Math.round(base.noo*.5));for(const id of['tom','rice','fab','chg'])assert.equal(v[id],base[id])});
test('the player view never contains hidden shopper limits before a sale',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);const v=E.view(s,RUN),j=JSON.stringify(v);
 assert.ok(!('max' in v.cur));assert.ok(!j.includes('"sched"'));assert.deepEqual(v.log,[]);assert.equal(v.score,null)});
test('every purchase and sale appears in the transaction history',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);E.apply(s,{type:'accept'});const k=s.hist.map(h=>h.k);assert.ok(k.includes('buy')&&k.includes('sale'))});
test('docs/RULES.md matches the engine (no drift)',()=>{
 const md=require('fs').readFileSync(require('path').join(__dirname,'..','docs','RULES.md'),'utf8'),{SCORE,LIQ_PCT}=require('../engine');
 for(const c of CAMPAIGN)assert.ok(md.includes(c.t),'campaign day missing from docs: '+c.t);
 for(const w of Object.values(WX))assert.ok(md.includes(w.n),'weather missing from docs: '+w.n);
 for(const t of Object.values(TYPES))assert.ok(md.includes(t.n),'shopper type missing from docs: '+t.n);
 assert.ok(md.includes('₦'+SCORE.PROFIT_FULL.toLocaleString('en-US')));assert.ok(md.includes(LIQ_PCT+'%'));
 for(const k of['PROFIT_MAX','MARGIN_MAX','SAT_MAX','INV_MAX','CONS_MAX'])assert.ok(md.includes('| '+SCORE[k]+' |'),k)});

/* ---------- v3: weather, goods, shoppers, negotiation, time ---------- */
test('the product list in the browser matches the engine (ids and order)',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','public','common.js'),'utf8'),ids=[...src.slice(src.indexOf('const P='),src.indexOf('const WXC=')).matchAll(/id:'(\w+)'/g)].map(m=>m[1]);
 assert.deepEqual(ids,P.map(p=>p.id));
 const sl=[...src.slice(src.indexOf('const P='),src.indexOf('const WXC=')).matchAll(/id:'(\w+)'[^}]*sl:1/g)].map(m=>m[1]);assert.deepEqual(sl,P.filter(p=>p.spoil).map(p=>p.id),'spoiling goods match')});
test('the browser weather names and emoji match the engine',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','public','common.js'),'utf8'),blk=src.slice(src.indexOf('const WXC='),src.indexOf('\n',src.indexOf('const WXC=')));
 for(const [k,w] of Object.entries(WX)){assert.ok(blk.includes(k+":{n:'"+w.n+"',e:'"+w.e+"'}"),'weather '+k)}});
test('weather: every day has a real weather and a forecast, same for everyone on a ranked date, different dates differ',()=>{
 const a=E.build(true,'2026-11-01','x'),b=E.build(true,'2026-11-01','y'),c=E.build(true,'2026-11-02','x');
 assert.equal(a.length,7);for(const d of a){assert.ok(WX[d.wx]&&WX[d.fc])}
 assert.deepEqual(a.map(d=>[d.wx,d.fc]),b.map(d=>[d.wx,d.fc]));assert.notDeepEqual(a.map(d=>d.wx),c.map(d=>d.wx))});
test('forecasts are right about three times in four, and not always',()=>{
 let right=0,n=0;for(let i=0;i<400;i++)for(const d of E.build(true,'2026-12-'+i,'x')){n++;if(d.wx===d.fc)right++}
 const r=right/n;assert.ok(r>.68&&r<.84,'forecast accuracy '+r);assert.ok(FORECAST_RIGHT===.75)});
test('seasons make sense: wet-season weeks have rain, dry-season weeks have harmattan or sun',()=>{
 let rainy=0,dusty=0;for(let i=0;i<300;i++){const w=E.build(true,'2027-01-'+i,'x').map(d=>d.wx);if(w.filter(x=>x==='rain'||x==='storm').length>=2)rainy++;if(w.includes('harm'))dusty++}
 assert.ok(rainy>40&&dusty>40,'rainy '+rainy+' dusty '+dusty)});
test('weather moves demand: umbrellas are asked for far more in a storm than in sunshine',()=>{
 let storm=0,sun=0,ns=0,nu=0;for(let i=0;i<500;i++)for(const d of E.build(true,'2027-02-'+i,'x')){const u=d.cs.filter(c=>c.p==='umb').length;if(d.wx==='storm'){storm+=u;ns++}if(d.wx==='sun'){sun+=u;nu++}}
 assert.ok(storm/ns>2*(sun/nu),'storm '+storm/ns+' sun '+sun/nu)});
test('shoppers per day: 7 to 10, set by weather and reputation',()=>{
 for(let i=0;i<60;i++){const s=E.fresh(true,'2027-03-'+i,'r'+i);assert.ok(s.n>=PER_MIN&&s.n<=PER);assert.equal(s.sched[0].cs.length,PER)}
 const s=E.fresh(true,'2027-03-01','r');s.sched[1].wx='sun';s.d=1;s.sat={sum:90*5,n:5};assert.equal(E.dayCount(s),10,'sunny + good reputation is capped at 10');
 s.sat={sum:30*5,n:5};assert.equal(E.dayCount(s),9,'poor reputation costs one shopper');s.sched[1].wx='storm';assert.equal(E.dayCount(s),7,'storm + poor reputation, never below 7')});
test('the player sees the forecast in the morning and the real weather only once the stall is open',()=>{
 const s=E.fresh(true,'d','a'),v=E.view(s,RUN);assert.ok(WX[v.fc]);assert.equal(v.wx,null);
 toHaggle(s,0);const v2=E.view(s,RUN);assert.equal(v2.wx,s.sched[0].wx)});
test('the view never exposes a shopper limit or personality; it shows a hint, quantity and patience',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);const v=E.view(s,RUN);
 assert.ok(!('type' in v.cur)&&!('max' in v.cur));assert.ok(typeof v.cur.tell==='string'&&v.cur.tell.length>5);assert.ok(v.cur.qty===1||v.cur.qty===2);assert.ok(v.cur.patMax>=2);
 const j=JSON.stringify(v);for(const t of Object.values(TYPES))assert.ok(!j.includes(t.n),'personality name leaked: '+t.n)});
test('hints are mostly honest: about 85 to 92 percent match the real personality; the rest bluff',()=>{
 const owner={};for(const [k,t] of Object.entries(TYPES))for(const h of t.tells)owner[h]=k;let ok=0,n=0;
 for(let i=0;i<200;i++)for(const d of E.build(true,'2027-04-'+i,'x'))for(const c of d.cs){n++;if(owner[c.tell]===c.type)ok++}
 assert.ok(ok/n>.82&&ok/n<.95,String(ok/n))});
test('personalities differ in what they will really pay (big spenders more, bargain hunters less)',()=>{
 const sum={};for(let i=0;i<150;i++){const s=E.fresh(true,'2027-05-'+i,'x');for(let d=0;d<7;d++){s.d=d;const m=E.market(s);for(const c of s.sched[d].cs){const r=c.max/((m[c.p][0]+m[c.p][1])/2);(sum[c.type]=sum[c.type]||[]).push(r)}}}
 const avg=t=>sum[t].reduce((a,b)=>a+b,0)/sum[t].length;assert.ok(avg('proud')>avg('rush')+.1);assert.ok(avg('rush')>avg('hunter')+.05);assert.ok(avg('hunter')<1)});
test('a near miss (within 4 percent over their limit) still sells, at their limit',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);s.cur.type='sharp';const max=s.cur.max;E.apply(s,{type:'counter',price:Math.floor(max*1.03)});
 assert.equal(s.phase,'result');assert.equal(s.res.ok,1);assert.equal(s.res.price,max);assert.equal(s.res.met,1)});
test('a big spender walks at once if you push more than 12 percent over their limit',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);s.cur.type='proud';const max=s.cur.max;E.apply(s,{type:'counter',price:Math.ceil(max*1.2)});
 assert.equal(s.phase,'result');assert.equal(s.res.ok,0);assert.equal(s.res.why,'insulted')});
test('a very high ask costs two patience, a mild one costs one',()=>{
 const a=E.fresh(true,'d','a');toHaggle(a,0);a.cur.type='sharp';a.cur.pat=a.cur.patMax=3;E.apply(a,{type:'counter',price:Math.round(a.cur.max*1.08)});assert.equal(a.cur.pat,2);
 const b=E.fresh(true,'d','a');toHaggle(b,0);b.cur.type='sharp';b.cur.pat=b.cur.patMax=3;E.apply(b,{type:'counter',price:Math.round(b.cur.max*1.5)});assert.equal(b.cur.pat,1)});
test('their reply never reveals their limit: the old limit calculation is wrong by 10 percent or more at the median',()=>{
 const errs=[];for(let k=1;k<=250;k++){const s=E.fresh(true,'2027-06-'+k,'l'+k);s.cash=1e7;for(const p of P)E.apply(s,{type:'buy',pid:p.id,dir:1,qty:2});E.apply(s,{type:'open'});
  if(s.phase!=='haggle')continue;const o0=s.cur.offer,max=s.cur.max;E.apply(s,{type:'counter',price:Math.round(max*1.2)});if(s.phase!=='haggle')continue;
  assert.ok(s.cur.offer>=o0&&s.cur.offer<=max,'their offer moves up but never past their limit');errs.push(Math.abs(o0+(s.cur.offer-o0)/.45-max)/max)}
 errs.sort((a,b)=>a-b);assert.ok(errs[errs.length>>1]>.1,'median error '+errs[errs.length>>1])});
test('a shopper who wants two takes two (or what you have), books both units, and the books balance',()=>{
 let tested=0;for(let k=1;k<=80&&tested<3;k++){const s=E.fresh(true,'2027-07-'+k,'q'+k);const c0=s.sched[0].cs[0];if(c0.qty!==2)continue;
  E.apply(s,{type:'buy',pid:c0.p,dir:1,qty:3});E.apply(s,{type:'open'});E.apply(s,{type:'accept'});assert.equal(s.res.qty,2);assert.equal(s.stock[c0.p],1);assert.equal(E.finance(s).unitsSold,2);invariants(s);
  const t=E.fresh(true,'2027-07-'+k,'q'+k);E.apply(t,{type:'buy',pid:c0.p,dir:1,qty:1});E.apply(t,{type:'open'});E.apply(t,{type:'accept'});assert.equal(t.res.qty,1);assert.equal(t.stock[c0.p],0);invariants(t);tested++}
 assert.ok(tested>0)});
test('selling time: arrivals and refused offers use it, and when it runs out the rest of the day is lost',()=>{
 const s=E.fresh(true,'d','a'),t0=s.time;assert.equal(t0,Math.round(s.n*1+5));for(const p of P)E.apply(s,{type:'buy',pid:p.id,dir:1,qty:3});
 E.apply(s,{type:'open'});assert.equal(s.time,t0-1,'a shopper arriving costs 1');s.cur.type='sharp';s.cur.pat=3;E.apply(s,{type:'counter',price:Math.round(s.cur.max*1.2)});assert.equal(s.time,t0-2,'a refused counter costs 1');
 s.time=0;E.apply(s,{type:'leave'});E.apply(s,{type:'next'});assert.equal(s.phase,s.d>=6?'final':'dayend');assert.ok(s.dayLog[0].lost>=1,'waiting shoppers were lost');invariants(s)});
test('an impatient shopper (in a hurry) accepts quickly but their limit shrinks when you waste their time',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);s.cur.type='rush';s.cur.pat=s.cur.patMax=3;const m0=s.cur.max;E.apply(s,{type:'counter',price:Math.round(m0*1.2)});assert.ok(s.cur.max<m0)});
test('regulars pay a little more when your reputation is good, a little less when it is poor',()=>{
 const mk=satAvg=>{const s=E.fresh(true,'d','a');s.sched[0].cs[0].type='loyal';s.sched[0].cs[0].p='rice';s.sat={sum:satAvg*5,n:5};s.cash=1e6;E.apply(s,{type:'buy',pid:'rice',dir:1,qty:3});E.apply(s,{type:'open'});return s.cur.max};
 const hi=mk(90),mid=mk(70),lo=mk(40);assert.ok(hi>mid&&mid>lo)});
test('property test: 100 random full weeks under the new rules keep every invariant',()=>{
 for(let i=1;i<=100;i++){const s=E.fresh(i%2===0,'2026-10-2'+(i%9),'v3run'+i),r=playRandom(s,lcg(i*104729));assert.ok(r.score>=0&&r.score<=1000)}});
