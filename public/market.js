/* Market view: 10 markets, 2 billboards each, a taxi ride between them, shoppers who talk. Decorative: no effect on scoring. */
(function(){
var B=window.BILLBOARDS||[],host=document.getElementById('mkt');if(!B.length||!host)return;
var cur=0,riding=false,reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
try{var v=get('haggle.mkt');if(v!==null&&+v>=0&&+v<B.length)cur=+v}catch(e){}
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var TALK=[['How much be this one?','For you, \u20A6{p} only!'],['Oga, reduce am small.','Last price, \u20A6{p}. No joke.'],['Is this fresh?','Straight from the farm today!'],['I go take two.','Two for \u20A6{p2}. Deal?'],['Abeg, add small extra.','Mama, you dey wound me o! Okay.'],['Welcome to {m}!','Thank you! What are you selling?'],['Your goods look good.','Come, see my stall. Best price here.'],['That billboard is new.','Yes! Everybody is talking about it.']];
var PPL=['\uD83D\uDEB6\uD83C\uDFFE\u200D\u2640\uFE0F','\uD83D\uDEB6\uD83C\uDFFF','\uD83D\uDEB6\uD83C\uDFFD\u200D\u2640\uFE0F','\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDDB1','\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDDB1','\uD83D\uDC74\uD83C\uDFFF','\uD83E\uDDD2\uD83C\uDFFE','\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDDB1'];
function bb(b,s){return '<div class="mk-bb '+s+'" style="--c:'+esc(b.color)+'"><div class="mk-bd"><i>'+(b.open?'FOR SALE':'FEATURED')+'</i><span class="em">'+b.emoji+'</span><b>'+esc(b.brand)+'</b><small>'+esc(b.product)+'</small></div><u></u></div>'}
function scene(m){
 var h='<div class="mk-sky"></div><div class="mk-sun"></div><div class="mk-sk"></div>'+bb(m.boards[0],'mk-l')+bb(m.boards[1],'mk-r')+'<div class="mk-stalls">';
 for(var i=0;i<4;i++)h+='<span style="--c:'+['#10B981','#F4C95D','#F87171','#60A5FA'][i]+'"><i></i><em>'+m.goods[i]+'</em></span>';
 h+='</div><div class="mk-road"><span class="mk-car c1">\uD83D\uDE95</span><span class="mk-car c2">\uD83D\uDE8C</span><span class="mk-car c3">\uD83D\uDE95</span></div><div class="mk-walk">';
 for(i=0;i<6;i++)h+='<span style="--d:'+(14+i*3)+'s;--dl:-'+(i*2.7)+'s;--t:'+(i%2?'0':'1')+'" class="'+(i%2?'rev':'')+'">'+PPL[(i+cur)%8]+'</span>';
 return h+'</div><div class="mk-talk"><span class="mk-s">\uD83E\uDDD5\uD83C\uDFFE</span><span class="mk-b">\uD83E\uDDD1\uD83C\uDFFF</span><p class="mk-bub bl" aria-hidden="true"></p><p class="mk-bub br" aria-hidden="true"></p></div>'}
host.innerHTML='<div class="mk-head"><h3></h3><span class="hint"></span></div><div class="mk-view"><div id="mks"></div><div class="mk-taxi" aria-hidden="true">\uD83D\uDCE6\uD83D\uDE95</div></div><div class="mk-ctl"><label class="sr-only" for="mksel">Choose a market</label><select id="mksel"></select><button class="btn" id="mkgo" type="button">\uD83D\uDE95 Take a taxi to the next market</button></div><div class="chat mk-chat" role="log" aria-label="Taxi conversation" hidden></div><div class="mk-pay" hidden><button class="btn" id="mkpay" type="button"></button><button class="btn alt" id="mkno" type="button">Not now</button></div><p class="hint mk-note">Your goods ride with you. Every market has its own billboards and crowd.</p>';
var sel=host.querySelector('#mksel'),go=host.querySelector('#mkgo'),view=host.querySelector('.mk-view'),mks=host.querySelector('#mks'),tk=0,timer;
sel.innerHTML=B.map(function(m,i){return '<option value="'+i+'">'+(i+1)+'. '+esc(m.name)+'</option>'}).join('');
function say(){var m=B[cur],t=TALK[tk++%TALK.length],p=800+((tk*370)%1400),bl=mks.querySelector('.bl'),br=mks.querySelector('.br');if(!bl)return;
 var f=function(s){return s.replace('{m}',m.name).replace('{p}',p.toLocaleString()).replace('{p2}',(p*2-200).toLocaleString())};
 bl.textContent=f(t[0]);br.textContent=f(t[1]);bl.classList.add('on');br.classList.remove('on');
 setTimeout(function(){bl.classList.remove('on');br.classList.add('on')},2100)}
function show(i){cur=i;var m=B[i];try{put('haggle.mkt',String(i))}catch(e){}
 view.style.setProperty('--s1',m.sky[0]);view.style.setProperty('--s2',m.sky[1]);mks.innerHTML=scene(m);sel.value=i;
 host.querySelector('h3').textContent='\uD83C\uDFEA '+m.name;host.querySelector('.hint').textContent=m.city;go.textContent='\uD83D\uDE95 Take a taxi to '+B[(i+1)%B.length].name;say()}
var chat=host.querySelector('.mk-chat'),payBox=host.querySelector('.mk-pay'),pay=host.querySelector('#mkpay'),no=host.querySelector('#mkno');
function cb(w,t){chat.insertAdjacentHTML('beforeend','<p class="cb '+w+'"><b>'+(w==='m'?'You':'\uD83D\uDE95 Driver')+'</b>'+esc(t)+'</p>');chat.scrollTop=chat.scrollHeight}
function free(){riding=false;go.disabled=sel.disabled=false}
function ride(i){if(riding||i===cur){sel.value=cur;return}riding=true;go.disabled=sel.disabled=true;
 var name=B[i].name,fare=800+350*Math.abs(i-cur),f='\u20A6'+fare.toLocaleString(),sr=document.getElementById('sr');
 chat.hidden=false;chat.innerHTML='';cb('d','Good day, oga! Where are we going?');
 setTimeout(function(){cb('m','Please take me and my goods to '+name+'.')},700);
 setTimeout(function(){cb('d','No wahala! The fare is '+f+'. Pay and we go.');pay.textContent='Pay '+f+' fare';payBox.hidden=false},1500);
 no.onclick=function(){payBox.hidden=true;cb('m','Not now, thank you.');cb('d','Okay, I will be around.');sel.value=cur;free()};
 pay.onclick=function(){payBox.hidden=true;cb('m','Here is '+f+'.');cb('d','Payment received. Thank you! Hold tight, we dey go!');
  var fin=function(){show(i);cb('d','We don reach '+name+'. Sell well!');chat.insertAdjacentHTML('beforeend','<p class="rcpt">\u2713 Paid '+f+' \u00B7 Receipt TX'+(Date.now()%100000)+'</p>');if(sr)sr.textContent='Arrived at '+name+'. Fare paid '+f;free()};
  if(reduce){fin();return}view.classList.add('riding');setTimeout(function(){show(i)},1300);setTimeout(function(){view.classList.remove('riding');fin()},2700)}}
go.onclick=function(){ride((cur+1)%B.length)};sel.onchange=function(){ride(+sel.value)};
show(cur);timer=setInterval(say,4600);
})();
