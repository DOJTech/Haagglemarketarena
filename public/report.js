const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>n==null?'-':'\u20a6'+Math.round(n).toLocaleString('en-NG');
(async()=>{
 try{
  const t=new URLSearchParams(location.search).get('t')||'';
  const r=await fetch('/api/report/'+encodeURIComponent(t));if(!r.ok)throw 0;
  const d=await r.json(),c=d.campaign;
  $('#out').innerHTML=`<h1>${esc(c.brand)}: ${esc(c.product)}</h1><p class="n">Status: ${esc(c.status)}${c.start_day?' | '+esc(c.start_day)+' to '+esc(c.end_day||'open'):''}</p><div class="warn" role="note"><b>Read this first.</b> ${esc(d.disclaimer)}</div>
  <div class="tw"><table><caption>Results by price-test group</caption><tr><th scope="col">Group</th><th scope="col">Games started</th><th scope="col">Games finished</th><th scope="col">Units bought</th><th scope="col">Shoppers asking</th><th scope="col">Sold</th><th scope="col">Walked away</th><th scope="col">Avg sale price</th><th scope="col">Avg profit per unit</th></tr>${d.rows.map(x=>x.hidden?`<tr><td>${esc(x.label)}</td><td>${x.served}</td><td>${x.runs}</td><td colspan="6" class="n">Not enough games yet (needs ${d.min_runs} finished)</td></tr>`:`<tr><td>${esc(x.label)}</td><td>${x.served}</td><td>${x.runs}</td><td>${x.units_bought}</td><td>${x.shoppers}</td><td>${x.sold}</td><td>${x.walked}</td><td>${N(x.avg_price)}</td><td>${N(x.avg_gain)}</td></tr>`).join('')}</table></div>
  <p class="n">Players are assigned to price-test groups at random. Only practice games run price tests; ranked games show your brand without changing prices. No player data is shown here.</p>`;
 }catch(e){$('#out').textContent='This report link is not valid.'}
})();
