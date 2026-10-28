let key='';try{key=sessionStorage.getItem('haggle.key')||''}catch(e){}
async function campaignPanel(){
 try{
  const e=$('#inv'),H={'x-admin-key':key},cs=(await api('admin/campaigns',null,H)).rows,d=document.createElement('div');d.className='card';
  const cats=['food','non-alcoholic drinks','household','personal care','phone accessories','fashion','education','general services'];
  d.innerHTML='<h2>Sponsor campaigns</h2><p class="note">A sponsor appears in the game only after you approve it. Price tests run in practice games only; ranked games show the brand but never change prices.</p>'+
  (cs.length?'<div class="tw"><table><tr><th>Brand / product</th><th>Status</th><th>Served</th><th>Invoice</th><th></th></tr>'+cs.map(c=>`<tr><td>${esc(c.brand)} / ${esc(c.product)}</td><td>${esc(c.status)}</td><td>${c.served} (${c.completed} done)</td><td>${esc(c.invoice)}</td><td>${c.status==='pending'||c.status==='paused'?`<button class="rep" data-i="${c.id}" data-a="approve">Approve</button> `:''}${c.status==='live'?`<button class="rep" data-i="${c.id}" data-a="pause">Pause</button> `:''}<button class="rep" data-i="${c.id}" data-a="end">End</button> <button class="rep" data-i="${c.id}" data-a="unpaid">Invoiced</button> <button class="rep" data-i="${c.id}" data-a="paid">Paid</button> <button class="rep" data-t="${esc(c.token)}">Copy report link</button></td></tr>`).join('')+'</table></div>':'<p>No campaigns yet.</p>')+
  `<h3 style="margin:12px 0 6px">New campaign</h3><label for="cb">Brand name</label><input id="cb" type="text" maxlength="40"><label for="cp">Product name (shown in game)</label><input id="cp" type="text" maxlength="40"><label for="ct">Tagline (optional)</label><input id="ct" type="text" maxlength="80"><label for="cc2">Category</label><select id="cc2">${cats.map(x=>`<option>${x}</option>`).join('')}</select><label for="cv">Wholesale price multipliers to test</label><input id="cv" type="text" value="0.9, 1, 1.1"><p class="note">Price tests: the wholesale price multipliers to compare (1 to 4 numbers between 0.5 and 1.5).</p><label for="cf">Agreed fee in naira (optional)</label><input id="cf" type="text" inputmode="numeric"><button class="btn" id="cmk">Create campaign (starts as pending)</button><p class="note" id="cmsg" role="status"></p>`;
  e.appendChild(d);
  d.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{try{await api('admin/campaign/action',{id:+b.dataset.i,action:b.dataset.a},H);loadInv()}catch(x){b.textContent='Failed: '+x.message}});
  d.querySelectorAll('[data-t]').forEach(b=>b.onclick=async()=>{const u=location.origin+'/report.html?t='+b.dataset.t;try{await navigator.clipboard.writeText(u);b.textContent='Copied'}catch(x){b.textContent=u}});
  $('#cmk').onclick=async()=>{try{await api('admin/campaign',{brand:$('#cb').value,product:$('#cp').value,tagline:$('#ct').value,category:$('#cc2').value,variants:$('#cv').value.split(',').map(x=>+x.trim()),fee_ngn:$('#cf').value},H);loadInv()}catch(x){$('#cmsg').textContent='Not created: '+x.message}};
 }catch(e){}
}
async function extraPanels(){
 try{
  const e=$('#inv'),sp=(await api('admin/sponsor',null,{'x-admin-key':key})).rows,d=document.createElement('div');d.className='card';
  d.innerHTML='<h2>Sponsor insights (all players, anonymised)</h2>'+(sp.length?'<div class="tw"><table><tr><th>Product</th><th>Shoppers</th><th>Sold</th><th>Walked</th><th>Avg price</th><th>Price vs max</th></tr>'+sp.map(x=>{const p=P.find(q=>q.id===x.p),nm=p?p.e+' '+esc(p.n)+(p.sp?' ★':''):esc(x.p);return x.hidden?`<tr><td>${nm}</td><td>${x.shoppers}</td><td colspan="4" class="note">Needs 30+ shoppers to show</td></tr>`:`<tr><td>${nm}</td><td>${x.shoppers}</td><td>${x.sold}</td><td>${x.walked}</td><td>${NGN(x.avg_price||0)}</td><td>${x.avg_max?Math.round(x.avg_price/x.avg_max*100)+'%':'-'}</td></tr>`}).join('')+'</table></div>':'<p>No finished weeks yet.</p>')+'<button class="btn alt" id="snap">Copy investor snapshot</button>';
  e.appendChild(d);
  $('#snap').onclick=async()=>{try{const m=await api('admin',null,{'x-admin-key':key});await navigator.clipboard.writeText(JSON.stringify({generated:new Date().toISOString(),metrics:m,sponsor:sp},null,2));$('#snap').textContent='Copied'}catch(x){$('#snap').textContent='Could not copy'}};
 }catch(e){}
}
async function modPanel(){
 try{
  const e=$('#inv'),rp=(await api('admin/reports',null,{'x-admin-key':key})).rows,d=document.createElement('div');d.className='card';
  d.innerHTML='<h2>Reported names (last 7 days)</h2>'+(rp.length?'<div class="tw"><table><tr><th>Name</th><th>Score</th><th>Reports</th><th></th></tr>'+rp.map(x=>`<tr><td>${esc(cleanName(x.name))}${x.hidden?' (hidden)':''}</td><td>${x.score}</td><td>${x.reports}</td><td><button class="rep" data-a="clear" data-ref="${esc(x.ref)}">Keep</button> <button class="rep" data-a="ban" data-ref="${esc(x.ref)}">Ban</button></td></tr>`).join('')+'</table></div>':'<p>No reports.</p>');
  e.appendChild(d);
  d.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{if(b.dataset.a==='ban'&&!confirm('Ban this player from ranked play and remove their scores?'))return;try{await api('admin/action',{ref:b.dataset.ref,action:b.dataset.a},{'x-admin-key':key});loadInv()}catch(x){b.textContent='Failed'}});
 }catch(e){}
}
async function musicPanel(){
 try{
  const e=$('#inv'),H={'x-admin-key':key},rows=(await api('admin/music',null,H)).rows,d=document.createElement('div');d.className='card';
  d.innerHTML='<h2>Naija hits shelf (what players see under Music)</h2><p class="note">Paste Spotify, YouTube, Apple Music or Audiomack links (playlists work best, since they update themselves), or a direct https audio file you have the rights to share. Only licensed streaming players are embedded; the game never hosts songs. Up to 30.</p>'+
  (rows.length?'<div class="tw"><table><tr><th>Title</th><th>Link</th><th></th></tr>'+rows.map(r=>`<tr><td>${esc(r.title)}</td><td class="note">${esc(r.url.slice(0,60))}</td><td><button class="rep" data-mid="${r.id}">Remove</button></td></tr>`).join('')+'</table></div>':'<p>The shelf is empty.</p>')+
  '<label for="mt">Title</label><input id="mt" type="text" maxlength="60"><label for="mu">Link</label><input id="mu" type="url" maxlength="400" placeholder="https://"><button class="btn" id="mad">Add to shelf</button><p class="note" id="mmsg" role="status"></p>';
  e.appendChild(d);
  d.querySelectorAll('[data-mid]').forEach(b=>b.onclick=async()=>{try{await api('admin/music/delete',{id:+b.dataset.mid},H);loadInv()}catch(x){b.textContent='Failed'}});
  $('#mad').onclick=async()=>{try{await api('admin/music',{title:$('#mt').value,url:$('#mu').value},H);loadInv()}catch(x){$('#mmsg').textContent='Not added: '+x.message}};
 }catch(e){}
}
async function loadInv(){
 const e=$('#inv');
 if(!key){e.innerHTML='<div class="card"><h2>Owner</h2><label class="note" for="ak">Owner key</label><input id="ak" type="password" autocomplete="off"><button class="btn" id="aks">Show metrics</button></div>';$('#aks').onclick=()=>{key=$('#ak').value;try{sessionStorage.setItem('haggle.key',key)}catch(x){}loadInv()};return}
 try{
  const a=await api('admin',null,{'x-admin-key':key}),t=a.totals;
  e.innerHTML=`<div class="card"><h2>Metrics (owner only)</h2><div class="tw"><table><tr><th>Visitors (devices that opened Haggle)</th><td>${t.visitors}</td></tr><tr><th>Testers (finished at least one week)</th><td>${t.testers}</td></tr><tr><th>Total plays (finished weeks)</th><td>${t.plays}</td></tr><tr><th>Repeat players (finished weeks on 2+ days)</th><td>${t.repeat_players}</td></tr><tr><th>Playing now</th><td>${t.playing_now}</td></tr><tr><th>Ranked runs today</th><td>${t.ranked_today}</td></tr><tr><th>Day-1 return rate</th><td>${a.retention.d1==null?'not enough data yet':a.retention.d1+'%'}</td></tr><tr><th>Day-7 return rate</th><td>${a.retention.d7==null?'not enough data yet':a.retention.d7+'%'}</td></tr></table></div><h3 style="margin:12px 0 6px">Active visitors per day</h3><div class="tw"><table>${a.activeByDay.map(d=>`<tr><td>${esc(d.day)}</td><td>${d.active}</td></tr>`).join('')||'<tr><td>No data yet</td></tr>'}</table></div><h3 style="margin:12px 0 6px">Players by country</h3><div class="tw"><table>${a.countries.map(c=>`<tr><td>${esc(CT[c.country]||c.country)}</td><td>${c.players}</td></tr>`).join('')||'<tr><td>No data yet</td></tr>'}</table></div><p class="note">Counts every person who opens the game, signed in or not, using anonymous device IDs. One person on two devices counts twice.</p></div>`;
 await modPanel();await extraPanels();await campaignPanel();await musicPanel();
 }catch(x){key='';try{sessionStorage.removeItem('haggle.key')}catch(y){}e.innerHTML='<div class="card"><p class="lose" role="alert">Wrong key, or too many tries. Wait a minute and try again.</p></div>';setTimeout(loadInv,2500)}
}
setInterval(function(){if(!$('#inv').hidden&&key)loadInv()},30000);
