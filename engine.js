'use strict';
/* HAGGLE MARKET ARENA: game rules, money, scoring. Pure logic, no network or database.
   Every money value is a whole naira (integer). Rules are documented in docs/RULES.md. */
const crypto=require('crypto');
const START=20000,PER=10,PER_MIN=7,DAYS=7,LIQ_PCT=70; // PER = most shoppers in a day; the actual number (7 to 10) depends on weather and your reputation
const SCORE={PROFIT_FULL:45000,PROFIT_MAX:500,MARGIN_LOW:10,MARGIN_FULL:50,MARGIN_MAX:150,SAT_MAX:150,INV_MAX:100,CONS_MAX:100,TOTAL_MAX:1000};
const P=[{id:'tom',base:900,spoil:1},{id:'rice',base:2400},{id:'fab',base:1800},{id:'chg',base:700},{id:'noo',base:600},
 {id:'umb',base:1500},{id:'bts',base:2600},{id:'wat',base:500},{id:'drk',base:1600},{id:'fan',base:1200},{id:'crm',base:1100},{id:'bre',base:700,spoil:1}];
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
// Weather. dem = how much more or less often shoppers ask for a product; cost = what the wholesaler charges that morning (priced from the FORECAST); n = base shoppers for the day.
const WX={
 sun:{n:'Sunny',e:'☀️',cnt:10,dem:{wat:1.5,drk:1.5,fan:1.3,umb:.6,bts:.5},cost:{}},
 hot:{n:'Heatwave',e:'🥵',cnt:9,dem:{wat:1.9,drk:1.8,fan:1.8,crm:1.1,umb:.5,bts:.4},cost:{wat:1.1,drk:1.12,fan:1.1}},
 cloud:{n:'Cloudy',e:'⛅',cnt:9,dem:{},cost:{}},
 rain:{n:'Light rain',e:'🌦️',cnt:9,dem:{umb:1.9,bts:1.4,wat:.7,drk:.7,fan:.5},cost:{umb:1.15,bts:1.08}},
 storm:{n:'Heavy rain',e:'⛈️',cnt:8,dem:{umb:2.4,bts:2,wat:.5,drk:.6,fan:.4,fab:.8},cost:{umb:1.3,bts:1.2,tom:1.12}},
 harm:{n:'Harmattan (dry and dusty)',e:'🌫️',cnt:9,dem:{crm:2.3,fan:.4,umb:.3,bts:.3,wat:1.2},cost:{crm:1.2}}};
const SEASON={wet:{rain:30,storm:18,cloud:24,sun:20,hot:4,harm:0},dry:{sun:28,hot:20,harm:24,cloud:22,rain:4,storm:2}};
const FORECAST_RIGHT=.75;
const TIME_PER=1,TIME_EXTRA=5; // each day you have 1 time unit per expected shopper plus 5. A shopper arriving costs 1; each refused counter-offer costs 1. When time runs out, shoppers still waiting go elsewhere.
// Shopper personalities. The player is never told the type; they get a hint (a "tell") and learn to read it.
// pat = patience, open = opening offer as a share of their limit, soft = how far they move toward their limit when you say no, decay = their limit shrinks each time you waste their time.
const TYPES={
 hunter:{n:'Bargain hunter',pat:4,open:[.5,.62],soft:.22,mm:.86,sp:1,decay:0,od:-.05,w:26,tells:['"Your neighbour sells this cheaper, you know."','"I can find this anywhere for less."']},
 rush:{n:'Shopper in a hurry',pat:2,open:[.72,.85],soft:.5,mm:1,sp:1,decay:.06,od:.12,w:18,tells:['She keeps checking her watch.','"Quick, quick, I have a bus to catch."']},
 loyal:{n:'Regular customer',pat:3,open:[.68,.8],soft:.4,mm:1.04,sp:1,decay:0,od:.08,w:20,tells:['"My family has bought from this stall for years."','"I always come to you. Be fair to me."']},
 proud:{n:'Big spender',pat:2,open:[.62,.74],soft:.35,mm:1.25,sp:1,decay:0,od:.03,w:14,tells:['"I do not argue over small money, but do not insult me."','He is dressed very smartly and speaks slowly.']},
 sharp:{n:'Market expert',pat:3,open:[.6,.7],soft:.3,mm:.93,sp:.4,decay:0,od:0,w:22,tells:['"I know exactly what this costs you, my friend."','She squeezes the item and checks it carefully.']}};
const TYPE_IDS=Object.keys(TYPES);
const NAMES=['Aunty Ngozi','Mr Tunde','Madam Zainab','Chidi','Bisi','Oga Musa','Amaka','Kofi','Fatima','Mama Eniola','Segun','Wanjiru','Emeka','Hauwa','Tolu','Ife'];
const FACES=['👩🏾','👨🏿','🧕🏽','👨🏾','👩🏿','👴🏾','👩🏽','👨🏽'];
const mul=a=>()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
const zero=()=>Object.fromEntries(P.map(p=>[p.id,0]));
const money=n=>'₦'+String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const isInt=n=>Number.isInteger(n);
const r10=n=>Math.round(n/10)*10;
const wpick=(R,obj)=>{const ks=Object.keys(obj),tot=ks.reduce((a,k)=>a+obj[k],0);let r=R()*tot;for(const k of ks){if(r<obj[k])return k;r-=obj[k]}return ks[ks.length-1]};

function createEngine(secret){
 if(typeof secret!=='string'||secret.length<16)throw new Error('engine needs a secret of 16 or more characters');
 const seedOf=s=>parseInt(crypto.createHmac('sha256',secret).update(s).digest('hex').slice(0,8),16);
 // Reproducible: ranked markets use HMAC(secret, "haggle"+date); practice markets use the run id. Jitter is per run.
 function build(daily,day,runId){
  const R=mul(daily?seedOf('haggle'+day):seedOf('p'+runId)),J=mul(seedOf('j'+runId));
  const rnd=(a,b)=>a+R()*(b-a),pick=a=>a[Math.floor(R()*a.length)],out=[];
  const season=R()<.5?'wet':'dry';
  for(let d=0;d<DAYS;d++){
   const ev=CAMPAIGN[d],wx=wpick(R,SEASON[season]),fc=R()<FORECAST_RIGHT?wx:wpick(R,SEASON[season]);
   const W=WX[wx],F=WX[fc],cost={};
   P.forEach(p=>{cost[p.id]=Math.round(p.base*rnd(.92,1.08)*(ev.cost[p.id]||1)*(F.cost[p.id]||1))});
   // sel = how often shoppers ask for a product; pm = how much more they will pay (weather moves price only a little).
   const sel=P.map(p=>(ev.dem[p.id]||ev.dem.all||1)*(W.dem[p.id]||1));
   const pm=P.map(p=>(ev.dem[p.id]||ev.dem.all||1)*(1+((W.dem[p.id]||1)-1)*.3));
   const cs=[];
   for(let i=0;i<PER;i++){
    let r=R()*sel.reduce((a,b)=>a+b,0),k=0;while(k<sel.length-1&&r>sel[k]){r-=sel[k];k++}
    const p=P[k],type=wpick(R,Object.fromEntries(TYPE_IDS.map(t=>[t,TYPES[t].w]))),T=TYPES[type];
    const base=Math.round(p.base*1.6*(1+(rnd(.75,1.45)-1)*T.sp)*pm[k]);
    const max=Math.round(base*T.mm*(.94+J()*.12));
    const or=ev.offer?[ev.offer[0]+T.od,ev.offer[1]+T.od]:T.open;
    const offer=Math.round(max*rnd(or[0],or[1])),qty=R()<.25?2:1;
    // About 1 shopper in 7 bluffs: their hint belongs to a different personality.
    const tt=R()<.15?TYPE_IDS[Math.floor(R()*TYPE_IDS.length)]:type;
    cs.push({name:pick(NAMES),face:pick(FACES),p:p.id,max,offer,first:offer,type,qty,tell:pick(TYPES[tt].tells)});
   }
   out.push({ev:{t:ev.t,d:ev.d,obj:ev.obj},wx,fc,cost,cs});
  }
  return out;
 }
 // How many shoppers come today: the weather sets the base, a good reputation brings one more, a poor one costs one.
 const dayCount=s=>{const rep=s.sat.n?s.sat.sum/s.sat.n:70,adj=s.d>0?(rep>=80?1:rep<55?-1:0):0;return clamp(WX[s.sched[s.d].wx].cnt+adj,PER_MIN,PER)};
 const fresh=(daily,day,id)=>{const s={v:3,sched:build(daily,day,id),rs:seedOf('j'+id),step:0,d:0,n:0,phase:'stock',cash:START,stock:zero(),spent:zero(),bought:zero(),bt:zero(),ci:0,cur:null,res:null,
  log:[],hist:[],dayLog:[],dayAcc:{rev:0,cogs:0,sold:0,walked:0,miss:0,lost:0},acct:{rev:0,cogs:0,writeOff:0,unitsBought:0,unitsSold:0,spoiledUnits:0,tx:0},sat:{sum:0,n:0},
  sold:0,missed:0,walked:0,table:0,spoiled:0,score:0,breakdown:null,result:0,liq:0,note:'',spBuy:0,camp:null,sponsor:null,t0:Date.now(),last:0,time:0,timeMax:0};s.n=dayCount(s);s.timeMax=s.time=Math.round(s.n*TIME_PER+TIME_EXTRA);return s};
 // A sponsor price test changes only the wholesale price of the sponsored product, and only in practice games.
 const costOf=(s,id)=>{const b=s.sched[s.d].cost[id];return id==='noo'&&s.camp&&s.camp.mult?Math.round(b*s.camp.mult):b};
 const costMap=s=>Object.fromEntries(P.map(p=>[p.id,costOf(s,p.id)]));
 const unitCosts=s=>Object.fromEntries(P.map(p=>[p.id,s.stock[p.id]>0?Math.round(s.spent[p.id]/s.stock[p.id]):0]));
 const note=(s,k,p,q,amt,x)=>{s.hist.push(Object.assign({d:s.d+1,k,p,q,amt},x||{}));if(s.hist.length>400)s.hist.shift()};
 // What shoppers typically pay today, as a range. It is a guide only: individual shoppers vary a lot.
 function market(s){
  const day=s.sched[s.d],ev=CAMPAIGN[s.d],W=WX[s.phase==='stock'?day.fc:day.wx],out={};
  P.forEach(p=>{const m=(ev.dem[p.id]||ev.dem.all||1)*(1+((W.dem[p.id]||1)-1)*.3),mid=p.base*1.6*m;out[p.id]=[r10(mid*.85),r10(mid*1.3)]});
  return out;
 }
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
  if(s.ci>=s.n||s.time<=0)return endDay(s);
  s.time--;
  const c=s.sched[s.d].cs[s.ci++],T=TYPES[c.type],rep=s.sat.n?s.sat.sum/s.sat.n:70;
  // Regulars remember how you treated other shoppers: a good name lets them pay a little more, a poor one a little less.
  const max=c.type==='loyal'&&s.sat.n>=3?Math.round(c.max*(rep>=80?1.05:rep<55?.97:1)):c.max;
  s.cur=Object.assign({},c,{max,pat:T.pat,patMax:T.pat,said:''});s.res=null;
  if(s.stock[c.p]>0)s.phase='haggle';
  else{s.phase='nostock';s.missed++;s.dayAcc.miss++;s.sat.n++;s.log.push({p:c.p,miss:1});note(s,'nostock',c.p,0,0)}
  return null;
 }
 function sell(s,price,met){
  const c=s.cur,q=Math.min(c.qty,s.stock[c.p]);let cost=0;
  for(let i=0;i<q;i++){const cg=s.stock[c.p]===1?s.spent[c.p]:Math.round(s.spent[c.p]/s.stock[c.p]);s.spent[c.p]-=cg;s.stock[c.p]--;cost+=cg}
  const total=price*q;s.cash+=total;
  s.acct.rev+=total;s.acct.cogs+=cost;s.acct.unitsSold+=q;s.acct.tx++;
  s.dayAcc.rev+=total;s.dayAcc.cogs+=cost;s.dayAcc.sold+=q;s.sold+=q;s.table+=(c.max-price)*q;
  const sat=clamp(Math.round(50+125*(c.max-price)/c.max),50,100);s.sat.sum+=sat;s.sat.n++;
  s.log.push({p:c.p,price,first:c.first,max:c.max,gain:total-cost,qty:q});note(s,'sale',c.p,q,total,{cogs:cost});
  s.res={ok:1,price,qty:q,total,gain:total-cost,left:c.max-price,sat,kind:TYPES[c.type].n,met:met?1:0};s.phase='result';return null;
 }
 function walk(s,why){
  const c=s.cur;s.log.push({p:c.p,walk:1,first:c.first,max:c.max});s.walked++;s.dayAcc.walked++;s.sat.sum+=20;s.sat.n++;
  note(s,'walk',c.p,0,0);s.res={ok:0,max:c.max,kind:TYPES[c.type].n,why:why||''};s.phase='result';return null;
 }
 function endDay(s){
  let sp=0,wo=0;
  P.forEach(p=>{if(p.spoil&&s.stock[p.id]>0){const u=s.stock[p.id],v=s.spent[p.id];sp+=u;wo+=v;note(s,'spoil',p.id,u,v);s.stock[p.id]=0;s.spent[p.id]=0}});
  s.spoiled=sp;s.acct.writeOff+=wo;s.acct.spoiledUnits+=sp;
  s.dayLog.push({d:s.d+1,rev:s.dayAcc.rev,cogs:s.dayAcc.cogs,gross:s.dayAcc.rev-s.dayAcc.cogs,sold:s.dayAcc.sold,walked:s.dayAcc.walked,miss:s.dayAcc.miss,lost:Math.max(0,s.n-s.ci),writeOff:wo,wx:s.sched[s.d].wx,fc:s.sched[s.d].fc});
  s.dayAcc={rev:0,cogs:0,sold:0,walked:0,miss:0,lost:0};s.cur=null;s.res=null;
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
   const T=TYPES[c.type],pr=b.price;
   if(pr<=c.max&&pr<=c.offer)return sell(s,c.offer);      // you asked for less than they offered: they pay what they offered
   if(pr<=c.max)return sell(s,pr);                          // within their limit: sold at your price
   const over=(pr-c.max)/c.max;
   if(over<=.04)return sell(s,c.max,true);                  // a near miss: they stretch to meet you
   if(c.type==='proud'&&over>.12)return walk(s,'insulted'); // big spenders do not forgive being pushed
   s.time--;c.pat-=over>.3?2:1;
   if(T.decay)c.max=Math.max(c.offer,Math.round(c.max*(1-T.decay)));
   if(c.pat<=0)return walk(s);
   // Their next offer moves part of the way to their limit. How far is part chance, so the reply never gives the limit away.
   s.step++;const j=mul((s.rs+s.step*7919)>>>0)();
   const f=clamp(T.soft*(over>.12?.55:1)*(.6+.8*j),.08,.7);
   const next=Math.min(c.max,pr-1,Math.max(c.offer+10,c.offer+Math.round((c.max-c.offer)*f)));
   c.offer=Math.max(c.offer,next);
   c.said=over>.3?'That is far too high! My best is '+money(c.offer)+'.':'Hmm. My best is '+money(c.offer)+'.';return null;
  }
  if(t==='leave'){if(p!=='haggle')return'bad';return walk(s)}
  if(t==='next'){if(p!=='result'&&p!=='nostock')return'bad';return nextC(s)}
  if(t==='nextday'){if(p!=='dayend')return'bad';s.d++;s.phase='stock';s.bought=zero();s.cur=null;s.res=null;s.n=dayCount(s);s.timeMax=s.time=Math.round(s.n*TIME_PER+TIME_EXTRA);return null}
  return'bad';
 }
 const final=s=>s.phase==='final';
 const view=(s,run)=>{
  const c=s.cur,day=s.sched[s.d],open=s.phase!=='stock';
  return{runId:run.id,v:3,day:s.d+1,days:DAYS,per:s.n,cash:s.cash,phase:s.phase,ev:day.ev,cost:costMap(s),sponsor:s.sponsor||null,
   fc:day.fc,wx:open?day.wx:null,mk:market(s),time:s.time,timeMax:s.timeMax,
   stock:s.stock,basis:unitCosts(s),bought:s.bought,idx:s.ci,cur:c&&{name:c.name,face:c.face,p:c.p,offer:c.offer,pat:c.pat,patMax:c.patMax,said:c.said,tell:c.tell,qty:c.qty},
   res:s.res,log:s.log,fin:finance(s),hist:s.hist.slice(-40),dayLog:s.dayLog,spoiled:s.spoiled,table:s.table,sold:s.sold,missed:s.missed,walked:s.walked,
   score:final(s)?s.score:null,breakdown:final(s)?s.breakdown:null,result:final(s)?s.result:null,liq:final(s)?s.liq:null,ranked:!!run.ranked,note:s.note};
 };
 return{START,PER,PER_MIN,DAYS,LIQ_PCT,SCORE,P,PM,CAMPAIGN,WX,TYPES,FORECAST_RIGHT,TIME_PER,TIME_EXTRA,build,fresh,apply,view,finance,scoreOf,costOf,market,dayCount};
}
module.exports={createEngine,START,PER,PER_MIN,DAYS,LIQ_PCT,SCORE,P,PM,CAMPAIGN,WX,TYPES,FORECAST_RIGHT,money};
