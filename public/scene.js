// Illustrated market: custom SVG people, 16 stalls, a road with 5 buses and 4 taxis. Decorative only.
(function(){
 var z=7;function rnd(){z=(z*16807)%2147483647;return z/2147483647}
 function pick(a){return a[Math.floor(rnd()*a.length)]}
 var SK=['#8d5524','#c68642','#5c3a21','#3b2417','#e0ac69','#f1c27d','#6f4a2f','#a56b3a'];
 var TP=['#10B981','#F4C95D','#F87171','#60A5FA','#C084FC','#FB923C','#f472b6','#34d399','#f8fafc','#ef4444'];
 var BT=['#1e293b','#334155','#7c2d12','#14532d','#4c1d95','#0f172a'];
 var HR=['#1a1110','#2b1b14','#0d0d0d'];
 function person(i,still){
  var sk=SK[i%8],tp=pick(TP),bt=pick(BT),hr=pick(HR),w=pick(TP),f=i%4,dress=i%2===0,s='';
  s+='<g class="lg a"><rect x="14.5" y="46" width="5.5" height="26" rx="2.7" fill="'+(dress?sk:bt)+'"/><rect x="13" y="69" width="9" height="4" rx="2" fill="#111"/></g>';
  s+='<g class="lg b"><rect x="20" y="46" width="5.5" height="26" rx="2.7" fill="'+(dress?sk:bt)+'"/><rect x="19" y="69" width="9" height="4" rx="2" fill="#111"/></g>';
  s+='<g class="ar b"><rect x="9" y="23" width="5" height="22" rx="2.5" fill="'+sk+'"/></g>';
  s+=dress?'<path d="M12 22h16l5 32H7z" fill="'+tp+'"/><path d="M12 31h16" stroke="rgba(0,0,0,.18)" stroke-width="2"/>':'<rect x="12" y="22" width="16" height="26" rx="6" fill="'+tp+'"/><rect x="12" y="44" width="16" height="6" fill="'+bt+'"/>';
  s+='<g class="ar a"><rect x="26" y="23" width="5" height="22" rx="2.5" fill="'+sk+'"/></g>';
  if(f===0)s+='<circle cx="20" cy="9" r="10" fill="'+hr+'"/>';
  s+='<circle cx="20" cy="14" r="8" fill="'+sk+'"/>';
  if(f===1)s+='<path d="M11 13C12 3 28 3 29 13z" fill="'+hr+'"/>';
  if(f===2)s+='<path d="M10.5 12C11 1 29 1 29.5 12z" fill="'+w+'"/><path d="M27 5l7-4-2 9z" fill="'+w+'"/>';
  if(f===3)s+='<path d="M12 12a8 8 0 0116 0z" fill="'+w+'"/><rect x="18" y="10.5" width="15" height="2.5" rx="1.2" fill="'+w+'"/>';
  s+='<circle cx="17.5" cy="14" r="1" fill="#111"/><circle cx="23" cy="14" r="1" fill="#111"/><path d="M17.5 18q3 2 5.5 0" stroke="#111" stroke-width="1" fill="none"/>';
  if(!still){var k=i%5;
   if(k===0)s+='<ellipse cx="20" cy="2" rx="10" ry="4" fill="#a16207"/><circle cx="16" cy="-1" r="2.6" fill="#ef4444"/><circle cx="21" cy="-2" r="2.6" fill="#facc15"/><circle cx="25" cy="-1" r="2.6" fill="#22c55e"/>';
   if(k===1||k===3)s+='<rect x="27" y="40" width="10" height="13" rx="3" fill="'+pick(TP)+'"/><path d="M29 40q3-6 6 0" stroke="#222" stroke-width="1.3" fill="none"/>';
   if(k===2)s+='<rect x="6" y="40" width="9" height="13" rx="2" fill="#7c4a1d"/><path d="M7 40q3-6 6 0" stroke="#222" stroke-width="1.3" fill="none"/>'}
  return '<svg viewBox="-2 -8 44 82" aria-hidden="true">'+s+'</svg>'}
 function wheel(x,y,r){return '<g class="wh"><circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#111"/><circle cx="'+x+'" cy="'+y+'" r="'+(r/2)+'" fill="#9aa1ad"/><rect x="'+(x-1)+'" y="'+(y-r+1)+'" width="2" height="'+(r*2-2)+'" fill="#111"/></g>'}
 function bus(c,s,n){var d='<rect x="4" y="8" width="162" height="46" rx="10" fill="'+c+'"/><rect x="4" y="36" width="162" height="7" fill="'+s+'"/><rect x="22" y="3" width="44" height="6" rx="2" fill="'+s+'"/>',q=134/n;
  for(var k=0;k<n;k++)d+='<rect x="'+(12+k*q)+'" y="16" width="'+(q-6)+'" height="16" rx="3" fill="#cfe8ff"/>';
  d+='<rect x="148" y="16" width="14" height="24" rx="3" fill="#cfe8ff"/><circle cx="165" cy="47" r="3" fill="#fff7a8"/>'+wheel(38,56,10)+wheel(128,56,10);
  return '<svg viewBox="0 0 170 70" aria-hidden="true">'+d+'</svg>'}
 function taxi(c,s){return '<svg viewBox="0 0 100 52" aria-hidden="true"><rect x="4" y="22" width="92" height="18" rx="7" fill="'+c+'"/><path d="M22 22L32 8H68L80 22z" fill="'+c+'"/><path d="M27 21L34 11H48V21zM52 21V11H66L74 21z" fill="#cfe8ff"/><rect x="40" y="2" width="20" height="6" rx="2" fill="#fff"/><rect x="4" y="30" width="92" height="3" fill="'+s+'"/><circle cx="95" cy="30" r="2.5" fill="#fff7a8"/>'+wheel(26,41,8)+wheel(74,41,8)+'</svg>'}
 var G=['\u{1F34D}\u{1F34C}\u{1F96D}\u{1F34A}','\u{1F457}\u{1F454}\u{1F458}\u{1F9E3}','\u{1F345}\u{1F336}\uFE0F\u{1F9C5}\u{1F96C}','\u{1F41F}\u{1F990}\u{1F980}\u{1F41A}','\u{1F4F1}\u{1F50C}\u{1F3A7}\u{1F4A1}','\u{1F35E}\u{1F95A}\u{1F956}\u{1F9C1}','\u{1F33D}\u{1F95C}\u{1F360}\u{1F954}','\u{1F45F}\u{1F45C}\u{1F392}\u{1F9E2}','\u{1FAA3}\u{1F9F4}\u{1F9FC}\u{1F9F9}','\u{1F941}\u{1FA98}\u{1F3BA}\u{1F4FB}','\u{1F349}\u{1F347}\u{1F34E}\u{1F34B}','\u{1F969}\u{1F357}\u{1F356}\u{1F9C8}','\u{1F9F5}\u{1FAA1}\u{1F380}\u{1F9F6}','\u{1F964}\u{1F379}\u{1F9C3}\u{1F37A}','\u{1F4DA}\u{270F}\uFE0F\u{1F58D}\uFE0F\u{1F4D2}','\u{1F6E2}\uFE0F\u{1F96B}\u{1FAD8}\u{1F33E}'];
 var C=['#10B981','#F4C95D','#F87171','#60A5FA','#C084FC','#FB923C','#34d399','#F472B6'];
 var PR=['\u{1F9FA}','\u{1F4E6}','\u2602\uFE0F','\u{1F6D2}','\u{1FA91}','\u{1F6E2}\uFE0F','\u{1F96D}','\u{1F4A7}'];
 function row(cls,off){var h='<div class="stalls '+cls+'">';
  for(var i=0;i<8;i++)h+='<div class="stall" style="--c:'+C[i]+'"><div class="sl">'+person(i+off,1)+'</div><i></i><b>'+G[i+off]+'</b></div>';
  for(var j=0;j<6;j++)h+='<span class="prop" style="left:'+(6+j*16)+'%">'+PR[(j+off)%8]+'</span>';
  var b='<div class="bunt">';for(var k=0;k<30;k++)b+='<s style="--c:'+C[k%8]+'"></s>';return h+b+'</div></div>'}
 function walkers(cls,n,hh,off){var h='<div class="walkers '+cls+'">';
  for(var i=0;i<n;i++){var r=i%2,d=24+(i*7)%20,dl=-(i*(d/n)),y=(i*37)%60;
   h+='<div class="walker wk'+(r?' rev':'')+'" style="--d:'+d+'s;--dl:'+dl.toFixed(1)+'s;--i:'+i+';--h:'+hh+';top:'+y+'%">'+person(i+off,0)+'</div>'}
  return h+'</div>'}
 var B=[['#F4C95D','#111',6],['#2563eb','#fff',5],['#dc2626','#F4C95D',6],['#16a34a','#fff',5],['#9333ea','#f472b6',6]];
 var T=[['#F4C95D','#111'],['#111827','#F4C95D'],['#f8fafc','#16a34a'],['#fb923c','#1d4ed8']];
 var L1=[['b',0],['t',0],['b',2],['t',2],['b',4]],L2=[['t',1],['b',1],['t',3],['b',3]];
 function veh(a,lane,rev,idx,tot){var isb=a[0]==='b',v=isb?B[a[1]]:T[a[1]],d=isb?17+idx*2:11+idx*2,dl=-(idx*(d/tot));
  return '<div class="veh '+(isb?'bus':'taxi')+' '+lane+(rev?' rev':'')+'" style="--d:'+d+'s;--dl:'+dl.toFixed(1)+'s;--i:'+(idx*2+(rev?1:0))+'">'+(isb?bus(v[0],v[1],v[2]):taxi(v[0],v[1]))+'</div>'}
 var road='<div class="zone road">';
 L1.forEach(function(a,i){road+=veh(a,'l1',0,i,L1.length)});L2.forEach(function(a,i){road+=veh(a,'l2',1,i,L2.length)});road+='</div>';
 var s=document.createElement('div');s.id='scene';s.setAttribute('aria-hidden','true');
 s.innerHTML='<div class="stars"></div><div class="sun"></div><div class="hills"></div><div class="zone m-up">'+row('up',0)+walkers('up',12,'clamp(34px,6vw,62px)',0)+'</div>'+road+'<div class="zone m-dn">'+row('dn',8)+walkers('dn',14,'clamp(60px,12vw,120px)',4)+'</div><div class="vig"></div>';
 document.body.insertBefore(s,document.body.firstChild);
})();
