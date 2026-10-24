const nm=()=>'T'+Math.random().toString(36).slice(2,10);
const lt=s=>[...s].map(c=>String.fromCharCode(97+parseInt(c,16))).join(''); // letters only: long digit runs look like phone numbers and are refused as names
const B='http://localhost:3055',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const id=()=>'p_'+[...Array(24)].map(()=>Math.floor(Math.random()*16).toString(16)).join('');
const lat=[];let errs=0,reqs=0;
async function call(p,body){const t=Date.now();try{const r=await fetch(B+'/api/'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();lat.push(Date.now()-t);reqs++;if(r.status>=500)errs++;return{s:r.status,j}}catch(e){errs++;reqs++;return{s:0,j:{}}}}
async function play(pid){
 let v=(await call('run/start',{id:pid,name:'L'+lt(pid.slice(2,14)),mode:'practice',country:'NG'})).j;const rid=v.runId;
 const act=async(type,x)=>{await sleep(210);const r=await call('run/act',Object.assign({id:pid,runId:rid,type},x));if(r.s===200)v=r.j;else throw new Error(type+' '+r.s)};
 for(let d=0;d<7;d++){for(const p of['rice','fab'])if(v.cash>=v.cost[p])await act('buy',{pid:p,dir:1});
  await act('open');while(['haggle','nostock','result'].includes(v.phase))v.phase==='haggle'?await act('accept'):await act('next');
  if(v.phase==='dayend')await act('nextday')}
 return v.phase==='final';
}
(async()=>{
 const t0=Date.now();const res=await Promise.allSettled(Array.from({length:30},()=>play(id())));
 const done=res.filter(r=>r.status==='fulfilled'&&r.value).length;
 lat.sort((a,b)=>a-b);const q=p=>lat[Math.floor(lat.length*p)];
 console.log(`30 simulated players at once: ${done} finished a full week, ${reqs} requests in ${Math.round((Date.now()-t0)/1000)}s, ${Math.round(reqs/((Date.now()-t0)/1000))} req/s, server errors ${errs}`);
 console.log(`latency ms: p50 ${q(.5)}, p95 ${q(.95)}, p99 ${q(.99)}, max ${lat[lat.length-1]}`);
})();
