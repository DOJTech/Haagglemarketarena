const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Money. The game runs in naira; players may SEE amounts in another currency. This is display only: the rates are fixed and
// approximate (USD, GBP, AED and GHS checked against October 2026 reports; the rest are estimates), not live exchange rates.
// To refresh them, change `r` (naira per 1 unit) below. Scores are points, so currency never affects rankings.
const CUR={NGN:{s:'\u20a6',r:1,d:0},USD:{s:'$',r:1331,d:2},GBP:{s:'\u00a3',r:1764,d:2},EUR:{s:'\u20ac',r:1530,d:2},GHS:{s:'GH\u20b5',r:119.7,d:2},KES:{s:'KSh ',r:10.3,d:0},ZAR:{s:'R',r:81,d:2},EGP:{s:'E\u00a3',r:27.7,d:2},XOF:{s:'CFA ',r:2.33,d:0},UGX:{s:'USh ',r:0.37,d:0},TZS:{s:'TSh ',r:0.53,d:0},RWF:{s:'RF ',r:0.92,d:0},CAD:{s:'CA$',r:965,d:2},INR:{s:'\u20b9',r:14.8,d:0},AED:{s:'AED ',r:362.6,d:2},BRL:{s:'R$',r:246,d:2}};
const CC_CUR={NG:'NGN',GH:'GHS',KE:'KES',ZA:'ZAR',EG:'EGP',SN:'XOF',CI:'XOF',CM:'XOF',UG:'UGX',TZ:'TZS',RW:'RWF',GB:'GBP',US:'USD',CA:'CAD',IN:'INR',AE:'AED',DE:'EUR',FR:'EUR',BR:'BRL'};
let CURR='NGN',NF=null;
function setCur(c,save){if(!CUR[c])c='NGN';CURR=c;NF=null;if(save){try{localStorage.setItem('haggle.cur',c)}catch(e){}}}
const fmt=(n,c)=>{const u=CUR[c];try{if(!NF||NF.c!==c)NF={c,f:new Intl.NumberFormat(LOCALE,{minimumFractionDigits:u.d,maximumFractionDigits:u.d})};return u.s+NF.f.format(n/u.r)}catch(e){return u.s+Math.round(n/u.r)}};
const N=n=>fmt(n,CURR);          // what the player sees
const NGN=n=>fmt(n,'NGN');       // always naira (owner pages)
const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const put=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(e){}};
const del=k=>{try{localStorage.removeItem(k)}catch(e){}};
// Saved data on this device is versioned and validated; anything unexpected is dropped (never trusted).
const LS_V='4',OK={'haggle.cur':v=>Object.prototype.hasOwnProperty.call(CUR,v),'haggle.vol':v=>/^(100|\d{1,2})$/.test(v),'haggle.st':v=>/^(auto|lagos|market|highlife|rain)$/.test(v),'haggle.sfx':v=>/^[01]$/.test(v),'haggle.amb':v=>/^[01]$/.test(v),'haggle.dev':v=>/^p_[0-9a-f]{24}$/.test(v),'haggle.name':v=>v.length>=3&&v.length<=20,'haggle.country':v=>/^[A-Z]{2,5}$/.test(v),'haggle.best':v=>/^\d{1,4}$/.test(v)&&+v<=1000,'haggle.run':v=>/^[0-9a-f]{32}$/.test(v),'haggle.lang':v=>/^(en|pcm|fr)$/.test(v)};
(function(){try{
 const bad=Object.keys(localStorage).filter(k=>k.indexOf('haggle.')===0&&k!=='haggle.v'&&(localStorage.getItem('haggle.v')!==LS_V||!OK[k]||!OK[k](localStorage.getItem(k))));
 // A new storage version keeps the player's device id, language and name, so nobody loses their identity on an update.
 bad.filter(k=>!(localStorage.getItem('haggle.v')!==LS_V&&OK[k]&&OK[k](localStorage.getItem(k))&&k!=='haggle.run'&&k!=='haggle.best')).forEach(k=>localStorage.removeItem(k));
 localStorage.setItem('haggle.v',LS_V);
}catch(e){}})();
function resetLocal(){try{Object.keys(localStorage).filter(k=>k.indexOf('haggle.')===0).forEach(k=>localStorage.removeItem(k))}catch(e){}}
let NAME_RE;try{NAME_RE=new RegExp('[^\\p{L}\\p{N} ._-]','gu')}catch(e){NAME_RE=/[^A-Za-z0-9 ._-]/g}
const cleanName=s=>String(s||'Trader').replace(NAME_RE,'').trim().slice(0,20)||'Trader';
function nameProblem(n){
 if(!n)return '';
 if(n.length>20)return T('Display names can be at most 20 characters.');
 if(n.replace(NAME_RE,'')!==n)return T('Use only letters, numbers, spaces, dots, underscores and hyphens.');
 if(n.length<3)return T('Display names need at least 3 characters.');
 return '';
}
const CT={NG:'Nigeria',GH:'Ghana',KE:'Kenya',ZA:'South Africa',EG:'Egypt',SN:'Senegal',CI:'Ivory Coast',CM:'Cameroon',UG:'Uganda',TZ:'Tanzania',RW:'Rwanda',GB:'United Kingdom',US:'United States',CA:'Canada',IN:'India',AE:'UAE',DE:'Germany',FR:'France',BR:'Brazil',OTHER:'Other'};
// c = shelf group; f = fresh (spoils overnight). Names are translated when shown.
const P=[{id:'tom',n:'Tomatoes',e:'🍅',c:'fresh',f:1},{id:'pla',n:'Plantain',e:'🍌',c:'fresh',f:1},{id:'pep',n:'Fresh pepper',e:'🌶️',c:'fresh',f:1},{id:'rice',n:'Rice, 1 bag',e:'🌾',c:'staple'},{id:'yam',n:'Yam tubers',e:'🍠',c:'staple'},{id:'noo',n:'Golden Crate noodles',e:'🍜',c:'staple',sp:1},{id:'wat',n:'Pure water (sachets)',e:'💧',c:'drinks'},{id:'zob',n:'Chilled zobo',e:'🥤',c:'drinks',f:1},{id:'fab',n:'Ankara fabric',e:'🧵',c:'style'},{id:'cap',n:'Sun cap',e:'🧢',c:'style'},{id:'shea',n:'Shea butter',e:'🧴',c:'style'},{id:'chg',n:'Phone charger',e:'🔌',c:'gear'},{id:'umb',n:'Umbrella',e:'☂️',c:'gear'},{id:'fan',n:'Rechargeable fan',e:'🌀',c:'gear'},{id:'tor',n:'Torch',e:'🔦',c:'gear'}];
const GROUPS=[['fresh','Fresh goods (they spoil overnight)'],['staple','Everyday staples'],['drinks','Drinks'],['style','Fashion and skin care'],['gear','Weather and power gear']];
const WXI={sun:{e:'☀️',n:'Sunny',h:'A bright sunny day. Cold drinks, caps and fans do well.'},hot:{e:'🥵',n:'Very hot',h:'Scorching heat. Fans, cold water and zobo fly off the shelf.'},cloud:{e:'⛅',n:'Cloudy',h:'Grey skies. Some people carry umbrellas, just in case.'},rain:{e:'🌧️',n:'Heavy rain',h:'It is pouring. Umbrellas sell fast, fewer people come out, and fresh goods cost more.'},harm:{e:'🌫️',n:'Harmattan haze',h:'Dry, dusty air. Shea butter sells, cold drinks do not.'}};
const pname=id=>{const p=P.find(x=>x.id===id);return p?T(p.n):id};
let DEV=get('haggle.dev');
if(!DEV){const rb=window.crypto&&crypto.getRandomValues?crypto.getRandomValues(new Uint8Array(12)):Array.from({length:12},()=>Math.floor(Math.random()*256));DEV='p_'+Array.from(rb).map(b=>('0'+b.toString(16)).slice(-2)).join('');put('haggle.dev',DEV)}
async function api(p,body,hdr){
 let r,tm,ac=window.AbortController?new AbortController():null;
 if(ac)tm=setTimeout(()=>ac.abort(),40000);
 try{r=await fetch('/api/'+p,{method:body?'POST':'GET',headers:Object.assign(body?{'content-type':'application/json'}:{},hdr||{}),body:body?JSON.stringify(body):undefined,signal:ac?ac.signal:undefined})}
 catch(e){throw Object.assign(new Error('network'),{status:0})}
 finally{clearTimeout(tm)}
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(new Error(j.error||r.status),{status:r.status});return j;
}
const ERRK={name_taken:'That display name is taken. Please choose another.',name_too_short:'Display names need at least 3 characters.',name_too_long:'Display names can be at most 20 characters.',name_invalid_chars:'Use only letters, numbers, spaces, dots, underscores and hyphens.',name_not_allowed:'That name is not allowed. Please choose another.',old_version:'That saved game is from an older version. Please start a new game.','no run':'That game was not found. Please start a new one.',gone:'That game was not found. Please start a new one.'};
function errText(e){
 if(ERRK[e.message])return T(ERRK[e.message]);
 if(e.status===403)return T('This website is not allowed to reach the game server. (Owner: check ALLOWED_ORIGINS on Render.)');
 if(e.status===429)return T('Too many tries. Please wait a minute.');
 if(!e.status||e.status>=500)return T('Cannot reach the game server right now. Check your internet, then try again in a minute.');
 return T('That did not go through. Please try again.');
}
