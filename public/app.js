const DAYS=7,PER=8;
let S=null,LB=[],busy=false,msg='',counter=null,PROF=null,lbRange='today',lbCountry='',setup=false,confirmLoss=false,INS=null,RULES=null,draft=null,draftCc=null,lastKey='',LIVE=null,liveErr='',installEv=null;
const sp=P.find(x=>x.sp);
const signed=n=>(n<0?'\u2212':'')+N(Math.abs(n));
const bestScore=()=>{const b=get('haggle.best');return b===null?null:+b};
function sr(t){const e=$('#sr');e.textContent='';setTimeout(()=>{e.textContent=t},60)}
function setBusy(b){busy=b;const m=$('#main');m.classList.toggle('busy',b);m.setAttribute('aria-busy',String(b))}
// A sleeping or restarting server can be slow. Starting a game is safe to retry; a move is NOT (it could count twice).
async function withRetry(fn,tries){
 for(let i=0;;i++){
  try{return await fn()}
  catch(e){
   if((e.status&&e.status<500)||i>=tries-1)throw e;
   msg=T('Waking the game server. This can take up to a minute. Please wait...');render();
   await new Promise(r=>setTimeout(r,window.HAGGLE_RETRY_MS||7000));
  }
 }
}
async function recover(e){
 if(e.status===404||e.status===410){del('haggle.run');S=null;setup=false;return errText(e)}
 if(e.status===429)return T('Slow down a moment.');
 if(!e.status||e.status>=500){
  try{S=await api('run/start',{id:DEV,resume:S.runId});return T('Connection hiccup. Your game is safe. Please tap again.')}catch(x){return errText(e)}
 }
 return errText(e);
}
function announce(r){
 if(!r)return;
 sr(r.ok?T('Sold for {n}. {w} {g}.',{n:N(r.price),w:r.gain>=0?T('Profit'):T('Loss'),g:N(Math.abs(r.gain))}):T('The shopper walked away. No sale.'));
}
async function act(type,x){
 if(busy||!S)return;setBusy(true);msg='';
 try{
  S=await api('run/act',Object.assign({id:DEV,runId:S.runId,type},x));
  if(type!=='buy')announce(S.res);
  if(window.Radio){if(S.phase==='result'&&S.res)Radio.sfx(S.res.ok?'sale':'walk');else if(S.phase==='dayend'||S.phase==='final')Radio.sfx('day')}
  if(S.phase==='final'){del('haggle.run');const b=bestScore();if(b===null||S.score>b)put('haggle.best',S.score);tick();loadProfile()}
 }catch(e){msg=await recover(e)}
 setBusy(false);counter=null;confirmLoss=false;render();
}
async function start(daily){
 if(busy)return;
 const nm=$('#nm'),cs=$('#cc');
 draft=nm?nm.value.replace(/\s+/g,' ').trim():(get('haggle.name')||'');draftCc=cs?cs.value:(get('haggle.country')||'');
 const bad=nameProblem(draft);if(bad){msg=bad;render();return}
 if(draft)put('haggle.name',draft);else del('haggle.name');
 if(draftCc)put('haggle.country',draftCc);
 setBusy(true);msg='';
 try{S=await withRetry(()=>api('run/start',{id:DEV,name:draft,mode:daily?'daily':'practice',country:draftCc||'OTHER'}),6);put('haggle.run',S.runId);msg='';sr(T('Game started. Day 1 of {n}.',{n:DAYS}))}
 catch(e){msg=errText(e)}
 setBusy(false);render();
}
const invRows=()=>P.filter(p=>S.stock[p.id]>0).map(p=>S.stock[p.id]+' '+pname(p.id)).join(', ')||T('nothing');
const stat=(l,v)=>`<div class="metric"><dt>${l}</dt><dd>${v}</dd></div>`;
const errBox=()=>msg?`<p class="err" role="alert">${TH('Error: {m}',{m:msg})}</p>`:'';
// Shopper lines. The server sends only a code; the wording (and the Naija flavour) lives here.
const OPEN=['I will give you {n}.','How about {n}? Make we do am.','My budget is {n}, my friend.'];
const HIGH=['Too high! My best is {n}.','Abeg, reduce small. My best is {n}.','Ah! You want to finish me? {n} is my best.'];
const said=c=>{const L=c.said==='high'?HIGH:OPEN;return T(L[(c.name.length+(S.idx||0)+c.pat)%L.length],{n:N(c.offer)})};

function langBar(){return ''}
function landing(){return `<section class="card hero" aria-labelledby="h1">
<p class="eyebrow">HAGGLE MARKET ARENA</p>
<h1 id="h1" data-focus tabindex="-1">${T('Where Price Meets Strategy.')}</h1>
<p class="lead">${T('Buy smarter. Negotiate better. Protect your margins.')}</p>
<p>${T('Explore realistic market scenarios, test your decisions, and learn how pricing, profit, and customer relationships interact.')}</p>
<p class="quote">${T('Every price is a decision. Every decision has consequences.')}</p>
<div class="actions"><button class="btn" id="enter" type="button">${T('Enter the Arena')}</button><button class="btn alt" id="howbtn" type="button">${T('Explore How It Works')}</button></div>
<p class="hint">${T('Inspired by real Nigerian markets: naira, owambe, NEPA and fuel price wahala.')}</p>
<p class="hint">${T('This is a simulation. No real money changes hands, and results do not predict real markets.')}</p>
<p class="hint">${T('Built by Dolapo Oyatomi')}</p></section>${errBox()}`}
function setupHtml(){
 const nm=draft!==null?draft:(get('haggle.name')||''),cc=draftCc!==null?draftCc:(get('haggle.country')||'');
 return `<section class="card" aria-labelledby="sh">
<h2 id="sh" data-focus tabindex="-1">${T('Set up your stall')}</h2>
${PROF&&PROF.streak?`<p class="win">${T('{n}-day streak. Play today to keep it.',{n:PROF.streak})}</p>`:''}
<p>${TH('Your <b>simulated</b> starting balance is <b>{n}</b>. It is pretend money that exists only in this game.',{n:N(20000)})}</p>
<p class="warnbox">${T('Your display name, country and score appear on the public leaderboard. Do not use your real name, phone number or any personal details.')}</p>
<label for="nm">${T('Display name (3 to 20 characters)')}</label>
<input id="nm" type="text" maxlength="20" autocomplete="off" autocapitalize="words" spellcheck="false" value="${esc(nm)}" aria-describedby="nmh">
<p id="nmh" class="hint">${T('Letters, numbers, spaces, dots, underscores and hyphens. Names must be unique. Leave it blank for an automatic name.')}</p>
<label for="cc">${T('Country (optional, self-declared, for country leagues)')}</label>
<select id="cc"><option value="">${T('Prefer not to say')}</option>${Object.entries(CT).map(([k,v])=>`<option value="${k}"${cc===k?' selected':''}>${esc(T(v))}</option>`).join('')}</select>
${errBox()}
<button class="btn" id="go" type="button">${T("Start today's ranked market")}</button>
<button class="btn alt" id="prac" type="button">${T('Practice run (not ranked)')}</button>
<p class="hint">${T('One ranked run per day. Everyone gets the same market that day, so scores are comparable. Practice as much as you like.')}</p></section>`}
function stage(){
 const m=errBox();
 if(S.phase==='stock'){
  const w=WXI[S.wx.k]||WXI.sun,fav=S.wx.fav||[];
  const row=p=>`<li class="row"><div><span aria-hidden="true">${p.e}</span> <b>${esc(pname(p.id))}</b>${p.sp?` <span class="hint">(${esc(p.tag)})</span>`:''}${fav.includes(p.id)?` <span class="badge">${T('In demand')}</span>`:''}${p.f?` <span class="hint">${T('spoils overnight')}</span>`:''}<small class="hint">${T('{n} each, you hold {q}',{n:N(S.cost[p.id]),q:S.stock[p.id]})}</small></div>
<div class="qty"><button class="qb" type="button" data-b="${p.id}" data-d="-1" aria-label="${esc(T('Take back one {p}',{p:pname(p.id)}))}"${(S.bought[p.id]||0)?'':' disabled'}>\u2212</button><span aria-label="${esc(T('Bought today'))}">${S.bought[p.id]||0}</span><button class="qb" type="button" data-b="${p.id}" data-d="1" aria-label="${esc(T('Buy one {p}',{p:pname(p.id)}))}"${S.cash<S.cost[p.id]?' disabled':''}>+</button></div></li>`;
  return `<div class="card ev wx-${esc(S.wx.k)}"><p class="eyebrow">${T('Day {d} of {n}',{d:S.day,n:DAYS})}</p><h2 data-focus tabindex="-1">${esc(T(S.ev.t))}</h2><p>${esc(T(S.ev.d))}</p>
<p class="wx"><span aria-hidden="true">${w.e}</span> <b>${esc(T(w.n))}.</b> ${esc(T(w.h))}</p>
${fav.length?`<p>${TH('<b>Forecast:</b> likely to sell well today: {l}.',{l:fav.map(id=>((P.find(x=>x.id===id)||{}).e||'')+' '+pname(id)).join(', ')})}</p>`:''}
<p>${TH("<b>Today's objective:</b> {o}",{o:T(S.ev.obj)})}</p></div>
${S.note&&S.day===1?`<p class="hint">${esc(T(S.note))}</p>`:''}
<div class="card"><h3>${T('Buy stock')}</h3><p class="hint">${T('Cash: {n}. When the day ends, fresh goods spoil and are written off; other goods carry over.',{n:N(S.cash)})}</p>
${GROUPS.map(g=>`<h4 class="grp">${esc(T(g[1]))}</h4><ul class="list">${P.filter(p=>p.c===g[0]).map(row).join('')}</ul>`).join('')}
${m}<button class="btn" id="open" type="button">${T('Open the stall for the day')}</button></div>`;
 }
 if(S.phase==='nostock'){const c=S.cur;return `<div class="card"><div class="who"><span class="face" aria-hidden="true">${esc(c.face)}</span><div><h2 data-focus tabindex="-1">${esc(c.name)}</h2><p class="hint">${T('Customer {i} of {n}',{i:S.idx,n:PER})}</p></div></div><p class="said">\u201c${TH('Do you have {p}?',{p:pname(c.p)})}\u201d</p><p>${T('You are out of stock, so they leave. That counts against customer satisfaction.')}</p>${m}<button class="btn alt" id="nx" type="button">${T('Next customer')}</button></div>`}
 if(S.phase==='haggle'){
  const c=S.cur,unit=S.basis[c.p],profit=c.offer-unit,mg=c.offer>0?Math.round(1000*profit/c.offer)/10:0;
  const ref=Math.round(unit*1.6/10)*10,lo=c.offer,hi=Math.max(lo+100,Math.round(ref*1.9/10)*10);
  if(counter==null||counter<lo)counter=Math.min(Math.max(ref,lo),hi);
  const accLoss=c.offer<unit&&confirmLoss==='acc',ctrLoss=counter<unit&&confirmLoss==='ctr';
  return `<div class="card"><div class="who"><span class="face" aria-hidden="true">${esc(c.face)}</span><div><h2 data-focus tabindex="-1">${TH('{name} wants {item}',{name:c.name,item:pname(c.p)})}</h2><p class="hint">${T('Customer {i} of {n}. Patience: {p} of 3 left',{i:S.idx,n:PER,p:c.pat})}</p></div></div>
<p class="said">\u201c${esc(said(c))}\u201d</p>
<p class="hint">${T('Your cost for this item: about {n}. Selling below cost loses money.',{n:N(unit)})}</p>
<button class="btn" id="acc" type="button">${accLoss?T('Confirm: sell at a loss of {n}',{n:N(unit-c.offer)}):T('Accept {n}',{n:N(c.offer)})}</button>
<label for="rg">${T('Your counter-offer:')} <b id="cv">${N(counter)}</b></label>
<input id="rg" type="range" min="${lo}" max="${hi}" step="10" value="${counter}" aria-describedby="hlp">
<button class="btn alt" id="ctr" type="button">${ctrLoss?T('Confirm: counter below cost at {n}',{n:N(counter)}):T('Counter at {n}',{n:N(counter)})}</button>
<button class="btn alt" id="lg" type="button">${T('Let them go')}</button>${m}
<ul class="help" id="hlp"><li>${profit>=0?TH('<b>Accept:</b> you earn {g} on this unit ({m}% margin), and the shopper is satisfied.',{g:N(profit),m:mg}):TH('<b>Accept:</b> you lose {g} on this unit, and the shopper is satisfied.',{g:N(-profit)})}</li>
<li>${TH('<b>Counter:</b> if your price is within their limit the sale happens at your price. If it is above their limit, they lose patience ({p} left); at zero they walk away and you make no sale.',{p:c.pat})}</li>
<li>${TH('<b>Let them go:</b> no sale and no cost, but the shopper leaves unhappy.')}</li></ul></div>`;
 }
 if(S.phase==='result'){
  const r=S.res,c=S.cur;
  return r.ok?`<div class="card" role="status"><h2 data-focus tabindex="-1">${r.gain>=0?T('\u2713 Sold for {n}',{n:N(r.price)}):T('Sold at a loss for {n}',{n:N(r.price)})}</h2><p>${T(r.gain>=0?'Profit on this unit: {g}. Customer satisfaction: {s} out of 100.':'Loss on this unit: {g}. Customer satisfaction: {s} out of 100.',{g:N(Math.abs(r.gain)),s:r.sat})}</p><p>${r.left<=100?T('Near-perfect price: they could barely have paid more.'):TH('{name} would have paid up to {max}, so you left {left} on the table.',{name:c.name,max:N(r.price+r.left),left:N(r.left)})}</p>${m}<button class="btn" id="nx" type="button">${T('Next customer')}</button></div>`
  :`<div class="card" role="status"><h2 data-focus tabindex="-1">${T('\u2717 No sale: they walked away')}</h2><p>${TH('{name} would have paid up to {max}. Customer satisfaction for this shopper: 20 out of 100.',{name:c.name,max:N(r.max)})}</p>${m}<button class="btn" id="nx" type="button">${T('Next customer')}</button></div>`;
 }
 if(S.phase==='dayend'){
  const d=S.dayLog[S.dayLog.length-1];
  return `<div class="card"><h2 data-focus tabindex="-1">${T('Day {d} complete',{d:S.day})}</h2><dl class="metrics">${stat(T('Sales'),N(d.rev))}${stat(T('Cost of goods sold'),N(d.cogs))}${stat(T('Gross profit today'),signed(d.gross))}${stat(T('Units sold'),d.sold)}${stat(T('Walked away / no stock'),d.walked+' / '+d.miss)}${stat(T('Cash now'),N(S.cash))}</dl>
${S.spoiled?`<p class="lose">${T('Spoilage: {q} fresh items spoiled overnight and were written off.',{q:S.spoiled})}</p>`:''}
<p class="hint">${T("At the end of each day, fresh goods spoil, other stock carries over, and the day's results are recorded.")}</p><p>${TH('Still on the shelf: {l}.',{l:invRows()})}</p>${m}<button class="btn" id="nd" type="button">${T('Start day {d}',{d:S.day+1})}</button></div>`;
 }
 const b=S.breakdown,mx=(RULES&&RULES.score)||{PROFIT_MAX:500,MARGIN_MAX:150,SAT_MAX:150,INV_MAX:100,CONS_MAX:100};
 const parts=[['profit',T('Profit (leftover stock valued at {n}%)',{n:RULES?RULES.liqPct:70}),mx.PROFIT_MAX],['margin',T('Gross margin'),mx.MARGIN_MAX],['satisfaction',T('Customer satisfaction'),mx.SAT_MAX],['inventory',T('Stock management'),mx.INV_MAX],['consistency',T('Consistency'),mx.CONS_MAX]];
 const weak=parts.slice().sort((x,y)=>b.parts[x[0]]/x[2]-b.parts[y[0]]/y[2])[0];
 const TIPS={profit:'Profit was your weakest part. Look for sales closer to each shopper\'s limit, and avoid selling below cost.',margin:'Margin was your weakest part. Try countering above the first offer instead of accepting it.',satisfaction:'Customer satisfaction was your weakest part. Very high counters make shoppers walk away; fair prices keep them happy.',inventory:'Stock management was your weakest part. Fresh goods spoil overnight, and leftover stock on the last day loses value.',consistency:'Consistency was your weakest part. Aim for a profitable day, every day.'};
 return `<div class="card"><h2 data-focus tabindex="-1">${T('Campaign complete')}</h2><p class="big">${S.score} <span class="hint">${T('out of 1000 points')}</span></p>
<p>${TH('Result after valuing leftover stock at {l}: <b>{r}</b> (starting from a simulated {s}).',{l:N(S.liq),r:signed(S.result),s:N(20000)})}</p>
<div class="tw"><table><caption class="sr-only">${T('Score breakdown')}</caption><tr><th>${T('Part')}</th><th>${T('Points')}</th><th>${T('Out of')}</th></tr>${parts.map(x=>`<tr><td>${esc(x[1])}</td><td>${b.parts[x[0]]}</td><td>${x[2]}</td></tr>`).join('')}</table></div>
<p>${TH('<b>Next time:</b> {t}',{t:T(TIPS[weak[0]])})}</p>
<p class="hint">${S.ranked?T("Counted on today's leaderboard."):esc(T(S.note||'Practice run, not ranked.'))} ${T('Scores are calculated by the server.')}</p>${m}
<button class="btn" id="sh" type="button">${T('Share my score')}</button><button class="btn alt" id="again" type="button">${T('Play again (practice)')}</button></div>`;
}
const HL={buy:h=>T('Bought {q} {p} for {amt}',{q:h.q,p:pname(h.p),amt:N(h.amt)}),return:h=>T('Took back {q} {p} ({amt} returned)',{q:h.q,p:pname(h.p),amt:N(h.amt)}),sale:h=>T('Sold 1 {p} for {amt} (cost {c})',{p:pname(h.p),amt:N(h.amt),c:N(h.cogs)}),walk:h=>T('No sale: a {p} shopper walked away',{p:pname(h.p)}),nostock:h=>T('No sale: out of {p}',{p:pname(h.p)}),spoil:h=>T('{q} {p} spoiled overnight ({amt} written off)',{q:h.q,p:pname(h.p),amt:N(h.amt)})};
function renderDash(){
 const d=$('#dash');if(!S){d.hidden=true;return}
 const f=S.fin,done=S.phase==='final'?DAYS:(S.phase==='dayend'?S.day:S.day-1),hist=S.hist.slice(-12).reverse();
 d.hidden=false;
 d.innerHTML=`<div class="card"><h3>${T('Your business')}</h3><p class="hint">${T('Campaign: {d} of {n} days complete',{d:done,n:DAYS})}</p><p class="hint"><span aria-hidden="true">${(WXI[S.wx.k]||WXI.sun).e}</span> ${esc(T((WXI[S.wx.k]||WXI.sun).n))}</p><progress max="${DAYS}" value="${done}" aria-label="${esc(T('Campaign progress'))}">${done} / ${DAYS}</progress>
<dl class="metrics">${stat(T('Starting balance (simulated)'),N(f.start))}${stat(T('Cash'),N(f.cash))}${stat(T('Revenue'),N(f.rev))}${stat(T('Cost of goods sold'),N(f.cogs))}${stat(T('Gross profit'),signed(f.gross))}${stat(T('Gross margin'),f.margin===null?T('n/a (no sales yet)'):f.margin+'%')}${stat(T('Units purchased'),f.unitsBought)}${stat(T('Units sold'),f.unitsSold)}${stat(T('Stock on hand'),T('{u} units ({c} at cost)',{u:f.invUnits,c:N(f.invCost)}))}${stat(T('Spoilage written off'),N(f.writeOff))}${stat(T('Transactions'),f.tx)}${stat(T('Customer satisfaction'),f.satisfaction===null?T('n/a yet'):T('{s} out of 100',{s:f.satisfaction}))}</dl>
<p class="hint">${T('Gross profit is revenue minus the cost of the goods you sold. Rent and wages are not modelled.')}</p></div>
<div class="card"><h3>${T('Transaction history')}</h3>${hist.length?`<ul class="hist">${hist.map(h=>`<li>${esc(T('Day {d}: {l}',{d:h.d,l:HL[h.k]?HL[h.k](h):h.k}))}</li>`).join('')}</ul>`:`<p class="hint">${T('No transactions yet.')}</p>`}</div>`;
}
function render(){
 sp.n=S&&S.sponsor?S.sponsor.product:'Golden Crate noodles';sp.tag=S&&S.sponsor?T('Sponsored by {b}',{b:S.sponsor.brand}):T('sample sponsor');
 const ae=document.activeElement,sel=ae&&ae.id?'#'+ae.id:(ae&&ae.dataset&&ae.dataset.b?'[data-b="'+ae.dataset.b+'"][data-d="'+ae.dataset.d+'"]':null);
 const key=S?S.phase+'|'+S.day+'|'+S.idx:(setup?'setup':'landing');
 $('#arena').className='arena'+(S?' playing':'');
 if(S&&window.Radio)Radio.weather(S.wx.k);
 $('#stage').innerHTML=S?stage():(setup?setupHtml():landing());
 renderDash();wire();
 let el=null;if(key===lastKey&&sel)el=$('#stage '+sel);
 if(el&&!el.disabled)el.focus();else if(key!==lastKey){const h=$('#stage [data-focus]');if(h&&lastKey)h.focus()}
 lastKey=key;
}
function wire(){
 const on=(id,f)=>{const e=$('#'+id);if(e)e.onclick=f};
 on('enter',()=>{setup=true;render()});on('howbtn',()=>showTab('how'));
 const cs=$('#cc');if(cs)cs.onchange=()=>{if(get('haggle.cur'))return;const nm=$('#nm');draft=nm?nm.value:draft;draftCc=cs.value;setCur(CC_CUR[cs.value]||'NGN');renderAll()};
 on('go',()=>start(true));on('prac',()=>start(false));on('again',()=>start(false));
 document.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>act('buy',{pid:b.dataset.b,dir:+b.dataset.d}));
 on('open',()=>act('open'));on('nx',()=>act('next'));on('nd',()=>act('nextday'));on('lg',()=>act('leave'));
 on('acc',()=>{const c=S.cur;if(c.offer<S.basis[c.p]&&confirmLoss!=='acc'){confirmLoss='acc';render();return}act('accept')});
 on('ctr',()=>{const c=S.cur;if(counter<S.basis[c.p]&&confirmLoss!=='ctr'){confirmLoss='ctr';render();return}act('counter',{price:counter})});
 const rg=$('#rg');if(rg)rg.oninput=()=>{counter=+rg.value;confirmLoss=false;$('#cv').textContent=N(counter);$('#ctr').textContent=T('Counter at {n}',{n:N(counter)})};
 on('sh',async()=>{
  const t=T('I scored {s} out of 1000 in Haggle Market Arena. Can you beat me?',{s:S.score}),b=$('#sh');
  try{if(navigator.share){await navigator.share({title:'Haggle Market Arena',text:t,url:location.origin});return}}catch(e){if(e&&e.name==='AbortError')return}
  try{await navigator.clipboard.writeText(t+' '+location.origin);b.textContent=T('Copied')}catch(e){b.textContent=t}
 });
}
function renderLB(){
 const opt=Object.entries(CT).map(([k,v])=>`<option value="${k}"${k===lbCountry?' selected':''}>${esc(T(v))}</option>`).join('');
 let h=`<div class="card"><h2>${T('Leaders')}</h2><div class="ctl"><button class="chip" type="button" data-r="today" aria-pressed="${lbRange==='today'}">${T('Today')}</button><button class="chip" type="button" data-r="week" aria-pressed="${lbRange==='week'}">${T('This week')}</button></div>
<label for="lbc">${T('Country')}</label><select id="lbc"><option value="">${T('All countries')}</option>${opt}</select>`;
 h+=LB.length?`<div class="tw"><table><caption class="sr-only">${T('Leaderboard')}</caption><tr><th>${T('Rank')}</th><th>${T('Display name')}</th><th>${T('Score')}</th><th><span class="sr-only">${T('Report')}</span></th></tr>${LB.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(cleanName(r.name))}${r.country?` <span class="hint">${esc(r.country)}</span>`:''}</td><td>${r.daily||0}</td><td><button class="rep" type="button" data-ref="${esc(r.ref||'')}" aria-label="${esc(T('Report this name'))}">${T('Report')}</button></td></tr>`).join('')}</table></div>`:`<p>${T('No ranked scores here yet. Finish a ranked week to be first.')}</p>`;
 const b=bestScore();
 h+=(b!==null?`<p class="hint">${T('Your best on this device: {n} points.',{n:b})}</p>`:'')+`<details><summary>${T('How ranking works')}</summary><p>${T('Ranking uses your score out of 1000, calculated by the server from your decisions. It rewards profit, healthy margins, happy customers, careful stock and steady days, not revenue alone. Ties go to whoever finished first. The weekly board adds your ranked daily scores. Only one ranked run per day counts. See How it works for the formula.')}</p></details></div>`;
 $('#lead').innerHTML=h;
 document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{lbRange=c.dataset.r;tick()});
 $('#lbc').onchange=e=>{lbCountry=e.target.value;tick()};
 document.querySelectorAll('.rep[data-ref]').forEach(x=>x.onclick=async()=>{
  if(!confirm(T('Report this name as offensive or misleading?')))return;
  try{await api('report',{id:DEV,ref:x.dataset.ref});x.textContent=T('Reported');x.disabled=true}catch(e){x.textContent=e.status===403?T('Finish a week first'):T('Try later')}
 });
}
function renderIns(){
 let h=`<div class="card"><h2>${T('Market insights')}</h2><p class="warnbox">${T('Simulated activity. These numbers come from people playing a game. They are not real Nigerian market prices and do not represent any population.')}</p>`;
 if(!INS)h+=`<p>${T('Loading...')}</p>`;
 else if(INS.games<INS.min_games)h+=`<p>${T('Not enough finished games yet ({g} of {m} needed). Insights appear once enough games are finished, so no individual player can be picked out.',{g:INS.games,m:INS.min_games})}</p>`;
 else h+=`<p class="hint">${T('Based on {g} finished games. A product shows only after {m} shoppers.',{g:INS.games,m:INS.min_shoppers})}</p><div class="tw"><table><caption class="sr-only">${T('Simulated market insights by product')}</caption><tr><th>${T('Product')}</th><th>${T('Shoppers')}</th><th>${T('Popularity')}</th><th>${T('Sales accepted')}</th><th>${T('Walked away')}</th><th>${T('First offer')}</th><th>${T('Avg sale price')}</th><th>${T('Price vs first offer')}</th><th>${T('Turnover')}</th></tr>${INS.rows.map(x=>x.hidden?`<tr><td>${esc(pname(x.p))}</td><td colspan="8" class="hint">${T('Not enough shoppers yet')}</td></tr>`:`<tr><td>${esc(pname(x.p))}</td><td>${x.shoppers}</td><td>${x.popularity}%</td><td>${x.accept_rate}%</td><td>${x.walk_rate}%</td><td>${N(x.avg_first)}</td><td>${N(x.avg_price)}</td><td>${x.uplift===null?T('n/a'):(x.uplift>=0?'+':'')+x.uplift+'%'}</td><td>${x.turnover===null?T('n/a'):x.turnover+'x'}</td></tr>`).join('')}</table></div>`;
 $('#spon').innerHTML=h+`<p class="hint">${T("Turnover is units sold divided by units bought. Price vs first offer compares the average sale price with the shopper's opening offer.")}</p></div>`;
}
function renderHow(){
 const R=RULES;
 $('#how').innerHTML=`<div class="card"><h2>${T('How it works')}</h2><p class="quote">${T('Every price is a decision. Every decision has consequences.')}</p>
<p>${T('You run a market stall for {d} days, starting with a simulated {s}. Each morning you buy stock. Each afternoon {p} shoppers arrive. You can accept an offer, counter it, or let the shopper go. Every shopper has a hidden limit.',{d:DAYS,s:N(R?R.start:20000),p:R?R.perDay:PER})}</p>
<h3>${T('Weather and goods')}</h3><p>${T('Every day has its own weather and news. Rain sells umbrellas but keeps shoppers at home and makes fresh goods cost more. Heat sells fans, cold water and zobo. Harmattan sells shea butter. Power cuts sell torches and chargers. Read the forecast before you buy: stock that nobody wants is a loss.')}</p>
<h3>${T('The seven days')}</h3>${R?`<div class="tw"><table><caption class="sr-only">${T('The seven-day campaign')}</caption><tr><th>${T('Day')}</th><th>${T('Weather')}</th><th>${T('Situation')}</th><th>${T('Objective')}</th></tr>${R.campaign.map((c,i)=>{const w=WXI[c.wx]||WXI.sun;return `<tr><td>${i+1}</td><td><span aria-hidden="true">${w.e}</span> ${esc(T(w.n))}</td><td><b>${esc(T(c.t))}</b><br>${esc(T(c.d))}</td><td>${esc(T(c.obj))}</td></tr>`}).join('')}</table></div>`:`<p class="hint">${T('Rules could not be loaded. Check your connection.')}</p>`}
<h3>${T('Money, plainly')}</h3><ul><li>${TH('<b>Revenue</b> is what you take in from sales. It is not profit.')}</li><li>${TH('<b>Cost of goods sold</b> is what you paid for the units you sold.')}</li><li>${TH('<b>Gross profit</b> = revenue \u2212 cost of goods sold. Rent and wages are not modelled.')}</li><li>${TH('<b>Gross margin</b> = gross profit \u00f7 revenue \u00d7 100.')}</li><li>${TH('<b>Spoilage</b>: fresh goods that spoil overnight are written off.')}</li></ul>
<h3>${T('Customer satisfaction')}</h3><p>${T('A shopper who buys scores 50 to 100: the further your price is under their limit, the higher. A shopper who walks away scores 20. A shopper who finds you out of stock scores 0.')}</p>
<h3>${T('Score (out of {n})',{n:R?R.score.TOTAL_MAX:1000})}</h3>${R?`<ul><li>${TH('<b>Profit, up to {m}:</b> your result after valuing leftover stock at {l}% of cost, scaled so a result of {f} earns full points.',{m:R.score.PROFIT_MAX,l:R.liqPct,f:N(R.score.PROFIT_FULL)})}</li><li>${TH('<b>Gross margin, up to {m}:</b> {lo}% earns nothing, {hi}% or more earns full points.',{m:R.score.MARGIN_MAX,lo:R.score.MARGIN_LOW,hi:R.score.MARGIN_FULL})}</li><li>${TH('<b>Customer satisfaction, up to {m}:</b> your average satisfaction.',{m:R.score.SAT_MAX})}</li><li>${TH('<b>Stock management, up to {m}:</b> less spoilage and leftover loss. Full points need at least {s} sales.',{m:R.score.INV_MAX,s:R.score.INV_MIN_SALES})}</li><li>${TH('<b>Consistency, up to {m}:</b> days with sales and no gross loss.',{m:R.score.CONS_MAX})}</li></ul>`:''}
<p>${T('Revenue alone is not rewarded, and neither is the lowest price.')}</p>
<h3>${T('Fairness and limits')}</h3><ul><li>${T("The server runs every game and keeps shoppers' limits private.")}</li><li>${T('Ranked runs share the same market each day. Prices and shoppers are random but reproducible.')}</li><li>${T('This is a prototype simulation. Scores are not proof of real-world skill, and nothing here is financial advice.')}</li></ul>
<button class="btn" id="enter2" type="button">${T('Enter the Arena')}</button></div>`;
 const b=$('#enter2');if(b)b.onclick=()=>{setup=!S;showTab('play');render()};
}
async function loadRules(){if(RULES)return;try{RULES=await api('rules');renderHow()}catch(e){}}
async function loadIns(){try{INS=await api('insights')}catch(e){}renderIns()}
async function loadProfile(){try{PROF=await api('me/profile',{id:DEV});if(!S)render()}catch(e){}}
function renderLive(){
 $('#live').textContent=liveErr?T(liveErr):(LIVE?T('{a} playing now, {b} today, {c} players',{a:LIVE.playingNow,b:LIVE.today,c:LIVE.total}):'');
}
async function tick(){
 if(navigator.onLine===false){liveErr='You are offline. Your game is saved on the server.';renderLive();return}
 try{
  await api('ping',{id:DEV});
  LIVE=await api('stats');liveErr='';renderLive();
  LB=(await api('leaderboard?range='+lbRange+(lbCountry?'&country='+lbCountry:''))).rows;renderLB();
 }catch(e){liveErr=e.status===403?'This website is not allowed to reach the game server.':'Connecting to the game server... it may be waking up.';renderLive()}
}
function showTab(t){const b=document.querySelector('nav button[data-t="'+t+'"]');if(b)b.click()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('nav button').forEach(x=>{if(x===b)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
 ['play','lead','spon','how','inv'].forEach(id=>$('#'+id).hidden=id!==b.dataset.t);
 if(b.dataset.t==='inv'&&window.loadInv)loadInv();
 if(b.dataset.t==='spon')loadIns();
 if(b.dataset.t==='how')loadRules();
});
$('#rst').onclick=()=>{if(confirm(T('Reset saved data on this device? Your records on our server are not deleted.'))){resetLocal();location.reload()}};
$('#del').onclick=async()=>{
 if(!confirm(T('Delete your game data and leaderboard entries from our server, and reset this device? This cannot be undone.')))return;
 try{await api('me/delete',{id:DEV});resetLocal();location.reload()}catch(e){alert(T('Could not delete right now. Please try again.'))}
};
// Language: remembered on this device. Every screen is redrawn in place.
function renderAll(){applyStatic();$('#cur').value=CURR;render();renderLB();renderIns();renderHow();renderLive();if(window.Radio)Radio.draw()}
$('#lang').onchange=e=>{setLang(e.target.value);renderAll()};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e;$('#inst').hidden=false});
$('#inst').onclick=async()=>{if(!installEv)return;installEv.prompt();try{await installEv.userChoice}catch(x){}installEv=null;$('#inst').hidden=true};
window.addEventListener('online',tick);window.addEventListener('offline',tick);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
if(location.hash==='#owner'){$('#invb').hidden=false;const o=document.createElement('script');o.src='owner.js';document.head.appendChild(o)}
function initCur(){const c=get('haggle.cur');setCur(c&&CUR[c]?c:(CC_CUR[get('haggle.country')]||'NGN'))}
$('#cur').innerHTML=Object.keys(CUR).map(c=>`<option value="${c}">${esc(CUR[c].s.trim())} ${c}</option>`).join('');
$('#cur').onchange=e=>{setCur(e.target.value,true);renderAll()};
initLang();initCur();renderAll();tick();setInterval(()=>{if(!document.hidden)tick()},30000);
(async()=>{
 const rid=get('haggle.run');
 if(rid){try{const v=await api('run/start',{id:DEV,resume:rid});if(v.phase!=='final')S=v;else del('haggle.run')}catch(e){del('haggle.run')}}
 render();loadProfile();loadRules();
})();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
