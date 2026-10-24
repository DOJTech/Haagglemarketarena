const test=require('node:test'),assert=require('node:assert/strict');
const {createEngine,START,P,CAMPAIGN,money}=require('../engine');
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
 assert.equal(f.rev,offer);assert.equal(f.cogs,cost);assert.equal(f.gross,offer-cost);assert.equal(f.unitsSold,1);invariants(s)});
test('repeated submission: a second accept of the same sale is rejected',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);assert.equal(E.apply(s,{type:'accept'}),null);const snap=clone(s);
 assert.ok(E.apply(s,{type:'accept'}));assert.deepEqual(clone(s),snap)});
test('rejected negotiation: asking too much costs patience, then the shopper walks',()=>{
 const s=E.fresh(true,'d','a');toHaggle(s,0);const max=s.cur.max;
 for(let i=0;i<2;i++){assert.equal(E.apply(s,{type:'counter',price:max+1}),null);assert.equal(s.phase,'haggle')}
 assert.equal(E.apply(s,{type:'counter',price:max+1}),null);assert.equal(s.phase,'result');assert.equal(s.res.ok,0);assert.equal(s.walked,1);invariants(s)});
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
 assert.ok(md.includes('₦'+SCORE.PROFIT_FULL.toLocaleString('en-US')));assert.ok(md.includes(LIQ_PCT+'%'));
 for(const k of['PROFIT_MAX','MARGIN_MAX','SAT_MAX','INV_MAX','CONS_MAX'])assert.ok(md.includes('| '+SCORE[k]+' |'),k)});
