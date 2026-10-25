const fs=require('fs');
const unesc=s=>s.replace(/\\u([0-9a-fA-F]{4})/g,(m,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\(['"`\\])/g,'$1').replace(/\\u2713/g,'\u2713').replace(/\\u2717/g,'\u2717').replace(/\\u2212/g,'\u2212').replace(/\\u00f7/g,'\u00f7').replace(/\\u00d7/g,'\u00d7').replace(/\\u201c/g,'\u201c');
function keys(file){const t=fs.readFileSync(file,'utf8'),out=new Set(),re=/\bTH?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;let m;while((m=re.exec(t)))out.add(unesc(m[2]));
 // plain data keys used with T(variable): error table, tips, shopper lines, ternaries
 return out}
const all=new Set();
for(const f of ['../public/app.js','../public/common.js','../public/music.js'].map(x=>require('path').join(__dirname,x)))keys(f).forEach(k=>all.add(k));
const html=fs.readFileSync(require('path').join(__dirname,'../public/index.html'),'utf8');let m;const re=/data-i(?:al)?="([^"]*)"/g;while((m=re.exec(html)))all.add(m[1].replace(/&amp;/g,'&'));
const app=fs.readFileSync(require('path').join(__dirname,'../public/app.js'),'utf8');
for(const arr of ['OPEN','HIGH']){const mm=app.match(new RegExp('const '+arr+'=\\[(.*?)\\];'));mm[1].split(/',\s*'/).forEach(s=>all.add(unesc(s.replace(/^'|'$/g,''))))}
const tips=app.match(/const TIPS=\{(.*?)\};/s)[1];[...tips.matchAll(/:'((?:\\.|[^'\\])*)'/g)].forEach(x=>all.add(unesc(x[1])));
const com=fs.readFileSync(require('path').join(__dirname,'../public/common.js'),'utf8');[...com.match(/const ERRK=\{(.*?)\};/s)[1].matchAll(/:'((?:\\.|[^'\\])*)'/g)].forEach(x=>all.add(unesc(x[1])));
const {rules}=require('../lib/engine');const R=rules();R.campaign.forEach(c=>{all.add(c.t);all.add(c.d);all.add(c.obj)});
const ct=com.match(/const CT=\{(.*?)\};/s)[1];[...ct.matchAll(/:'([^']*)'/g)].forEach(x=>all.add(x[1]));
[...com.match(/const P=\[(.*?)\];/s)[1].matchAll(/n:'([^']*)'/g)].forEach(x=>all.add(x[1]));
['Practice run, not ranked.','Golden Crate noodles','Profit on this unit: {g}. Customer satisfaction: {s} out of 100.','Loss on this unit: {g}. Customer satisfaction: {s} out of 100.'].forEach(x=>all.add(x));
// server notes shown to players
['Ranked play is turned off for this device.',"You already used today's ranked run, so this is a practice run.",'Too many ranked runs from this network today, so this is a practice run.','Finished too quickly to be ranked.'].forEach(x=>all.add(x));
// live-status messages
['You are offline. Your game is saved on the server.','This website is not allowed to reach the game server.','Connecting to the game server... it may be waking up.'].forEach(x=>all.add(x));
const cm=fs.readFileSync(require('path').join(__dirname,'../public/common.js'),'utf8');
[...cm.match(/const GROUPS=\[(.*?)\];/s)[1].matchAll(/'((?:\\.|[^'\\])*)'\]/g)].forEach(x=>all.add(x[1]));
[...cm.match(/const WXI=\{(.*?)\};/s)[1].matchAll(/[nh]:'((?:\\.|[^'\\])*)'/g)].forEach(x=>all.add(x[1]));
const stn=require('../public/stations.js');Object.values(stn).forEach(x=>all.add(x.name));
['Auto (follows the weather)'].forEach(x=>all.add(x));
module.exports=[...all];
