const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const put=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(e){}};
const del=k=>{try{localStorage.removeItem(k)}catch(e){}};
// Saved data on this device is versioned and validated; anything unexpected is dropped (never trusted).
const LS_V='2',OK={'haggle.dev':v=>/^p_[0-9a-f]{24}$/.test(v),'haggle.name':v=>v.length>=3&&v.length<=20,'haggle.country':v=>/^[A-Z]{2,5}$/.test(v),'haggle.best':v=>/^\d{1,4}$/.test(v)&&+v<=1000,'haggle.run':v=>/^[0-9a-f]{32}$/.test(v),'haggle.sess':v=>/^[0-9a-f]{64}$/.test(v),'haggle.user':v=>/^[A-Za-z0-9_.-]{3,20}$/.test(v),'haggle.ver':v=>v==='0'||v==='1','haggle.cur':v=>/^[A-Z]{3}$/.test(v),'haggle.mvol':v=>/^(100|[1-9]?\d)$/.test(v),'haggle.msrc':v=>v==='synth'||v==='phone'||v==='web'};
(function(){try{
 const bad=Object.keys(localStorage).filter(k=>k.indexOf('haggle.')===0&&k!=='haggle.v'&&(localStorage.getItem('haggle.v')!==LS_V||!OK[k]||!OK[k](localStorage.getItem(k))));
 bad.forEach(k=>localStorage.removeItem(k));localStorage.setItem('haggle.v',LS_V);
}catch(e){}})();
function resetLocal(){try{Object.keys(localStorage).filter(k=>k.indexOf('haggle.')===0).forEach(k=>localStorage.removeItem(k))}catch(e){}}
let NAME_RE;try{NAME_RE=new RegExp('[^\\p{L}\\p{N} ._-]','gu')}catch(e){NAME_RE=/[^A-Za-z0-9 ._-]/g}
const cleanName=s=>String(s||'Trader').replace(NAME_RE,'').trim().slice(0,20)||'Trader';
function nameProblem(n){
 if(!n)return '';
 if(n.length>20)return 'Display names can be at most 20 characters.';
 if(n.replace(NAME_RE,'')!==n)return 'Use only letters, numbers, spaces, dots, underscores and hyphens.';
 if(n.length<3)return 'Display names need at least 3 characters.';
 return '';
}
const CT={NG:'Nigeria',GH:'Ghana',KE:'Kenya',ZA:'South Africa',EG:'Egypt',SN:'Senegal',CI:'Ivory Coast',CM:'Cameroon',UG:'Uganda',TZ:'Tanzania',RW:'Rwanda',GB:'United Kingdom',US:'United States',CA:'Canada',IN:'India',AE:'UAE',DE:'Germany',FR:'France',BR:'Brazil',OTHER:'Other'};
const P=[{id:'tom',n:'Tomatoes',e:'🍅',sl:1},{id:'rice',n:'Rice, 1 bag',e:'🌾'},{id:'fab',n:'Ankara fabric',e:'🧵'},{id:'chg',n:'Phone charger',e:'🔌'},{id:'noo',n:'Golden Crate noodles',e:'🍜',sp:1},
 {id:'umb',n:'Umbrella',e:'☂️'},{id:'bts',n:'Rain boots',e:'🥾'},{id:'wat',n:'Sachet water, 1 bag',e:'💧'},{id:'drk',n:'Soft drinks, 1 crate',e:'🥤'},{id:'fan',n:'Hand fan',e:'🌬️'},{id:'crm',n:'Body cream',e:'🧴'},{id:'bre',n:'Fresh bread',e:'🍞',sl:1}];
const WXC={sun:{n:'Sunny',e:'☀️'},hot:{n:'Heatwave',e:'🥵'},cloud:{n:'Cloudy',e:'⛅'},rain:{n:'Light rain',e:'🌦️'},storm:{n:'Heavy rain',e:'⛈️'},harm:{n:'Harmattan (dry and dusty)',e:'🌫️'}};
const pname=id=>{const p=P.find(x=>x.id===id);return p?p.n:id};
function newDevId(){const rb=window.crypto&&crypto.getRandomValues?crypto.getRandomValues(new Uint8Array(12)):Array.from({length:12},()=>Math.floor(Math.random()*256));return 'p_'+Array.from(rb).map(b=>('0'+b.toString(16)).slice(-2)).join('')}
let DEV=get('haggle.dev');
if(!DEV){DEV=newDevId();put('haggle.dev',DEV)}
// Signed-in players also send a session token. A device ID alone cannot act for a player who has an account.
let SESS=get('haggle.sess');
// Display currency. The game and its scores are always played in naira; this only changes how amounts are SHOWN.
// naira = how many naira one unit of that currency is worth. These are rough, fixed game rates (not live prices), so update them here when you like.
const CUR={NGN:{s:'\u20a6',naira:1,d:0,n:'Nigerian naira'},USD:{s:'$',naira:1500,d:2,n:'US dollar'},GBP:{s:'\u00a3',naira:2000,d:2,n:'British pound'},EUR:{s:'\u20ac',naira:1700,d:2,n:'Euro'},GHS:{s:'GH\u20b5',naira:140,d:2,n:'Ghana cedi'},KES:{s:'KSh ',naira:11.5,d:0,n:'Kenyan shilling'},ZAR:{s:'R ',naira:85,d:2,n:'South African rand'},XOF:{s:'CFA ',naira:2.6,d:0,n:'West African CFA franc'},CAD:{s:'CA$',naira:1100,d:2,n:'Canadian dollar'},AED:{s:'AED ',naira:410,d:2,n:'UAE dirham'},INR:{s:'\u20b9',naira:18,d:0,n:'Indian rupee'}};
const CTCUR={NG:'NGN',GH:'GHS',KE:'KES',ZA:'ZAR',SN:'XOF',CI:'XOF',CM:'XOF',GB:'GBP',US:'USD',CA:'CAD',IN:'INR',AE:'AED',DE:'EUR',FR:'EUR'};
let CURRENCY=get('haggle.cur')||'NGN';if(!CUR[CURRENCY])CURRENCY='NGN';
const setCurrency=c=>{if(CUR[c]){CURRENCY=c;put('haggle.cur',c)}};
const N=n=>{const c=CUR[CURRENCY],v=n/c.naira;return c.s+v.toLocaleString('en-NG',{minimumFractionDigits:c.d,maximumFractionDigits:c.d})};
// The server writes some sentences with naira amounts in them. Show those in the chosen currency too.
const cvt=t=>CURRENCY==='NGN'?String(t):String(t).replace(/\u20a6([\d,]+)/g,(m,d)=>N(+d.replace(/,/g,'')));
async function api(p,body,hdr){
 let r,tm,ac=window.AbortController?new AbortController():null;
 if(ac)tm=setTimeout(()=>ac.abort(),40000);
 try{r=await fetch('/api/'+p,{method:body?'POST':'GET',headers:Object.assign({'content-type':'application/json'},SESS?{'x-session':SESS}:{},hdr||{}),body:body?JSON.stringify(body):undefined,signal:ac?ac.signal:undefined})}
 catch(e){throw Object.assign(new Error('network'),{status:0})}
 finally{clearTimeout(tm)}
 const j=await r.json().catch(()=>({}));
 if(r.status===401&&j.error==='sign_in'){SESS=null;del('haggle.sess');del('haggle.user');del('haggle.ver')}
 if(!r.ok)throw Object.assign(new Error(j.error||r.status),{status:r.status});return j;
}
const ERR={name_taken:'That display name is taken. Please choose another.',name_too_short:'Display names need at least 3 characters.',name_too_long:'Display names can be at most 20 characters.',name_invalid_chars:'Use only letters, numbers, spaces, dots, underscores and hyphens.',name_not_allowed:'That name is not allowed. Please choose another.',old_version:'That saved game is from an older version. Please start a new game.',
 sign_in:'Your sign-in is missing or has expired. Please sign in again.',bad_login:'Wrong username or password.',username_taken:'That username is taken. Please choose another.',already_registered:'This device already has an account. Please sign in instead.',
 username_too_short:'Usernames need at least 3 characters.',username_too_long:'Usernames can be at most 20 characters.',username_invalid_chars:'Usernames can use letters, numbers, dots, underscores and hyphens.',username_invalid:'Please enter a username.',
 password_too_short:'Passwords need at least 10 characters.',password_too_long:'Passwords can be at most 128 characters.',password_too_common:'That password is too easy to guess. Please choose another.',password_has_username:'Your password should not contain your username.',password_invalid:'Please enter a password.',email_invalid:'Please enter a real email address.',email_disposable:'Please use a permanent email address, not a temporary one.',email_in_use:'That email is already verified on another account.',bad_code:'That code is wrong or has expired. Ask for a new one.',wait:'Please wait a minute before asking for another code.',email_failed:'We could not send the email right now. Please try again in a few minutes.',busy:'The server is busy. Please try again in a moment.'};
function errText(e){
 if(ERR[e.message])return ERR[e.message];
 if(e.status===403)return 'This website is not allowed to reach the game server. (Owner: check ALLOWED_ORIGINS on Render.)';
 if(e.status===429)return 'Too many tries. Please wait a minute.';
 if(!e.status||e.status>=500)return 'Cannot reach the game server right now. Check your internet, then try again in a minute.';
 return 'That did not go through. Please try again.';
}
