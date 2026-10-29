/* Any language, everywhere: lines with no built-in translation are translated once by the server, saved, and shown. */
(function(){
var miss={},timer=0,busy=false,bad={};
function load(){try{var c=JSON.parse(localStorage.getItem('hgtr.'+LANG)||'{}');DICT[LANG]=DICT[LANG]||{};for(var k in c)if(!DICT[LANG][k])DICT[LANG][k]=c[k]}catch(e){}}
function save(){try{var o={},d=DICT[LANG]||{},base=window.__base||{};for(var k in d)if(d[k]!==undefined&&!(base[LANG]&&base[LANG][k]))o[k]=d[k];localStorage.setItem('hgtr.'+LANG,JSON.stringify(o))}catch(e){}}
var T0=T;T=function(s,v){var d=DICT[LANG];if(LANG!=='en'&&!(d&&d[s])&&/[A-Za-z]{3}/.test(s)&&s.length<400)note(s);return T0(s,v)};
function note(s){miss[LANG+'\u0001'+s]=1;clearTimeout(timer);timer=setTimeout(flush,600)}
async function flush(){
 var L=LANG;if(busy||bad[L]>Date.now())return;
 var keys=Object.keys(miss).filter(function(k){return k.split('\u0001')[0]===L}).map(function(k){return k.slice(k.indexOf('\u0001')+1)});
 if(!keys.length)return;busy=true;var got=0;
 try{for(var i=0;i<keys.length;i+=40){var ch=keys.slice(i,i+40),r=await api('translate',{id:DEV,lang:L,keys:ch});
   ch.forEach(function(k){delete miss[L+'\u0001'+k]});
   for(var k in (r.t||{})){if(!DICT[L])DICT[L]={};DICT[L][k]=r.t[k];got++}}}
 catch(e){bad[L]=Date.now()+300000}
 busy=false;if(got){save();if(LANG===L&&typeof renderAll==='function')renderAll()}
 if(!got)keys.forEach(function(k){delete miss[L+'\u0001'+k]})}
var sl=setLang,il=initLang;
setLang=function(l){sl(l);load();fill()};initLang=function(x){il(x);load();fill()};
function fill(){var s=document.getElementById('lang');if(!s)return;var ks=Object.keys(LANGS);if(s.options.length!==ks.length)s.innerHTML=ks.map(function(k){return '<option value="'+k+'">'+LANGS[k]+'</option>'}).join('');s.value=LANG}
load();
})();
