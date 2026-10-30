/* Your shop scene. ShopDraw(S) is called by the game each time it redraws. Shows exactly the stock you hold. */
(function(){
var L=document.createElement('link');L.rel='stylesheet';L.href='shop.css';document.head.appendChild(L);
var SKY={sun:['#6ec1ff','#d6f0ff'],hot:['#ffb347','#ffe9b8'],cloud:['#8fa3bb','#cfd9e6'],rain:['#5f7189','#a9b8c9'],harm:['#d2ae78','#f0dcb8']};
var CL=['#c62828','#1565c0','#2e7d32','#6a1b9a','#ef6c00','#00838f','#ad1457','#455a64'],SK=['#5a3a28','#7a4e34','#3f2a1e','#8d5a3b'];
var DEFS='<defs><g id="pe"><circle cx="0" cy="-26" r="4.6" fill="var(--sk)"/><path d="M-4 -22h8l1.5 14h-11z" fill="var(--c)"/><rect x="-3.4" y="-8" width="2.8" height="8" fill="#222"/><rect x=".6" y="-8" width="2.8" height="8" fill="#222"/></g>'+
'<g id="danfo"><rect x="0" y="-34" width="84" height="28" rx="5" fill="#f7c21b"/><rect x="0" y="-21" width="84" height="6" fill="#111"/><g fill="#bfe6ff"><rect x="6" y="-31" width="13" height="9" rx="2"/><rect x="23" y="-31" width="13" height="9" rx="2"/><rect x="40" y="-31" width="13" height="9" rx="2"/><rect x="60" y="-31" width="18" height="10" rx="2"/></g><rect x="80" y="-14" width="4" height="5" fill="#fff6a8"/><g fill="#1b1b1b"><circle cx="18" cy="-5" r="7"/><circle cx="66" cy="-5" r="7"/></g><g fill="#999"><circle cx="18" cy="-5" r="3"/><circle cx="66" cy="-5" r="3"/></g></g>'+
'<g id="truck"><rect x="0" y="-42" width="62" height="36" fill="#eceff1" stroke="#90a4ae"/><rect x="0" y="-26" width="62" height="5" fill="#c62828"/><path d="M62 -30h20l8 12v12h-28z" fill="#d84315"/><rect x="68" y="-27" width="12" height="9" fill="#bfe6ff"/><g fill="#1b1b1b"><circle cx="14" cy="-5" r="7"/><circle cx="34" cy="-5" r="7"/><circle cx="76" cy="-5" r="7"/></g></g>'+
'<g id="taxi"><path d="M2 -12l8 -14h34l10 14z" fill="#f7c21b"/><rect x="0" y="-16" width="62" height="12" rx="4" fill="#f7c21b"/><rect x="14" y="-24" width="9" height="7" fill="#bfe6ff"/><rect x="28" y="-24" width="11" height="7" fill="#bfe6ff"/><rect x="24" y="-29" width="12" height="5" rx="1" fill="#111"/><g fill="#1b1b1b"><circle cx="14" cy="-4" r="5.5"/><circle cx="48" cy="-4" r="5.5"/></g></g></defs>';
function veh(id,y,dir,dur,delay){var w=id==='truck'?90:id==='danfo'?84:62,inner=dir<0?'<use href="#'+id+'" transform="translate('+w+' 0) scale(-1 1)"/>':'<use href="#'+id+'"/>';
 return '<g class="v'+(dir<0?' l':'')+'" style="animation-duration:'+dur+'s;animation-delay:-'+delay+'s"><g transform="translate(0 '+y+')"><g class="bob">'+inner+'</g></g></g>'}
function ped(i,dir,dur,delay){return '<g class="pw'+(dir<0?' l':'')+'" style="animation-duration:'+dur+'s;animation-delay:-'+delay+'s"><g transform="translate(0 163) scale(1.05)"><g class="bob"><use href="#pe" style="--c:'+CL[i%8]+';--sk:'+SK[i%4]+'"/></g></g></g>'}
window.ShopDraw=function(S){
 var host=document.getElementById('shop');
 if(!host){var m=document.getElementById('mkt');if(!m)return;host=document.createElement('section');host.id='shop';host.className='card shop';m.after(host)}
 if(!S){host.hidden=true;return}host.hidden=false;
 var wx=(S.wx&&S.wx.k)||'sun',sk=SKY[wx]||SKY.sun,stock=(S.stock)||{},prods=(typeof P!=='undefined'?P:[]).filter(function(p){return stock[p.id]>0}),gl=[];
 prods.forEach(function(p){for(var k=0;k<Math.min(3,stock[p.id]);k++)gl.push(p.e)});gl=gl.slice(0,16);
 var goods=gl.map(function(e,i){var r=i<8?0:1,c=i%8;return '<text x="'+(118+c*17)+'" y="'+(r?124:100)+'" font-size="15">'+e+'</text>'}).join('');
 var aw='';for(var i=0;i<8;i++)aw+='<path d="M'+(98+i*20.5)+' 62h20.5v16a10.25 10.25 0 0 1 -20.5 0z" fill="'+(i%2?'#fff':'#c62828')+'"/>';
 var rain=wx==='rain'?'<g class="rain">'+Array.apply(null,Array(26)).map(function(_,i){return '<line x1="'+(i*14)+'" y1="'+((i*37)%110)+'" x2="'+(i*14-3)+'" y2="'+(((i*37)%110)+9)+'"/>'}).join('')+'</g>':'';
 var bld='';[[0,62,48],[48,40,52],[96,70,40],[270,52,50],[318,66,42]].forEach(function(b){bld+='<rect x="'+b[0]+'" y="'+(110-b[2])+'" width="'+b[1]+'" height="'+b[2]+'" fill="#7c8da5" opacity=".55"/>'});
 var svg='<svg viewBox="0 0 360 232" role="img" aria-label="Your shop and the busy street">'+DEFS+
 '<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+sk[0]+'"/><stop offset="1" stop-color="'+sk[1]+'"/></linearGradient></defs>'+
 '<rect width="360" height="232" fill="url(#sg)"/>'+bld+'<rect y="150" width="360" height="12" fill="#b9b3a8"/><rect y="162" width="360" height="70" fill="#4b4f58"/><rect y="164" width="360" height="2" fill="#d9d9d9" opacity=".6"/>'+
 '<path d="M0 197h360" stroke="#f7c21b" stroke-width="2" stroke-dasharray="16 12"/>'+
 '<rect x="108" y="76" width="144" height="74" fill="#6b4a2f"/><rect x="110" y="102" width="140" height="3" fill="#a07147"/><rect x="110" y="126" width="140" height="3" fill="#a07147"/>'+goods+
 '<g transform="translate(180 138) scale(1.25)"><use href="#pe" style="--c:#1b7f52;--sk:#5a3a28"/><rect class="wave" x="4" y="-21" width="9" height="3" fill="#5a3a28"/></g>'+
 '<rect x="104" y="128" width="152" height="22" fill="#8b5e3c"/><rect x="104" y="128" width="152" height="4" fill="#b98652"/>'+
 '<rect x="102" y="62" width="5" height="88" fill="#4e342e"/><rect x="253" y="62" width="5" height="88" fill="#4e342e"/>'+aw+
 '<rect x="128" y="40" width="104" height="17" rx="3" fill="#1b2a5c"/><text x="180" y="52.5" text-anchor="middle" font-size="10" font-weight="800" fill="#f4c95d">HAGGLE STALL</text>'+
 (prods.length?'':'<rect x="150" y="132" width="60" height="14" rx="2" fill="#fff"/><text x="180" y="142.5" text-anchor="middle" font-size="8" font-weight="800" fill="#b3213f">SOLD OUT</text>')+
 ped(0,1,28,3)+ped(1,-1,34,11)+ped(2,1,31,19)+ped(3,-1,38,6)+ped(5,1,36,24)+
 veh('danfo',192,1,17,2)+veh('truck',192,1,26,15)+veh('taxi',192,1,12,7)+veh('danfo',224,-1,15,9)+veh('taxi',224,-1,11,4)+veh('truck',224,-1,24,18)+rain+'</svg>';
 var lg=prods.map(function(p){return '<span>'+p.e+' \u00D7'+stock[p.id]+'</span>'}).join('');
 host.innerHTML='<h3>\uD83C\uDFEA '+(S.day?'Day '+S.day:'')+'</h3>'+svg+'<div class="legend" aria-label="Goods on your shelf">'+(lg||'')+'</div>'}
})();
