const DAYS=7;
ERR['no run']='That game was not found. Please start a new one.';ERR.gone=ERR['no run'];
let S=null,LB=[],busy=false,msg='',counter=null,PROF=null,lbRange='today',lbCountry='',setup=false,confirmLoss=false,INS=null,RULES=null,draft=null,draftCc=null,lastKey='',acctMsg='',acctUser='',acctNote='',acctEmail='',acctMode='main';
const sp=P.find(x=>x.sp);
const signed=n=>(n<0?'\u2212':'')+N(Math.abs(n));
const bestScore=()=>{const b=get('haggle.best');return b===null?null:+b};
function sr(t){const e=$('#sr');e.textContent='';setTimeout(()=>{e.textContent=t},60)}
function setBusy(b){busy=b;const m=$('#main');m.classList.toggle('busy',b);m.setAttribute('aria-busy',String(b))}
// The free server sleeps when quiet. Starting a game is safe to retry; a move is NOT (it could count twice).
async function withRetry(fn,tries){
 for(let i=0;;i++){
  try{return await fn()}
  catch(e){
   if((e.status&&e.status<500)||i>=tries-1)throw e;
   msg='Waking the game server. This can take up to a minute. Please wait...';render();
   await new Promise(r=>setTimeout(r,window.HAGGLE_RETRY_MS||7000));
  }
 }
}
async function recover(e){
 if(e.message==='sign_in'){S=null;setup=true;return errText(e)}
 if(e.status===404||e.status===410){del('haggle.run');S=null;setup=false;return errText(e)}
 if(e.status===429)return 'Slow down a moment.';
 if(!e.status||e.status>=500){
  try{S=await api('run/start',{id:DEV,resume:S.runId});return 'Connection hiccup. Your game is safe. Please tap again.'}catch(x){return errText(e)}
 }
 return errText(e);
}
function announce(r){
 if(!r)return;
 sr(r.ok?'Sold for '+N(r.price)+'. '+(r.gain>=0?'Profit ':'Loss ')+N(Math.abs(r.gain))+'.':'The shopper walked away. No sale.');
}
async function act(type,x){
 if(busy||!S)return;setBusy(true);msg='';
 try{
  S=await api('run/act',Object.assign({id:DEV,runId:S.runId,type},x));
  if(type!=='buy')announce(S.res);
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
 try{S=await withRetry(()=>api('run/start',{id:DEV,name:draft,mode:daily?'daily':'practice',country:draftCc||'OTHER'}),6);put('haggle.run',S.runId);msg='';sr('Game started. Day 1 of '+DAYS+'.')}
 catch(e){msg=errText(e)}
 setBusy(false);render();
}
const invRows=()=>P.filter(p=>S.stock[p.id]>0).map(p=>S.stock[p.id]+' '+p.n).join(', ')||'nothing';
const stat=(l,v)=>`<div class="metric"><dt>${l}</dt><dd>${v}</dd></div>`;
const errBox=()=>msg?`<p class="err" role="alert">Error: ${esc(msg)}</p>`:'';

function landing(){return `<section class="card hero" aria-labelledby="h1">
<p class="eyebrow">HAGGLE MARKET ARENA</p>
<h1 id="h1" data-focus tabindex="-1">Where Price Meets Strategy.</h1>
<p class="lead">Buy smarter. Negotiate better. Protect your margins.</p>
<p>Explore realistic market scenarios, test your decisions, and learn how pricing, profit, and customer relationships interact.</p>
<p class="quote">Every price is a decision. Every decision has consequences.</p>
<div class="actions"><button class="btn" id="enter" type="button">Enter the Arena</button><button class="btn alt" id="howbtn" type="button">Explore How It Works</button></div>
<p class="hint">This is a simulation. No real money changes hands, and results do not predict real markets.</p>
<p class="hint">Built by Dolapo Oyatomi</p></section>${errBox()}`}
function acctHtml(){
 const u=get('haggle.user'),ver=get('haggle.ver')==='1';
 const err=acctMsg?`<p class="err" role="alert">Error: ${esc(acctMsg)}</p>`:'',note=acctNote?`<p class="hint" role="status">${esc(acctNote)}</p>`:'';
 if(SESS&&u&&ver)return `<div class="card" role="group" aria-label="Account"><p>Signed in as <b>${esc(u)}</b>. Email verified. Ranked play is on.</p>${note}<button class="btn alt" id="sout" type="button">Sign out</button></div>`;
 if(SESS&&u)return `<div class="card" role="group" aria-labelledby="vh"><h3 id="vh">Verify your email to play ranked</h3>
<p class="hint">We sent a 6-digit code to ${esc((PROF&&PROF.email)||'your email address')}. It expires in 15 minutes. Check your spam folder too.</p>
<label for="vc">6-digit code</label><input id="vc" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7">
${err}${note}<button class="btn" id="vgo" type="button">Verify</button><button class="btn alt" id="vre" type="button">Send a new code</button><button class="btn alt" id="sout" type="button">Sign out</button></div>`;
 if(acctMode==='reset')return `<div class="card" role="group" aria-labelledby="rh"><h3 id="rh">Reset your password</h3>
<p class="hint">Enter the email you verified. We will email a 6-digit code. Resetting signs you out everywhere.</p>
<label for="re">Email</label><input id="re" type="email" maxlength="254" autocomplete="email" value="${esc(acctEmail)}">
<label for="rc">6-digit code</label><input id="rc" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7">
<label for="rp">New password (10 or more characters)</label><input id="rp" type="password" maxlength="128" autocomplete="new-password">
${err}${note}<button class="btn alt" id="rsend" type="button">Email me a code</button><button class="btn" id="rgo" type="button">Set new password</button><button class="btn alt" id="rback" type="button">Back</button></div>`;
 return `<div class="card" role="group" aria-labelledby="ah"><h3 id="ah">Account (needed for ranked play)</h3>
<p class="hint">Practice runs work without one. An account stops other people playing as you, and your email lets you reset a forgotten password. We never show your email to other players.</p>
<label for="au">Username (private, used only to sign in)</label><input id="au" type="text" maxlength="20" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(acctUser)}">
<label for="ae">Email (needed to create an account)</label><input id="ae" type="email" maxlength="254" autocomplete="email" value="${esc(acctEmail)}">
<label for="ap">Password (10 or more characters)</label><input id="ap" type="password" maxlength="128" autocomplete="current-password">
${err}${note}<button class="btn" id="sin" type="button">Sign in</button><button class="btn alt" id="reg" type="button">Create account</button><button class="btn alt" id="forgot" type="button">Forgot password</button></div>`}
const keepForm=()=>{acctUser=(($('#au')||{}).value||acctUser).trim();acctEmail=(($('#ae')||$('#re')||{}).value||acctEmail).trim()};
async function authCall(kind){
 if(busy)return;
 const u=(($('#au')||{}).value||'').trim(),p=($('#ap')||{}).value||'',em=(($('#ae')||{}).value||'').trim();acctUser=u;acctEmail=em;acctMsg='';acctNote='';
 setBusy(true);
 try{
  const j=await api(kind==='reg'?'auth/register':'auth/login',kind==='reg'?{id:DEV,username:u,password:p,email:em}:{username:u,password:p});
  SESS=j.token;put('haggle.sess',j.token);put('haggle.user',j.username);put('haggle.ver',j.verified?'1':'0');acctUser='';acctEmail='';
  if(kind==='reg')acctNote=j.emailSent?'Account created. We emailed you a 6-digit code.':'Account created, but we could not send the email. Tap "Send a new code".';
  if(j.id!==DEV){DEV=j.id;put('haggle.dev',DEV);if(!get('haggle.run'))S=null}   // signing in on a new device: continue as that account's player
  const rid=get('haggle.run');
  if(rid&&!S){try{const v=await api('run/start',{id:DEV,resume:rid});if(v.phase!=='final')S=v;else del('haggle.run')}catch(e){if(e.message!=='sign_in')del('haggle.run')}}
  PROF=null;loadProfile();sr('Signed in as '+j.username+'.');
 }catch(e){acctMsg=errText(e)}
 setBusy(false);render();
}
async function verifyCall(){
 if(busy)return;const c=(($('#vc')||{}).value||'').trim();acctMsg='';acctNote='';setBusy(true);
 try{await api('auth/verify',{code:c});put('haggle.ver','1');acctNote='Email verified. Ranked play is on.';PROF=null;loadProfile();sr('Email verified.')}catch(e){acctMsg=errText(e)}
 setBusy(false);render();
}
async function resendCall(){
 if(busy)return;acctMsg='';acctNote='';setBusy(true);
 try{await api('auth/resend',{});acctNote='A new code is on its way.'}catch(e){acctMsg=errText(e)}
 setBusy(false);render();
}
async function resetCall(step){
 if(busy)return;keepForm();acctMsg='';acctNote='';setBusy(true);
 try{
  if(step==='send'){await api('auth/reset-request',{email:acctEmail});acctNote='If that address has a verified account, a code is on its way. It expires in 15 minutes.'}
  else{await api('auth/reset',{email:acctEmail,code:(($('#rc')||{}).value||'').trim(),password:($('#rp')||{}).value||''});acctMode='main';acctNote='Password changed. Please sign in with the new one.'}
 }catch(e){acctMsg=errText(e)}
 setBusy(false);render();
}
async function signOut(){
 try{await api('auth/logout',{})}catch(e){}
 // The old device ID now belongs to the account, so this browser starts again as a new anonymous player.
 SESS=null;del('haggle.sess');del('haggle.user');del('haggle.ver');DEV=newDevId();put('haggle.dev',DEV);del('haggle.run');S=null;PROF=null;acctNote='';acctMsg='';acctMode='main';sr('Signed out.');render();
}
function setupHtml(){
 const nm=draft!==null?draft:(get('haggle.name')||''),cc=draftCc!==null?draftCc:(get('haggle.country')||'');
 return `<section class="card" aria-labelledby="sh">
<h2 id="sh" data-focus tabindex="-1">Set up your stall</h2>
${PROF&&PROF.streak?`<p class="win">${PROF.streak}-day streak. Play today to keep it.</p>`:''}
<p>Your <b>simulated</b> starting balance is <b>${N(20000)}</b>. It is pretend money that exists only in this game.</p>
<p class="warnbox">Your display name, country and score appear on the public leaderboard. Do not use your real name, phone number or any personal details.</p>
${acctHtml()}
<label for="nm">Display name (3 to 20 characters)</label>
<input id="nm" type="text" maxlength="20" autocomplete="off" value="${esc(nm)}" aria-describedby="nmh">
<p id="nmh" class="hint">Letters, numbers, spaces, dots, underscores and hyphens. Names must be unique. Leave it blank for an automatic name.</p>
<label for="cc">Country (optional, self-declared, for country leagues)</label>
<select id="cc"><option value="">Prefer not to say</option>${Object.entries(CT).map(([k,v])=>`<option value="${k}"${cc===k?' selected':''}>${v}</option>`).join('')}</select>
<label for="cu">Show money in (display only; the game and scores stay in naira)</label><select id="cu">${Object.entries(CUR).map(([k,v])=>`<option value="${k}"${CURRENCY===k?' selected':''}>${esc(v.n)} (${esc(v.s.trim())})</option>`).join('')}</select><p class="hint">Rates are rough fixed game rates, not live prices.</p>
${errBox()}
<button class="btn" id="go" type="button">Start today's ranked market</button>
<button class="btn alt" id="prac" type="button">Practice run (not ranked)</button>
<p class="hint">One ranked run per day, for signed-in players. Everyone gets the same market that day, so scores are comparable. Practice as much as you like.</p></section>`}
const wxOf=k=>WXC[k]||{n:String(k),e:''};
const wxCard=()=>{const f=wxOf(S.fc);return `<div class="card wx"><p class="eyebrow">Weather forecast</p><p class="lead"><span aria-hidden="true">${f.e}</span> ${esc(f.n)} expected this afternoon</p>
<p class="hint">Forecasts are right about 3 days in 4. Wholesale prices this morning already reflect the forecast, but shoppers react to the real weather. Expect about ${S.per} shoppers. You have <b>${S.timeMax}</b> selling time units: each shopper uses 1 and each refused counter-offer uses 1. When time runs out, waiting shoppers go to another stall.</p></div>`};
const bandOf=id=>S.mk&&S.mk[id]?S.mk[id]:null;
function stage(){
 const m=errBox();
 if(S.phase==='stock'){
  return `<div class="card ev"><p class="eyebrow">Day ${S.day} of ${DAYS}</p><h2 data-focus tabindex="-1">${esc(S.ev.t)}</h2><p>${esc(S.ev.d)}</p><p><b>Today's objective:</b> ${esc(S.ev.obj)}</p></div>
${wxCard()}
${S.note&&S.day===1?`<p class="hint">${esc(cvt(S.note))}</p>`:''}
<div class="card"><h3>Buy stock</h3><p class="hint">Cash: ${N(S.cash)}. When the day ends, fresh goods (tomatoes and bread) spoil and are written off; other goods carry over. Some goods sell far better in certain weather.</p>
<ul class="list">${P.map(p=>`<li class="row"><div><span aria-hidden="true">${p.e}</span> <b>${esc(p.n)}</b>${p.sp?` <span class="hint">(${esc(p.tag)})</span>`:''}${p.sl?' <span class="hint">(spoils overnight)</span>':''}<small class="hint">${N(S.cost[p.id])} each, you hold ${S.stock[p.id]}${bandOf(p.id)?'. Shoppers usually pay about '+N(bandOf(p.id)[0])+' to '+N(bandOf(p.id)[1]):''}</small></div>
<div class="qty"><button class="qb" type="button" data-b="${p.id}" data-d="-1" aria-label="Take back one ${esc(p.n)}"${(S.bought[p.id]||0)?'':' disabled'}>\u2212</button><span aria-label="Bought today">${S.bought[p.id]||0}</span><button class="qb" type="button" data-b="${p.id}" data-d="1" aria-label="Buy one ${esc(p.n)}"${S.cash<S.cost[p.id]?' disabled':''}>+</button></div></li>`).join('')}</ul>
${m}<button class="btn" id="open" type="button">Open the stall for the day</button></div>`;
 }
 if(S.phase==='nostock'){const c=S.cur;return `<div class="card"><div class="who"><span class="face" aria-hidden="true">${esc(c.face)}</span><div><h2 data-focus tabindex="-1">${esc(c.name)}</h2><p class="hint">Shopper ${S.idx} of up to ${S.per}. Time left today: ${S.time}</p></div></div><p class="said">\u201cDo you have ${esc(pname(c.p))}?\u201d</p><p>You are out of stock, so they leave. That counts against customer satisfaction.</p>${m}<button class="btn alt" id="nx" type="button">Next customer</button></div>`}
 if(S.phase==='haggle'){
  const c=S.cur,p=P.find(x=>x.id===c.p),unit=S.basis[c.p],profit=c.offer-unit,mg=c.offer>0?Math.round(1000*profit/c.offer)/10:0;
  const bd=bandOf(c.p)||[Math.round(unit*1.3),Math.round(unit*2.2)],ref=Math.round((bd[0]+bd[1])/2*1.05/10)*10,lo=c.offer,hi=Math.max(lo+100,Math.round(bd[1]*1.5/10)*10);
  if(counter==null||counter<lo)counter=Math.min(Math.max(ref,lo),hi);
  const accLoss=c.offer<unit&&confirmLoss==='acc',ctrLoss=counter<unit&&confirmLoss==='ctr';
  return `<div class="card"><div class="who"><span class="face" aria-hidden="true">${esc(c.face)}</span><div><h2 data-focus tabindex="-1">${esc(c.name)} wants ${esc(p.n)}</h2><p class="hint">Shopper ${S.idx} of up to ${S.per}. Patience: ${c.pat} of ${c.patMax} left</p></div></div>
<p class="hint"><span aria-hidden="true">${wxOf(S.wx).e}</span> ${esc(wxOf(S.wx).n)}. Selling time left today: <b>${S.time}</b> of ${S.timeMax}</p>
<p class="said">\u201c${esc(cvt(c.said||'I will give you '+N(c.offer)+'.'))}\u201d</p>
<p class="tell"><span class="sr-only">What you notice: </span>${esc(c.tell)}</p>${c.qty>1?`<p><b>Wants ${c.qty} units.</b> You hold ${S.stock[c.p]}${S.stock[c.p]<c.qty?', so you can only sell '+S.stock[c.p]:''}. Prices below are per unit.</p>`:''}
<p class="hint">Your cost for this item: about ${N(unit)} each. Today shoppers usually pay about ${N(bd[0])} to ${N(bd[1])} for ${esc(p.n)}. Selling below cost loses money.</p>
<button class="btn" id="acc" type="button">${accLoss?'Confirm: sell at a loss of '+N(unit-c.offer):'Accept '+N(c.offer)}</button>
<label for="rg">Your counter-offer: <b id="cv">${N(counter)}</b></label>
<input id="rg" type="range" min="${lo}" max="${hi}" step="10" value="${counter}" aria-describedby="hlp">
<button class="btn alt" id="ctr" type="button">${ctrLoss?'Confirm: counter below cost at '+N(counter):'Counter at '+N(counter)}</button>
<button class="btn alt" id="lg" type="button">Let them go</button>${m}
<ul class="help" id="hlp"><li><b>Accept:</b> ${profit>=0?'you earn '+N(profit)+' on this unit ('+mg+'% margin)':'you lose '+N(-profit)+' on this unit'}, and the shopper is satisfied.</li>
<li><b>Counter:</b> if your price is within their limit the sale happens at your price. A little over (about 4%) and they may stretch to meet you. Further over, they lose patience (${c.pat} left) and the refused offer uses 1 selling time. At zero patience they walk away. Hints about the shopper are usually, but not always, true.</li>
<li><b>Let them go:</b> no sale and no cost, but the shopper leaves unhappy.</li></ul></div>`;
 }
 if(S.phase==='result'){
  const r=S.res,c=S.cur,why=r.kind?`<p class="hint">This shopper was a <b>${esc(r.kind)}</b>. Compare it with the hint you saw: "${esc(c.tell)}"</p>`:'';
  return r.ok?`<div class="card" role="status"><h2 data-focus tabindex="-1">${r.gain>=0?'\u2713 Sold':'Sold at a loss'} ${r.qty>1?r.qty+' units at '+N(r.price)+' each':'for '+N(r.price)}</h2><p>${r.gain>=0?'Profit':'Loss'} on this sale: ${N(Math.abs(r.gain))}. Customer satisfaction: ${r.sat} out of 100.${r.met?' They stretched to meet your price.':''}</p><p>${r.left<=100?'Near-perfect price: they could barely have paid more.':esc(c.name)+' would have paid up to '+N(r.price+r.left)+' each, so you left '+N(r.left)+' each on the table.'}</p>${why}${m}<button class="btn" id="nx" type="button">Next customer</button></div>`
  :`<div class="card" role="status"><h2 data-focus tabindex="-1">\u2717 No sale: ${r.why==='insulted'?'they felt insulted and left':'they walked away'}</h2><p>${esc(c.name)} would have paid up to ${N(r.max)} each. Customer satisfaction for this shopper: 20 out of 100.</p>${why}${m}<button class="btn" id="nx" type="button">Next customer</button></div>`;
 }
 if(S.phase==='dayend'){
  const d=S.dayLog[S.dayLog.length-1];
  return `<div class="card"><h2 data-focus tabindex="-1">Day ${S.day} complete</h2><dl class="metrics">${stat('Sales',N(d.rev))}${stat('Cost of goods sold',N(d.cogs))}${stat('Gross profit today',signed(d.gross))}${stat('Units sold',d.sold)}${stat('Walked away / no stock',d.walked+' / '+d.miss)}${stat('Cash now',N(S.cash))}</dl>
${S.spoiled?`<p class="lose">Spoilage: ${S.spoiled} fresh items (tomatoes or bread) spoiled overnight and were written off.</p>`:''}
<p class="hint">Weather today: ${wxOf(d.wx).e} ${esc(wxOf(d.wx).n)} (forecast was ${esc(wxOf(d.fc).n)}).${d.lost>0?' '+d.lost+' shoppers went to another stall because time ran out.':''} At the end of each day, fresh goods spoil, other stock carries over, and the day's results are recorded.</p><p>Still on the shelf: ${esc(invRows())}.</p>${m}<button class="btn" id="nd" type="button">Start day ${S.day+1}</button></div>`;
 }
 const b=S.breakdown,mx=(RULES&&RULES.score)||{PROFIT_MAX:500,MARGIN_MAX:150,SAT_MAX:150,INV_MAX:100,CONS_MAX:100};
 const parts=[['profit','Profit (leftover stock valued at '+(RULES?RULES.liqPct:70)+'%)',mx.PROFIT_MAX],['margin','Gross margin',mx.MARGIN_MAX],['satisfaction','Customer satisfaction',mx.SAT_MAX],['inventory','Stock management',mx.INV_MAX],['consistency','Consistency',mx.CONS_MAX]];
 const weak=parts.slice().sort((x,y)=>b.parts[x[0]]/x[2]-b.parts[y[0]]/y[2])[0];
 const TIPS={profit:'Profit was your weakest part. Look for sales closer to each shopper\'s limit, and avoid selling below cost.',margin:'Margin was your weakest part. Try countering above the first offer instead of accepting it.',satisfaction:'Customer satisfaction was your weakest part. Very high counters make shoppers walk away; fair prices keep them happy.',inventory:'Stock management was your weakest part. Tomatoes spoil overnight, and leftover stock on the last day loses value.',consistency:'Consistency was your weakest part. Aim for a profitable day, every day.'};
 return `<div class="card"><h2 data-focus tabindex="-1">Campaign complete</h2><p class="big">${S.score} <span class="hint">out of 1000 points</span></p>
<p>Result after valuing leftover stock at ${N(S.liq)}: <b>${signed(S.result)}</b> (starting from a simulated ${N(20000)}).</p>
<div class="tw"><table><caption class="sr-only">Score breakdown</caption><tr><th>Part</th><th>Points</th><th>Out of</th></tr>${parts.map(x=>`<tr><td>${x[1]}</td><td>${b.parts[x[0]]}</td><td>${x[2]}</td></tr>`).join('')}</table></div>
<p><b>Next time:</b> ${TIPS[weak[0]]}</p>
<p class="hint">${S.ranked?'Counted on today\'s leaderboard.':esc(S.note||'Practice run, not ranked.')} Scores are calculated by the server.</p>${m}
<button class="btn" id="sh" type="button">Copy my score to share</button><button class="btn alt" id="again" type="button">Play again (practice)</button></div>`;
}
const HL={buy:h=>`Bought ${h.q} ${pname(h.p)} for ${N(h.amt)}`,return:h=>`Took back ${h.q} ${pname(h.p)} (${N(h.amt)} returned)`,sale:h=>`Sold ${h.q} ${pname(h.p)} for ${N(h.amt)} (cost ${N(h.cogs)})`,walk:h=>`No sale: a ${pname(h.p)} shopper walked away`,nostock:h=>`No sale: out of ${pname(h.p)}`,spoil:h=>`${h.q} ${pname(h.p)} spoiled overnight (${N(h.amt)} written off)`};
function renderDash(){
 const d=$('#dash');if(!S){d.hidden=true;return}
 const f=S.fin,done=S.phase==='final'?DAYS:(S.phase==='dayend'?S.day:S.day-1),hist=S.hist.slice(-12).reverse();
 d.hidden=false;
 d.innerHTML=`<div class="card"><h3>Your business</h3><p class="hint">Campaign: ${done} of ${DAYS} days complete</p><progress max="${DAYS}" value="${done}" aria-label="Campaign progress">${done} of ${DAYS}</progress>
<dl class="metrics">${stat('Starting balance (simulated)',N(f.start))}${stat('Cash',N(f.cash))}${stat('Revenue',N(f.rev))}${stat('Cost of goods sold',N(f.cogs))}${stat('Gross profit',signed(f.gross))}${stat('Gross margin',f.margin===null?'n/a (no sales yet)':f.margin+'%')}${stat('Units purchased',f.unitsBought)}${stat('Units sold',f.unitsSold)}${stat('Stock on hand',f.invUnits+' units ('+N(f.invCost)+' at cost)')}${stat('Spoilage written off',N(f.writeOff))}${stat('Transactions',f.tx)}${stat('Customer satisfaction',f.satisfaction===null?'n/a yet':f.satisfaction+' out of 100')}</dl>
<p class="hint">Gross profit is revenue minus the cost of the goods you sold. Rent and wages are not modelled.</p></div>
<div class="card"><h3>Transaction history</h3>${hist.length?`<ul class="hist">${hist.map(h=>`<li>Day ${h.d}: ${HL[h.k]?HL[h.k](h):esc(h.k)}</li>`).join('')}</ul>`:'<p class="hint">No transactions yet.</p>'}</div>`;
}
function render(){
 document.body.dataset.wx=S?(S.wx||S.fc||''):'';
 if(S&&(S.wx||S.fc))window.dispatchEvent(new CustomEvent('haggle:wx',{detail:S.wx||S.fc}));
 sp.n=S&&S.sponsor?S.sponsor.product:'Golden Crate noodles';sp.tag=S&&S.sponsor?'Sponsored by '+S.sponsor.brand:'sample sponsor';
 const ae=document.activeElement,sel=ae&&ae.id?'#'+ae.id:(ae&&ae.dataset&&ae.dataset.b?'[data-b="'+ae.dataset.b+'"][data-d="'+ae.dataset.d+'"]':null);
 const key=S?S.phase+'|'+S.day+'|'+S.idx:(setup?'setup':'landing');
 $('#arena').className='arena'+(S?' playing':'');
 $('#stage').innerHTML=S?stage():(setup?setupHtml():landing());
 renderDash();wire();
 let el=null;if(key===lastKey&&sel)el=$('#stage '+sel);
 if(el&&!el.disabled)el.focus();else if(key!==lastKey){const h=$('#stage [data-focus]');if(h&&lastKey)h.focus()}
 lastKey=key;
}
function wire(){
 const on=(id,f)=>{const e=$('#'+id);if(e)e.onclick=f};
 on('enter',()=>{setup=true;render()});on('howbtn',()=>showTab('how'));
 on('sin',()=>authCall('login'));on('reg',()=>authCall('reg'));on('sout',signOut);on('vgo',verifyCall);on('vre',resendCall);
 on('forgot',()=>{keepForm();acctMode='reset';acctMsg='';acctNote='';render()});on('rback',()=>{keepForm();acctMode='main';acctMsg='';acctNote='';render()});on('rsend',()=>resetCall('send'));on('rgo',()=>resetCall('go'));
 const keepName=()=>{const n=$('#nm');if(n)draft=n.value.replace(/\s+/g,' ').trim()};
 const cu=$('#cu');if(cu)cu.onchange=()=>{keepName();setCurrency(cu.value);render()};
 const cc2=$('#cc');if(cc2)cc2.onchange=()=>{keepName();draftCc=cc2.value;if(CTCUR[cc2.value]&&!get('haggle.cur'))setCurrency(CTCUR[cc2.value]);render()};
 on('go',()=>start(true));on('prac',()=>start(false));on('again',()=>start(false));
 document.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>act('buy',{pid:b.dataset.b,dir:+b.dataset.d}));
 on('open',()=>act('open'));on('nx',()=>act('next'));on('nd',()=>act('nextday'));on('lg',()=>act('leave'));
 on('acc',()=>{const c=S.cur;if(c.offer<S.basis[c.p]&&confirmLoss!=='acc'){confirmLoss='acc';render();return}act('accept')});
 on('ctr',()=>{const c=S.cur;if(counter<S.basis[c.p]&&confirmLoss!=='ctr'){confirmLoss='ctr';render();return}act('counter',{price:counter})});
 const rg=$('#rg');if(rg)rg.oninput=()=>{counter=+rg.value;confirmLoss=false;$('#cv').textContent=N(counter);$('#ctr').textContent='Counter at '+N(counter)};
 on('sh',()=>{const t='I scored '+S.score+' out of 1000 in Haggle Market Arena. Can you beat me?';try{navigator.clipboard.writeText(t);$('#sh').textContent='Copied'}catch(e){$('#sh').textContent=t}});
}
function renderLB(){
 const opt=Object.entries(CT).map(([k,v])=>`<option value="${k}"${k===lbCountry?' selected':''}>${v}</option>`).join('');
 let h=`<div class="card"><h2>Leaders</h2><div class="ctl"><button class="chip" type="button" data-r="today" aria-pressed="${lbRange==='today'}">Today</button><button class="chip" type="button" data-r="week" aria-pressed="${lbRange==='week'}">This week</button></div>
<label for="lbc">Country</label><select id="lbc"><option value="">All countries</option>${opt}</select>`;
 h+=LB.length?`<div class="tw"><table><caption class="sr-only">Leaderboard</caption><tr><th>Rank</th><th>Display name</th><th>Score</th><th><span class="sr-only">Report</span></th></tr>${LB.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(cleanName(r.name))}${r.country?` <span class="hint">${esc(r.country)}</span>`:''}</td><td>${r.daily||0}</td><td><button class="rep" type="button" data-ref="${esc(r.ref||'')}" aria-label="Report this name">Report</button></td></tr>`).join('')}</table></div>`:'<p>No ranked scores here yet. Finish a ranked week to be first.</p>';
 const b=bestScore();
 h+=(b!==null?`<p class="hint">Your best on this device: ${b} points.</p>`:'')+`<details><summary>How ranking works</summary><p>Ranking uses your score out of 1000, calculated by the server from your decisions. It rewards profit, healthy margins, happy customers, careful stock and steady days, not revenue alone. Ties go to whoever finished first. The weekly board adds your ranked daily scores. Only one ranked run per day counts. See How it works for the formula.</p></details></div>`;
 $('#lead').innerHTML=h;
 document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{lbRange=c.dataset.r;tick()});
 $('#lbc').onchange=e=>{lbCountry=e.target.value;tick()};
 document.querySelectorAll('.rep[data-ref]').forEach(x=>x.onclick=async()=>{
  if(!confirm('Report this name as offensive or misleading?'))return;
  try{await api('report',{id:DEV,ref:x.dataset.ref});x.textContent='Reported';x.disabled=true}catch(e){x.textContent=e.status===403?'Finish a week first':'Try later'}
 });
}
function renderIns(){
 let h='<div class="card"><h2>Market insights</h2><p class="warnbox">Simulated activity. These numbers come from people playing a game. They are not real Nigerian market prices and do not represent any population.</p>';
 if(!INS)h+='<p>Loading...</p>';
 else if(INS.games<INS.min_games)h+=`<p>Not enough finished games yet (${INS.games} of ${INS.min_games} needed). Insights appear once enough games are finished, so no individual player can be picked out.</p>`;
 else h+=`<p class="hint">Based on ${INS.games} finished games. A product shows only after ${INS.min_shoppers} shoppers.</p><div class="tw"><table><caption class="sr-only">Simulated market insights by product</caption><tr><th>Product</th><th>Shoppers</th><th>Popularity</th><th>Sales accepted</th><th>Walked away</th><th>First offer</th><th>Avg sale price</th><th>Price vs first offer</th><th>Turnover</th></tr>${INS.rows.map(x=>x.hidden?`<tr><td>${esc(pname(x.p))}</td><td colspan="8" class="hint">Not enough shoppers yet</td></tr>`:`<tr><td>${esc(pname(x.p))}</td><td>${x.shoppers}</td><td>${x.popularity}%</td><td>${x.accept_rate}%</td><td>${x.walk_rate}%</td><td>${N(x.avg_first)}</td><td>${N(x.avg_price)}</td><td>${x.uplift===null?'n/a':(x.uplift>=0?'+':'')+x.uplift+'%'}</td><td>${x.turnover===null?'n/a':x.turnover+'x'}</td></tr>`).join('')}</table></div>`;
 $('#spon').innerHTML=h+'<p class="hint">Turnover is units sold divided by units bought. Price vs first offer compares the average sale price with the shopper\'s opening offer.</p></div>';
}
function renderHow(){
 const R=RULES;
 $('#how').innerHTML=`<div class="card"><h2>How it works</h2><p class="quote">Every price is a decision. Every decision has consequences.</p>
<p>You run a market stall for ${DAYS} days, starting with a simulated ${N(R?R.start:20000)}. Each morning you buy stock. Each afternoon 7 to 10 shoppers arrive, depending on the weather and your reputation, but you only have limited selling time. You can accept an offer, counter it, or let the shopper go. Every shopper has a hidden limit.</p>
<h3>The seven days</h3>${R?`<div class="tw"><table><caption class="sr-only">The seven-day campaign</caption><tr><th>Day</th><th>Situation</th><th>Objective</th></tr>${R.campaign.map((c,i)=>`<tr><td>${i+1}</td><td><b>${esc(c.t)}</b><br>${esc(c.d)}</td><td>${esc(c.obj)}</td></tr>`).join('')}</table></div>`:'<p class="hint">Rules could not be loaded. Check your connection.</p>'}
<h3>Money, plainly</h3><ul><li><b>Revenue</b> is what you take in from sales. It is not profit.</li><li><b>Cost of goods sold</b> is what you paid for the units you sold.</li><li><b>Gross profit</b> = revenue \u2212 cost of goods sold. Rent and wages are not modelled.</li><li><b>Gross margin</b> = gross profit \u00f7 revenue \u00d7 100.</li><li><b>Spoilage</b>: tomatoes that spoil overnight are written off.</li></ul>
<h3>Customer satisfaction</h3><p>A shopper who buys scores 50 to 100: the further your price is under their limit, the higher. A shopper who walks away scores 20. A shopper who finds you out of stock scores 0.</p>
<h3>Score (out of ${R?R.score.TOTAL_MAX:1000})</h3>${R?`<ul><li><b>Profit, up to ${R.score.PROFIT_MAX}:</b> your result after valuing leftover stock at ${R.liqPct}% of cost, scaled so a result of ${N(R.score.PROFIT_FULL)} earns full points.</li><li><b>Gross margin, up to ${R.score.MARGIN_MAX}:</b> ${R.score.MARGIN_LOW}% earns nothing, ${R.score.MARGIN_FULL}% or more earns full points.</li><li><b>Customer satisfaction, up to ${R.score.SAT_MAX}:</b> your average satisfaction.</li><li><b>Stock management, up to ${R.score.INV_MAX}:</b> less spoilage and leftover loss.</li><li><b>Consistency, up to ${R.score.CONS_MAX}:</b> days with sales and no gross loss.</li></ul>`:''}
<p>Revenue alone is not rewarded, and neither is the lowest price.</p>
<h3>Fairness and limits</h3><ul><li>The server runs every game and keeps shoppers' limits private.</li><li>Ranked runs share the same market each day. Prices and shoppers are random but reproducible.</li><li>This is a prototype simulation. Scores are not proof of real-world skill, and nothing here is financial advice.</li></ul>
<button class="btn" id="enter2" type="button">Enter the Arena</button></div>`;
 const b=$('#enter2');if(b)b.onclick=()=>{setup=!S;showTab('play');render()};
}
async function loadRules(){if(RULES)return;try{RULES=await api('rules');renderHow()}catch(e){}}
async function loadIns(){try{INS=await api('insights')}catch(e){}renderIns()}
async function loadProfile(){try{PROF=await api('me/profile',{id:DEV});if(PROF.account)put('haggle.ver',PROF.verified?'1':'0');if(!S)render()}catch(e){}}
async function tick(){
 try{
  await api('ping',{id:DEV});
  const s=await api('stats');$('#live').textContent=s.playingNow+' playing now, '+s.today+' today, '+s.total+' players';
  LB=(await api('leaderboard?range='+lbRange+(lbCountry?'&country='+lbCountry:''))).rows;renderLB();
 }catch(e){$('#live').textContent=e.status===403?'This website is not allowed to reach the game server.':'Connecting to the game server... it may be waking up.'}
}
function showTab(t){const b=document.querySelector('nav button[data-t="'+t+'"]');if(b)b.click()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('nav button').forEach(x=>{if(x===b)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
 ['play','lead','spon','how','inv'].forEach(id=>$('#'+id).hidden=id!==b.dataset.t);
 if(b.dataset.t==='inv'&&window.loadInv)loadInv();
 if(b.dataset.t==='spon')loadIns();
 if(b.dataset.t==='how')loadRules();
});
$('#rst').onclick=()=>{if(confirm('Reset saved data on this device? Your records on our server are not deleted.')){resetLocal();location.reload()}};
$('#del').onclick=async()=>{
 if(!confirm('Delete your game data and leaderboard entries from our server, and reset this device? This cannot be undone.'))return;
 try{await api('me/delete',{id:DEV});resetLocal();location.reload()}catch(e){alert(e.message==='sign_in'?'Please sign in first, then choose Delete my data.':'Could not delete right now. Please try again.')}
};
if(location.hash==='#owner'){$('#invb').hidden=false;const o=document.createElement('script');o.src='owner.js';document.head.appendChild(o)}
renderLB();renderIns();renderHow();tick();setInterval(()=>{if(!document.hidden)tick()},30000);
(async()=>{
 const rid=get('haggle.run');
 if(rid){try{const v=await api('run/start',{id:DEV,resume:rid});if(v.phase!=='final')S=v;else del('haggle.run')}catch(e){if(e.message!=='sign_in')del('haggle.run')}}
 render();loadProfile();loadRules();
})();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
