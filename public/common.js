const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>'\u20a6'+Math.round(n).toLocaleString('en-NG');
const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const put=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(e){}};
const del=k=>{try{localStorage.removeItem(k)}catch(e){}};
// Saved data on this device is versioned and validated; anything unexpected is dropped (never trusted).
const LS_V='2',OK={'haggle.dev':v=>/^p_[0-9a-f]{24}$/.test(v),'haggle.name':v=>v.length>=3&&v.length<=20,'haggle.country':v=>/^[A-Z]{2,5}$/.test(v),'haggle.best':v=>/^\d{1,4}$/.test(v)&&+v<=1000,'haggle.run':v=>/^[0-9a-f]{32}$/.test(v),'haggle.sess':v=>/^[0-9a-f]{64}$/.test(v),'haggle.user':v=>/^[A-Za-z0-9_.-]{3,20}$/.test(v)};
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
const P=[{id:'tom',n:'Tomatoes',e:'🍅'},{id:'rice',n:'Rice, 1 bag',e:'🌾'},{id:'fab',n:'Ankara fabric',e:'🧵'},{id:'chg',n:'Phone charger',e:'🔌'},{id:'noo',n:'Golden Crate noodles',e:'🍜',sp:1}];
const pname=id=>{const p=P.find(x=>x.id===id);return p?p.n:id};
function newDevId(){const rb=window.crypto&&crypto.getRandomValues?crypto.getRandomValues(new Uint8Array(12)):Array.from({length:12},()=>Math.floor(Math.random()*256));return 'p_'+Array.from(rb).map(b=>('0'+b.toString(16)).slice(-2)).join('')}
let DEV=get('haggle.dev');
if(!DEV){DEV=newDevId();put('haggle.dev',DEV)}
// Signed-in players also send a session token. A device ID alone cannot act for a player who has an account.
let SESS=get('haggle.sess');
async function api(p,body,hdr){
 let r,tm,ac=window.AbortController?new AbortController():null;
 if(ac)tm=setTimeout(()=>ac.abort(),40000);
 try{r=await fetch('/api/'+p,{method:body?'POST':'GET',headers:Object.assign({'content-type':'application/json'},SESS?{'x-session':SESS}:{},hdr||{}),body:body?JSON.stringify(body):undefined,signal:ac?ac.signal:undefined})}
 catch(e){throw Object.assign(new Error('network'),{status:0})}
 finally{clearTimeout(tm)}
 const j=await r.json().catch(()=>({}));
 if(r.status===401&&j.error==='sign_in'){SESS=null;del('haggle.sess');del('haggle.user')}
 if(!r.ok)throw Object.assign(new Error(j.error||r.status),{status:r.status});return j;
}
const ERR={name_taken:'That display name is taken. Please choose another.',name_too_short:'Display names need at least 3 characters.',name_too_long:'Display names can be at most 20 characters.',name_invalid_chars:'Use only letters, numbers, spaces, dots, underscores and hyphens.',name_not_allowed:'That name is not allowed. Please choose another.',old_version:'That saved game is from an older version. Please start a new game.',
 sign_in:'Your sign-in is missing or has expired. Please sign in again.',bad_login:'Wrong username or password.',username_taken:'That username is taken. Please choose another.',already_registered:'This device already has an account. Please sign in instead.',
 username_too_short:'Usernames need at least 3 characters.',username_too_long:'Usernames can be at most 20 characters.',username_invalid_chars:'Usernames can use letters, numbers, dots, underscores and hyphens.',username_invalid:'Please enter a username.',
 password_too_short:'Passwords need at least 10 characters.',password_too_long:'Passwords can be at most 128 characters.',password_too_common:'That password is too easy to guess. Please choose another.',password_has_username:'Your password should not contain your username.',password_invalid:'Please enter a password.',busy:'The server is busy. Please try again in a moment.'};
function errText(e){
 if(ERR[e.message])return ERR[e.message];
 if(e.status===403)return 'This website is not allowed to reach the game server. (Owner: check ALLOWED_ORIGINS on Render.)';
 if(e.status===429)return 'Too many tries. Please wait a minute.';
 if(!e.status||e.status>=500)return 'Cannot reach the game server right now. Check your internet, then try again in a minute.';
 return 'That did not go through. Please try again.';
}
