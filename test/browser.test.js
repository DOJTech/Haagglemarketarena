// Simulated-browser test (jsdom). Run: npm i --no-save jsdom ; PORT=3055 npm start ; node test/browser.test.js
// jsdom is NOT a real browser: it checks behaviour and markup, not pixels, focus rings or screen-reader output.
const {JSDOM}=require('jsdom');const base='http://localhost:3055';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ok=0,fail=0;const t=(n,c)=>{c?ok++:(fail++,console.log('FAIL',n));};
const real=(u,o)=>fetch(new URL(u,base),o);
const uniq=()=>'Tester'+Math.random().toString(36).slice(2,8);
async function load(f,ls){
 const dom=await JSDOM.fromURL(base+'/',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,beforeParse(w){
  w.fetch=f||real;w.HAGGLE_RETRY_MS=300;w.confirm=()=>true;w.alert=()=>{};if(ls)for(const k in ls)w.localStorage.setItem(k,ls[k])}});
 await sleep(1500);return dom;
}
const doc=d=>d.window.document,$=(d,s)=>doc(d).querySelector(s),txt=(d,s)=>($(d,s)||{textContent:''}).textContent;
const click=async(d,s,w=450)=>{$(d,s).click();await sleep(w)};
async function begin(d,name){await click(d,'#enter',150);$(d,'#nm').value=name||uniq();await click(d,'#go',1500)}
(async()=>{
 let d=await load();
 t('live counter shows',/playing now/.test(txt(d,'#live')));
 t('landing: headline, actions, disclaimer, credit',/Where Price Meets Strategy\./.test(txt(d,'#stage'))&&/Enter the Arena/.test(txt(d,'#stage'))&&/Explore How It Works/.test(txt(d,'#stage'))&&/No real money changes hands/.test(txt(d,'#stage'))&&/Built by Dolapo Oyatomi/.test(txt(d,'body')));
 t('landing: supporting statement',/Buy smarter\. Negotiate better\. Protect your margins\./.test(txt(d,'#stage')));
 await click(d,'#enter',150);
 t('setup: simulated balance and public-name notice shown before starting',/\u20a620,000/.test(txt(d,'#stage'))&&/public leaderboard/.test(txt(d,'#stage'))&&/simulated/i.test(txt(d,'#stage')));
 $(d,'#nm').value='ab';await click(d,'#go',200);
 t('name too short is refused',/at least 3 characters/.test(txt(d,'#stage')));
 $(d,'#nm').value='<b>x</b>';await click(d,'#go',200);
 t('name with markup is refused',/Use only letters/.test(txt(d,'#stage')));
 $(d,'#nm').value=uniq();await click(d,'#go',1500);
 t('first-time flow: game starts on day 1',/Buy stock/.test(txt(d,'#stage'))&&/Day 1 of 7/.test(txt(d,'#stage')));
 t('starting balance on dashboard',/Starting balance \(simulated\)\u20a620,000/.test(txt(d,'#dash')));
 t('landing button and tab do not share an id',doc(d).querySelectorAll('[id]').length===new Set([...doc(d).querySelectorAll('[id]')].map(e=>e.id)).size);
 t("today's objective is shown",/Today's objective/.test(txt(d,'#stage')));
 await click(d,'[data-b="rice"][data-d="1"]');
 t('buying updates history and units',/Bought 1 Rice/.test(txt(d,'#dash'))&&/Unitspurchased1/.test(txt(d,'#dash').replace(/\s+/g,'')));
 for(let i=0;i<10&&!$(d,'[data-b="rice"][data-d="1"]').disabled;i++)await click(d,'[data-b="rice"][data-d="1"]');
 t('insufficient funds: buy button is disabled, not silently failing',$(d,'[data-b="rice"][data-d="1"]').disabled===true);
 // sale + loss confirmation + walk-away, on a fresh game with one of everything
 d=await load();await begin(d);
 for(const p of['rice','fab','chg','noo','tom'])await click(d,`[data-b="${p}"][data-d="1"]`);
 await click(d,'#open');
 t('customer shown with consequences explained',/Customer 1 of 6/.test(txt(d,'#stage'))&&/Accept:/.test(txt(d,'#stage'))&&/Counter:/.test(txt(d,'#stage'))&&/Let them go:/.test(txt(d,'#stage')));
 await click(d,'#acc',600);if(/Confirm: sell at a loss/.test(txt(d,'#stage')))await click(d,'#acc',600);
 t('accepting sells and shows the result',/Sold|No sale/.test(txt(d,'#stage'))&&/Sold/.test(txt(d,'#stage')));
 t('sale books revenue and a history line',/Sold 1 /.test(txt(d,'#dash'))&&!/Revenue\u20a60\b/.test(txt(d,'#dash').replace(/\s+/g,'')));
 await click(d,'#nx',600);
 t('rapid double-click on Let them go does not skip a customer',(await(async()=>{$(d,'#lg').click();$(d,'#lg')&&$(d,'#lg').click();await sleep(900);return /Customer 3 of 6/.test(txt(d,'#stage'))||/walked away/.test(txt(d,'#stage'))&&!/Customer 4 of 6/.test(txt(d,'#stage'))})()));
 // empty states and accessibility basics
 d=await load();
 await click(d,'nav button[data-t="lead"]',200);t('leaders empty state',/No ranked scores here yet/.test(txt(d,'#lead')));
 await click(d,'nav button[data-t="spon"]',800);t('insights empty state is honest',/Not enough finished games yet/.test(txt(d,'#spon'))&&/not real Nigerian market prices/.test(txt(d,'#spon')));
 await click(d,'nav button[data-t="how"]',900);t('how it works lists all seven days',/Opening day/.test(txt(d,'#how'))&&/Closing day/.test(txt(d,'#how'))&&/Gross profit/.test(txt(d,'#how')));
 const tabs=[...doc(d).querySelectorAll('nav button')];
 t('mobile nav: real buttons, one marked current',tabs.every(b=>b.tagName==='BUTTON')&&tabs.filter(b=>b.getAttribute('aria-current')==='page').length===1);
 t('keyboard: skip link and main landmark exist',!!$(d,'a.skip[href="#main"]')&&!!$(d,'main#main'));
 t('all form fields have labels',[...doc(d).querySelectorAll('input,select')].every(e=>e.id&&$(d,`label[for="${e.id}"]`)));
 // corrupted saved data
 d=await load(real,{'haggle.best':'999999','haggle.run':'zzz','haggle.dev':'garbage','haggle.name':'x','haggle.junk':'1'});
 const L=d.window.localStorage;
 t('corrupted saved data is discarded safely and the page still works',L.getItem('haggle.best')===null&&L.getItem('haggle.run')===null&&L.getItem('haggle.junk')===null&&/^p_[0-9a-f]{24}$/.test(L.getItem('haggle.dev'))&&/Enter the Arena/.test(txt(d,'#stage')));
 t('saved data is versioned',L.getItem('haggle.v')==='2');
 d.window.resetLocal();t('reset path clears everything on this device',Object.keys(d.window.localStorage).filter(k=>k.indexOf('haggle.')===0).length===0);
 // persistence across a reload
 let a=await load();await begin(a);await click(a,'[data-b="fab"][data-d="1"]');
 const ls={};for(let i=0;i<a.window.localStorage.length;i++){const k=a.window.localStorage.key(i);ls[k]=a.window.localStorage.getItem(k)}
 const b=await load(real,ls);
 t('progress persists: resumed on the same day with the same purchase',/Buy stock/.test(txt(b,'#stage'))&&/Bought 1 Ankara/.test(txt(b,'#dash')));
 // server asleep, then wakes
 let n=0;d=await load((u,o)=>{if(/run\/start/.test(u)&&n++<2)return Promise.reject(new TypeError('offline'));return real(u,o)});
 await begin(d);t('cold start: retries then starts',/Buy stock/.test(txt(d,'#stage')));
 d=await load((u,o)=>/run\/start/.test(u)?Promise.resolve(new Response('{"error":"origin"}',{status:403,headers:{'content-type':'application/json'}})):real(u,o));
 await begin(d);t('403 shows a clear error',/not allowed to reach the game server/.test(txt(d,'#stage')));
 d=await load((u,o)=>/run\/start/.test(u)?Promise.reject(new TypeError('offline')):real(u,o));
 await click(d,'#enter',100);$(d,'#nm').value=uniq();await click(d,'#go',5200);
 t('gives up politely when offline',/Cannot reach the game server/.test(txt(d,'#stage')));
 let boom=true;d=await load((u,o)=>{if(/run\/act/.test(u)&&boom){boom=false;return Promise.reject(new TypeError('offline'))}return real(u,o)});
 await begin(d);await click(d,'[data-b="rice"][data-d="1"]',900);
 t('move failure: re-synced, game is safe',/Your game is safe/.test(txt(d,'#stage')));
 d=await load();await begin(d);d=await load((u,o)=>/run\/start/.test(u)?Promise.resolve(new Response('{"error":"name_taken"}',{status:409,headers:{'content-type':'application/json'}})):real(u,o));
 await begin(d,'SomeoneElse');t('duplicate display name gets a clear message',/display name is taken/.test(txt(d,'#stage')));
 console.log(ok+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack||e.message);process.exit(1)});
