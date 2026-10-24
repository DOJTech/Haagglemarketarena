'use strict';
/* HAGGLE MARKET ARENA: game rules, money, scoring. Pure logic, no network or database.
   Every money value is a whole naira (integer). Rules are documented in docs/RULES.md. */
const crypto=require('crypto');
const START=20000,PER=6,DAYS=7,LIQ_PCT=70;
const SCORE={PROFIT_FULL:12000,PROFIT_MAX:500,MARGIN_LOW:5,MARGIN_FULL:35,MARGIN_MAX:150,SAT_MAX:150,INV_MAX:100,CONS_MAX:100,TOTAL_MAX:1000};
const P=[{id:'tom',base:900,spoil:1},{id:'rice',base:2400},{id:'fab',base:1800},{id:'chg',base:700},{id:'noo',base:600}];
const PM=Object.fromEntries(P.map(p=>[p.id,p]));
// The seven-day campaign: a fixed, documented situation for each day. Only prices and shoppers are random.
const CAMPAIGN=[
 {t:'Opening day',d:'A normal market. Learn what each shopper is willing to pay.',obj:'Learn the market and aim for a healthy margin on every sale.',cost:{},dem:{}},
 {t:'Supplier cost increase',d:'Fuel costs push up wholesale prices for tomatoes and rice.',obj:'Your costs rose. Protect your margin without pricing yourself out.',cost:{tom:1.25,rice:1.2},dem:{}},
 {t:'A rival undercuts you',d:'A nearby stall is cutting prices, so shoppers are less willing to pay.',obj:'Decide whether to hold your price or sell more for less.',cost:{},dem:{all:.85}},
 {t:'Wedding season',d:'Fabric is in demand and buyers will pay more for it.',obj:'Demand is strong. Do not give discounts you do not need to give.',cost:{},dem:{fab:1.5}},
 {t:'Limited supply',d:'Tomatoes are scarce, and the naira slips so imported goods cost more.',obj:'Buy carefully. Scarce stock is expensive stock.',cost:{tom:1.3,chg:1.3,fab:1.15},dem:{}},
 {t:'Discount-hunting shoppers',d:'Salaries are late. Shoppers open with low offers and ask for discounts.',obj:'Decide when a discount is worth it for customer goodwill.',cost:{},dem:{all:.9},offer:[.45,.6]},
 {t:'Closing day',d:'Last day. Unsold stock is valued at only '+LIQ_PCT+'% of what you paid.',obj:'Clear your stock. Leftover goods lose value.',cost:{},dem:{all:1.1}}];
const NAMES=['Aunty Ngozi','Mr Tunde','Madam Zainab','Chidi','Bisi','Oga Musa','Amaka','Kofi','Fatima','Mama Eniola','Segun','Wanjiru'];
const FACES=['👩🏾','👨🏿','🧕🏽','👨🏾','👩🏿','👴🏾','👩🏽','👨🏽'];
const mul=a=>()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
const zero=()=>Object.fromEntries(P.map(p=>[p.id,0]));
const money=n=>'₦'+String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const isInt=n=>Number.isInteger(n);

function createEngine(secret){
 if(typeof secret!=='string'||secret.length<16)throw new Error('engine needs a secret of 16 or more characters');
 const seedOf=s=>parseInt(crypto.createHmac('sha256',secret).update(s).digest('hex').slice(0,8),16);
 // Reproducible: ranked markets use HMAC(secret, "haggle"+date); practice markets use the run id. Jitter is per run.
 function build(daily,day,runId){
  const R=mul(daily?seedOf('haggle'+day):seedOf('p'+runId)),J=mul(seedOf('j'+runId));
  const rnd=(a,b)=>a+R()*(b-a),pick=a=>a[Math.floor(R()*a.length)],out=[];
  for(let d=0;d<DAYS;d++){
   const ev=CAMPAIGN[d],cost={};
   P.forEach(p=>{cost[p.id]=Math.round(p.base*rnd(.92,1.08)*(ev.cost[p.id]||1))});
   const wt=P.map(p=>ev.dem[p.id]||ev.dem.all||1),cs=[],or=ev.offer||[.55,.7];
   for(let i=0;i<PER;i++){
    let r=R()*wt.reduce((a,b)=>a+b,0),k=0;while(k<wt.length-1&&r>wt[k]){r-=wt[k];k++}
    const p=P[k],base=Math.round(p.base*1.6*rnd(.75,1.45)*wt[k]);
    const max=Math.round(base*(.94+J()*.12)),offer=Math.round(max*rnd(or[0],or[1]));
    cs.push({name:pick(NAMES),face:pick(FACES),p:p.id,max,offer,first:offer});
   }
   out.push({ev:{t:ev.t,d:ev.d,obj:ev.obj},cost,cs});
  }
  return out;
 }
 const fresh=(daily,day,id)=>({v:2,sched:build(daily,day,id),d:0,phase:'stock',cash:START,stock:zero(),spent:zero(),bought:zero(),bt:zero(),ci:0,cur:null,res:null,
  log:[],hist:[],dayLog:[],dayAcc:{rev:0,cogs:0,sold:0,walked:0,miss:0},acct:{rev:0,cogs:0,writeOff:0,unitsBought:0,unitsSold:0,spoiledUnits:0,tx:0},sat:{sum:0,n:0},
  sold:0,missed:0,walked:0,table:0,spoiled:0,score:0,breakdown:null,result:0,liq:0,note:'',spBuy:0,camp:null,sponsor:null,t0:Date.now(),last:0});
 // A sponsor price test changes only the wholesale price of the sponsored product, and only in practice games.
 const costOf=(s,id)=>{const b=s.sched[s.d].cost[id];return id==='noo'&&s.camp&&s.camp.mult?Math.round(b*s.camp.mult):b};
 const costMap=s=>Object.fromEntries(P.map(p=>[p.id,costOf(s,p.id)]));
 const unitCosts=s=>Object.fromEntries(P.map(p=>[p.id,s.stock[p.id]>0?Math.round(s.spent[p.id]/s.stock[p.id]):0]));
 const note=(s,k,p,q,amt,x)=>{s.hist.push(Object.assign({d:s.d+1,k,p,q,amt},x||{}));if(s.hist.length>400)s.hist.shift()};
 function finance(s){
  const a=s.acct;let invUnits=0,invCost=0;P.forEach(p=>{invUnits+=s.stock[p.id];invCost+=s.spent[p.id]});
  const gross=a.rev-a.cogs;
  return{start:START,cash:s.cash,rev:a.rev,cogs:a.cogs,gross,margin:a.rev>0?Math.round(1000*gross/a.rev)/10:null,writeOff:a.writeOff,afterSpoilage:gross-a.writeOff,
   unitsBought:a.unitsBought,unitsSold:a.unitsSold,invUnits,invCost,tx:a.tx,satisfaction:s.sat.n?Math.round(s.sat.sum/s.sat.n):null,day:s.d+1,days:DAYS};
 }
 function scoreOf(s){
  const f=finance(s),liq=Math.round(f.invCost*LIQ_PCT/100),result=s.cash+liq-START,purchases=f.cogs+f.writeOff+f.invCost;
  const lossRatio=purchases>0?(f.writeOff+(f.invCost-liq))/purchases:0;
  const good=s.dayLog.filter(x=>x.sold>0&&x.gross>=0).length;
  const parts={
   profit:clamp(Math.round(SCORE.PROFIT_MAX*result/SCORE.PROFIT_FULL),0,SCORE.PROFIT_MAX),
   margin:f.margin==null?0:Math.round(SCORE.MARGIN_MAX*clamp((f.margin-SCORE.MARGIN_LOW)/(SCORE.MARGIN_FULL-SCORE.MARGIN_LOW),0,1)),
   satisfaction:f.satisfaction==null?0:Math.round(SCORE.SAT_MAX*f.satisfaction/100),
   inventory:purchases>0?Math.round(SCORE.INV_MAX*(1-clamp(lossRatio*2,0,1))):0,
   consistency:Math.round(SCORE.CONS_MAX*good/DAYS)};
  return{total:Object.values(parts).reduce((a,b)=>a+b,0),parts,result,liquidation:liq};
 }
 function finish(s){const sc=scoreOf(s);s.liq=sc.liquidation;s.result=sc.result;s.score=sc.total;s.breakdown=sc}
 function nextC(s){
  if(s.ci>=PER)return endDay(s);
  const c=s.sched[s.d].cs[s.ci++];s.cur=Object.assign({},c,{pat:3,said:''});s.res=null;
  if(s.stock[c.p]>0)s.phase='haggle';
  else{s.phase='nostock';s.missed++;s.dayAcc.miss++;s.sat.n++;s.log.push({p:c.p,miss:1});note(s,'nostock',c.p,0,0)}
  return null;
 }
 function sell(s,price){
  const c=s.cur,cg=s.stock[c.p]===1?s.spent[c.p]:Math.round(s.spent[c.p]/s.stock[c.p]);
  s.spent[c.p]-=cg;s.stock[c.p]--;s.cash+=price;
  s.acct.rev+=price;s.acct.cogs+=cg;s.acct.unitsSold++;s.acct.tx++;
  s.dayAcc.rev+=price;s.dayAcc.cogs+=cg;s.dayAcc.sold++;s.sold++;s.table+=c.max-price;
  const sat=clamp(Math.round(50+125*(c.max-price)/c.max),50,100);s.sat.sum+=sat;s.sat.n++;
  s.log.push({p:c.p,price,first:c.first,max:c.max,gain:price-cg});note(s,'sale',c.p,1,price,{cogs:cg});
  s.res={ok:1,price,gain:price-cg,left:c.max-price,sat};s.phase='result';return null;
 }
 function walk(s){
  const c=s.cur;s.log.push({p:c.p,walk:1,first:c.first,max:c.max});s.walked++;s.dayAcc.walked++;s.sat.sum+=20;s.sat.n++;
  note(s,'walk',c.p,0,0);s.res={ok:0,max:c.max};s.phase='result';return null;
 }
 function endDay(s){
  let sp=0,wo=0;
  P.forEach(p=>{if(p.spoil&&s.stock[p.id]>0){const u=s.stock[p.id],v=s.spent[p.id];sp+=u;wo+=v;note(s,'spoil',p.id,u,v);s.stock[p.id]=0;s.spent[p.id]=0}});
  s.spoiled=sp;s.acct.writeOff+=wo;s.acct.spoiledUnits+=sp;
  s.dayLog.push({d:s.d+1,rev:s.dayAcc.rev,cogs:s.dayAcc.cogs,gross:s.dayAcc.rev-s.dayAcc.cogs,sold:s.dayAcc.sold,walked:s.dayAcc.walked,miss:s.dayAcc.miss,writeOff:wo});
  s.dayAcc={rev:0,cogs:0,sold:0,walked:0,miss:0};s.cur=null;s.res=null;
  s.phase=s.d>=DAYS-1?'final':'dayend';if(s.phase==='final')finish(s);
  return null;
 }
 // Returns an error string and leaves the state UNCHANGED when an action is invalid.
 function apply(s,b){
  const t=b.type,p=s.phase,c=s.cur;
  if(t==='buy'){
   if(p!=='stock'||!PM[b.pid]||(b.dir!==1&&b.dir!==-1))return'bad';
   const q=b.qty===undefined?1:b.qty;if(!isInt(q)||q<1||q>99)return'bad quantity';
   const cost=costOf(s,b.pid),amt=cost*q;
   if(b.dir===1){
    if(s.cash<amt)return'cash';
    s.spent[b.pid]+=amt;s.stock[b.pid]+=q;s.cash-=amt;s.bought[b.pid]+=q;s.bt[b.pid]+=q;s.acct.unitsBought+=q;if(b.pid==='noo')s.spBuy+=q;
    s.acct.tx++;note(s,'buy',b.pid,q,amt);
   }else{
    if((s.bought[b.pid]||0)<q)return'none';
    s.spent[b.pid]-=amt;s.stock[b.pid]-=q;s.cash+=amt;s.bought[b.pid]-=q;s.bt[b.pid]-=q;s.acct.unitsBought-=q;if(b.pid==='noo')s.spBuy-=q;
    s.acct.tx++;note(s,'return',b.pid,q,amt);
   }
   return null;
  }
  if(t==='open'){if(p!=='stock')return'bad';s.ci=0;return nextC(s)}
  if(t==='accept'){if(p!=='haggle')return'bad';return sell(s,c.offer)}
  if(t==='counter'){
   if(p!=='haggle'||!isInt(b.price)||b.price<1||b.price>1e6)return'bad';
   if(b.price<=c.max)return sell(s,Math.max(b.price,c.offer));
   c.pat--;if(c.pat<=0)return walk(s);
   c.offer=Math.round(c.offer+(c.max-c.offer)*.45);c.said='Too high! My best is '+money(c.offer)+'.';return null;
  }
  if(t==='leave'){if(p!=='haggle')return'bad';return walk(s)}
  if(t==='next'){if(p!=='result'&&p!=='nostock')return'bad';return nextC(s)}
  if(t==='nextday'){if(p!=='dayend')return'bad';s.d++;s.phase='stock';s.bought=zero();s.cur=null;s.res=null;return null}
  return'bad';
 }
 const final=s=>s.phase==='final';
 const view=(s,run)=>{
  const c=s.cur;
  return{runId:run.id,v:2,day:s.d+1,days:DAYS,per:PER,cash:s.cash,phase:s.phase,ev:s.sched[s.d].ev,cost:costMap(s),sponsor:s.sponsor||null,
   stock:s.stock,basis:unitCosts(s),bought:s.bought,idx:s.ci,cur:c&&{name:c.name,face:c.face,p:c.p,offer:c.offer,pat:c.pat,said:c.said},
   res:s.res,log:s.log,fin:finance(s),hist:s.hist.slice(-40),dayLog:s.dayLog,spoiled:s.spoiled,table:s.table,sold:s.sold,missed:s.missed,walked:s.walked,
   score:final(s)?s.score:null,breakdown:final(s)?s.breakdown:null,result:final(s)?s.result:null,liq:final(s)?s.liq:null,ranked:!!run.ranked,note:s.note};
 };
 return{START,PER,DAYS,LIQ_PCT,SCORE,P,PM,CAMPAIGN,build,fresh,apply,view,finance,scoreOf,costOf};
}
module.exports={createEngine,START,PER,DAYS,LIQ_PCT,SCORE,P,PM,CAMPAIGN,money};
