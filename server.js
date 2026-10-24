const express=require('express'),{Pool}=require('pg'),path=require('path'),crypto=require('crypto');
const SEC=require('./lib/security');
const app=express();
app.disable('x-powered-by');
const CSP="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; img-src 'self' data:; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
app.set('trust proxy',Math.max(1,+process.env.TRUST_PROXY||1));
app.use(express.json({limit:'4kb'}));
app.use((q,r,n)=>{r.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'geolocation=(), camera=(), microphone=()','Strict-Transport-Security':'max-age=31536000; includeSubDomains','Content-Security-Policy':CSP});n()});
const PROD=process.env.NODE_ENV==='production';
const SECRET=process.env.SEED_SECRET||(PROD?'':'dev-seed-secret-0000'),ADMIN=process.env.ADMIN_KEY||(PROD?'':'dev-admin-key-0000');
if(SECRET.length<16||ADMIN.length<12||(PROD&&ADMIN.length<20)){console.error('Set SEED_SECRET (16+ chars) and ADMIN_KEY (12+ chars; 20+ in production)');process.exit(1)}
// Owner second factor (TOTP). Required in production: a leaked ADMIN_KEY alone must not give owner access.
const TOTP=(process.env.ADMIN_TOTP_SECRET||'').trim();
if(TOTP&&!SEC.validTotpSecret(TOTP)){console.error('ADMIN_TOTP_SECRET is not a valid base32 secret of at least 128 bits. Make one with: node scripts/make-owner-secret.js');process.exit(1)}
if(PROD&&!TOTP){console.error('ADMIN_TOTP_SECRET is required in production (owner second factor). Make one with: node scripts/make-owner-secret.js');process.exit(1)}
if(!TOTP)console.warn('NOTE: ADMIN_TOTP_SECRET is not set, so the owner key alone opens the owner area. Allowed for local testing only.');
// Ranked play needs a signed-in account. It can be switched off for old local test suites, never in production.
const RANK_ACCT=process.env.RANKED_NEEDS_ACCOUNT!=='0';
if(PROD&&!RANK_ACCT){console.error('RANKED_NEEDS_ACCOUNT=0 is not allowed in production.');process.exit(1)}
const MIN_RANK_MS=+process.env.MIN_RANK_MS||60000;
// DB_SSL_STRICT=1 makes the server verify the database's TLS certificate. Turn it on once you have confirmed your database host supports it.
const pool=new Pool({max:10,connectionString:process.env.DATABASE_URL,ssl:PROD?{rejectUnauthorized:process.env.DB_SSL_STRICT==='1'}:false,
 statement_timeout:10000,query_timeout:15000,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
pool.on('error',e=>console.error('database pool:',e.message));
const LIM=SEC.createLimiter((sql,p)=>pool.query(sql,p));
const tooMany=(k,max,sec)=>LIM.over(k,max,sec);
const RL=n=>Math.max(1,+process.env[n[0]]||n[1]);
const today=()=>new Date().toISOString().slice(0,10);
const okId=s=>typeof s==='string'&&/^p_[0-9a-f]{24}$/.test(s);
const clean=s=>String(s||'Trader').replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,20)||'Trader';
const sha=s=>crypto.createHash('sha256').update(String(s)).digest();
const iph=ip=>crypto.createHash('sha256').update(SECRET+ip).digest('hex').slice(0,16);
const w=f=>(q,r)=>f(q,r).catch(e=>{console.error(e.message);r.status(500).json({error:'server'})});
/* ---------- name moderation (starter list: extend it as you learn) ---------- */
const LONG=['fuck','bitch','asshole','pussy','nigger','nigga','faggot','whore','slut','rapist','porn','nazi','hitler','bastard','dickhead','ashawo','oloshi'];
const COUNTRIES=['NG','GH','KE','ZA','EG','SN','CI','CM','UG','TZ','RW','GB','US','CA','IN','AE','DE','FR','BR','OTHER'];
const SHORT=new Set(['shit','cunt','ass','dick','sex','rape','kill','mumu','admin','owner','haggle','official','support','moderator','mod','staff','claude','anthropic']);
const leet=t=>t.toLowerCase().replace(/0/g,'o').replace(/[1!|]/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/[5$]/g,'s').replace(/7/g,'t');
const dedupe=t=>t.replace(/(.)\1+/g,'$1');
function badName(raw){
 raw=String(raw);const tokens=leet(raw).split(/[^a-z]+/).filter(Boolean),jl=tokens.join('');
 if(/\d{6,}/.test(raw.replace(/\s/g,''))||/https?|www|\.com/i.test(raw))return true;
 if(tokens.some(t=>SHORT.has(t)||SHORT.has(dedupe(t))))return true;
 return LONG.some(w=>jl.includes(w)||dedupe(jl).includes(dedupe(w)));
}
/* ---------- brand safety for sponsors (starter rules: extend as you learn) ---------- */
const AD_CATS=['food','non-alcoholic drinks','household','personal care','phone accessories','fashion','education','general services'];
const AD_BLOCK=/(alcohol|beer|wine|whisk|vodka|liquor|tobacco|cigar|vape|betting|casino|lottery|gambl|loan|forex|crypto|invest|adult|weapon|gun|cure|miracle|slimming|political|vote)/i;
function safeAd(b){
 const t=[b.brand,b.product,b.tagline].map(x=>String(x||'')).join(' ');
 if(!AD_CATS.includes(String(b.category||'')))return'category not allowed';
 if(AD_BLOCK.test(leet(t)))return'restricted product or claim';
 if(['brand','product','tagline'].some(k=>b[k]&&badName(b[k])))return'language, impersonation or contact details not allowed';
 return null;
}
const refOf=id=>crypto.createHmac('sha256',SECRET).update('ref'+id).digest('hex').slice(0,12);
// Owner access is a short-lived session token obtained from POST /api/admin/login (key + one-time code). The key itself is never sent on later requests.
async function adminOK(q,r){
 const t=q.get('x-admin-token');
 if(!SEC.okToken(t)){r.status(401).json({error:'no'});return false}
 await ready;
 const x=await pool.query('select 1 from admin_sessions where h=$1 and expires>now()',[SEC.tokHash(t)]);
 if(!x.rowCount){r.status(401).json({error:'no'});return false}
 return true;
}
const audit=(q,action,detail)=>pool.query('insert into admin_audit(ip,action,detail) values($1,$2,$3)',[iph(q.ip),action,String(detail||'').slice(0,200)]).catch(e=>console.error('audit:',e.message));
const RATE=+process.env.RATE_MAX||600; // per IP per minute; high because many phones share one mobile-network address
const hits=new Map(),seen=new Map();
const lim=(m,k,max)=>{const t=Date.now(),a=(m.get(k)||[]).filter(x=>t-x<6e4);a.push(t);m.set(k,a);return a.length>max};
app.use('/api',(q,r,n)=>lim(hits,q.ip,RATE)?r.status(429).json({error:'slow down'}):n());
// Only your own website may post to the API (set ALLOWED_ORIGINS to your Netlify URL and any custom domain).
const ORIGINS=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim().replace(/\/+$/,'')).filter(Boolean);
// This only stops OTHER WEBSITES from using visitors' browsers against your API. A script can fake the header, so it is not bot protection (accounts and rate limits are).
if(PROD&&!ORIGINS.length){console.error('ALLOWED_ORIGINS is not set. Refusing to start: set it to your site address, e.g. https://haggle.netlify.app');process.exit(1)}
for(const o of ORIGINS){let u;try{u=new URL(o)}catch(e){}if(!u||u.origin!==o||(PROD&&u.protocol!=='https:')){console.error('ALLOWED_ORIGINS has an invalid entry: '+o+' (use the form https://example.com, no path)');process.exit(1)}}
app.use('/api',(q,r,n)=>q.method==='POST'&&ORIGINS.length&&!ORIGINS.includes(q.get('origin')||'')?r.status(403).json({error:'origin'}):n());
setInterval(()=>{const t=Date.now();for(const[k,a]of hits)if(!a.some(x=>t-x<6e4))hits.delete(k);for(const[k,v]of seen)if(t-v>6e5)seen.delete(k)},6e4).unref();

/* ---------- game engine lives in engine.js (rules, money, scoring) ---------- */
const E=require('./engine').createEngine(SECRET);
const {START,PER,DAYS,P,PM}=E,view=E.view,fresh=E.fresh,apply=E.apply;

/* ---------- storage ---------- */
const SCHEMA=`
create table if not exists players(id text primary key,name text,first_seen date default current_date,last_seen timestamptz default now());
create table if not exists presence(id text primary key,last_seen timestamptz not null);
create table if not exists daily_active(day date,id text,primary key(day,id));
create table if not exists ranked_runs(day date,id text,ip text,primary key(day,id));
create table if not exists runs(id text primary key,player text not null,mode text,day date,ranked boolean default false,state jsonb,status text default 'active',ip text,started timestamptz default now(),updated timestamptz default now());
create index if not exists runs_player on runs(player);
create table if not exists scores(day date,id text,name text,score int,primary key(day,id));
alter table players add column if not exists banned boolean default false;
alter table scores add column if not exists ref text;
alter table scores add column if not exists hidden boolean default false;
alter table players add column if not exists country text;
alter table scores add column if not exists country text;
create table if not exists reports(day date,reporter text,target text,created timestamptz default now(),primary key(day,reporter,target));
create index if not exists scores_rank on scores(day,score desc);
create table if not exists campaigns(id serial primary key,token text unique not null,brand text not null,product text not null,tagline text,category text not null,status text not null default 'pending',variants jsonb not null default '[1]',start_day date,end_day date,fee_ngn int default 0,invoice text default 'none',note text,created timestamptz default now());
alter table runs add column if not exists camp_id int;
alter table runs add column if not exists variant int;
alter table scores add column if not exists created timestamptz default now();
create table if not exists accounts(id text primary key,username text not null,username_lc text not null,pass text not null,player text not null,created timestamptz default now());
create unique index if not exists accounts_username_uniq on accounts(username_lc);
create unique index if not exists accounts_player_uniq on accounts(player);
create table if not exists sessions(h text primary key,account text not null,expires timestamptz not null,created timestamptz default now());
create index if not exists sessions_account on sessions(account);
create table if not exists rate_hits(k text not null,w bigint not null,exp timestamptz not null,n int not null default 0,primary key(k,w));
create index if not exists rate_hits_exp on rate_hits(exp);
create table if not exists admin_sessions(h text primary key,expires timestamptz not null,created timestamptz default now());
create table if not exists admin_totp_used(step bigint primary key,at timestamptz default now());
create table if not exists admin_audit(id serial primary key,at timestamptz default now(),ip text,action text,detail text);`;
// retry at boot so a slow database start does not crash the server
// Display names are unique (case-insensitive). The migration is defensive: old duplicate names get a short suffix first.
const MIGRATE=`update players set name=null where name='Trader';
update players p set name=p.name||' '||substr(p.id,3,4) where p.name is not null and exists(select 1 from players q where lower(q.name)=lower(p.name) and q.id<p.id);
create unique index if not exists players_name_uniq on players(lower(name));`;
const ready=(async()=>{
 for(let i=0;;i++){try{await pool.query(SCHEMA);break}catch(e){if(i>=10)throw e;await new Promise(r=>setTimeout(r,2000))}}
 try{await pool.query(MIGRATE)}catch(e){console.error('Name uniqueness index not created:',e.message)}
})();
ready.catch(e=>{console.error('Database not reachable:',e.message);process.exit(1)});
setInterval(()=>pool.query("delete from presence where last_seen<now()-interval '1 day'; delete from runs where status='active' and updated<now()-interval '2 days'; delete from sessions where expires<now(); delete from rate_hits where exp<now()-interval '1 hour'; delete from admin_sessions where expires<now(); delete from admin_totp_used where at<now()-interval '1 day'; delete from admin_audit where at<now()-interval '365 days'").catch(e=>console.error('cleanup:',e.message)),36e5).unref();

app.post('/api/ping',w(async(q,r)=>{
 const id=q.body&&q.body.id;if(!okId(id))return r.status(400).json({error:'bad id'});
 await ready;
 const prev=seen.get(id),fresh=!prev||Date.now()-prev>6e5;
 let allowed=true;
 if(fresh){ // creating device records is capped per network, so fake IDs cannot fill the database
  const known=(await pool.query('select 1 from players where id=$1',[id])).rowCount;
  allowed=!!known||!(await tooMany('newdev:'+iph(q.ip),RL(['NEW_DEVICES_PER_IP_HOUR',200]),3600));
 }
 if(allowed){
  await pool.query('insert into presence(id,last_seen) values($1,now()) on conflict(id) do update set last_seen=now()',[id]);
  seen.set(id,Date.now());
  if(fresh){
   await pool.query('insert into players(id,name) values($1,$2) on conflict(id) do update set last_seen=now()',[id,null]);
   await pool.query('insert into daily_active(day,id) values($1,$2) on conflict do nothing',[today(),id]);
  }
 }
 r.json({ok:1});
}));
/* ---------- accounts and sessions ---------- */
// A device ID alone is no longer enough for a player who has an account: every action also needs the session token (header x-session).
const SESS_DAYS=RL(['SESSION_DAYS',14]);
const hashGate=SEC.createGate(3,40); // at most 3 password hashes at once, 40 waiting; more get "busy" instead of starving the server
const hashPw=pw=>hashGate(()=>SEC.hashPassword(pw)),checkPw=(pw,h)=>hashGate(()=>SEC.verifyPassword(pw,h));
const DUMMY=hashPw('placeholder-'+crypto.randomBytes(8).toString('hex')).catch(()=>null); // checked when a username does not exist, so timing does not reveal which usernames exist
const busy=(e,r)=>e&&e.busy?(r.status(503).json({error:'busy'}),true):false;
async function playerAuth(q,r,pid){
 const x=await pool.query('select a.id,a.username,exists(select 1 from sessions s where s.h=$2 and s.account=a.id and s.expires>now()) as ok from accounts a where a.player=$1',[pid,SEC.tokHash(q.get('x-session')||'')]);
 const a=x.rows[0];
 if(!a)return{acct:null};
 if(!a.ok){r.status(401).json({error:'sign_in'});return null}
 return{acct:{id:a.id,username:a.username}};
}
async function newSession(accountId){
 const t=SEC.newToken();
 await pool.query('insert into sessions(h,account,expires) values($1,$2,now()+make_interval(days=>$3::int))',[SEC.tokHash(t),accountId,SESS_DAYS]);
 await pool.query('delete from sessions where account=$1 and h not in (select h from sessions where account=$1 order by created desc limit 5)',[accountId]);
 return t;
}
app.post('/api/auth/register',w(async(q,r)=>{
 r.set('Cache-Control','no-store');
 const b=q.body||{};if(!okId(b.id))return r.status(400).json({error:'bad id'});
 const un=typeof b.username==='string'?b.username.trim():'',pw=b.password;
 const e1=SEC.usernameProblem(un)||(badName(un)?'name_not_allowed':null)||SEC.passwordProblem(pw,un);
 if(e1)return r.status(400).json({error:e1});
 await ready;
 if(await tooMany('reg-ip:'+iph(q.ip),RL(['REGISTER_PER_IP_DAY',20]),86400)||await tooMany('reg-all',RL(['REGISTER_PER_HOUR_ALL',300]),3600))return r.status(429).json({error:'slow down'});
 if((await pool.query('select 1 from accounts where player=$1',[b.id])).rowCount)return r.status(409).json({error:'already_registered'});
 let h;try{h=await hashPw(pw)}catch(e){if(busy(e,r))return;throw e}
 const aid=crypto.randomBytes(16).toString('hex');
 try{
  await pool.query('insert into players(id,name) values($1,null) on conflict(id) do nothing',[b.id]);
  await pool.query('insert into accounts(id,username,username_lc,pass,player) values($1,$2,$3,$4,$5)',[aid,un,un.toLowerCase(),h,b.id]);
 }catch(e){if(e.code==='23505')return r.status(409).json({error:/player/.test(e.constraint||'')?'already_registered':'username_taken'});throw e}
 const token=await newSession(aid);
 r.json({ok:1,token,id:b.id,username:un,days:SESS_DAYS});
}));
app.post('/api/auth/login',w(async(q,r)=>{
 r.set('Cache-Control','no-store');
 const b=q.body||{},un=typeof b.username==='string'?b.username.trim():'',pw=typeof b.password==='string'?b.password:'';
 if(!un||un.length>40||!pw||pw.length>128)return r.status(401).json({error:'bad_login'});
 await ready;
 const uk='login-user:'+crypto.createHash('sha256').update(un.toLowerCase()).digest('hex').slice(0,24);
 // Per address (any attempt) and per username (failures only): many addresses guessing one account still hit the username limit.
 if(await tooMany('login-ip:'+iph(q.ip),RL(['LOGIN_PER_IP_15MIN',40]),900)||await LIM.count(uk,900)>=RL(['LOGIN_FAILS_PER_USER_15MIN',10]))return r.status(429).json({error:'slow down'});
 const a=(await pool.query('select id,pass,player,username from accounts where username_lc=$1',[un.toLowerCase()])).rows[0];
 let ok=false;
 try{const stored=a?a.pass:await DUMMY;ok=stored?await checkPw(pw,stored):false}catch(e){if(busy(e,r))return;throw e}
 if(!a||!ok){await LIM.hit(uk,900);return r.status(401).json({error:'bad_login'})}
 const token=await newSession(a.id);
 r.json({ok:1,token,id:a.player,username:a.username,days:SESS_DAYS});
}));
app.post('/api/auth/logout',w(async(q,r)=>{
 const t=q.get('x-session');
 if(SEC.okToken(t)){await ready;await pool.query('delete from sessions where h=$1',[SEC.tokHash(t)])}
 r.json({ok:1});
}));
/* ---------- owner login: key + one-time code -> short session token ---------- */
const ADMIN_MIN=RL(['ADMIN_SESSION_MIN',30]);
app.post('/api/admin/login',w(async(q,r)=>{
 r.set('Cache-Control','no-store');
 const b=q.body||{};await ready;const ip=iph(q.ip);
 // The key is long and random, so guessing it online is not realistic; these limits stop noise and brute-forcing the 6-digit code.
 // The all-addresses limit is deliberately high so an attacker cannot lock the owner out by failing on purpose.
 if(await LIM.count('adm-fail-ip:'+ip,900)>=5||await LIM.count('adm-fail-all',900)>=100){audit(q,'login_locked','');return r.status(429).json({error:'locked'})}
 const keyOK=crypto.timingSafeEqual(sha(String(b.key==null?'':b.key)),sha(ADMIN));
 const step=TOTP?SEC.verifyTotp(TOTP,String(b.code==null?'':b.code),Date.now()):0;
 let ok=keyOK&&step!==null;
 if(ok&&TOTP){const u=await pool.query('insert into admin_totp_used(step) values($1) on conflict do nothing',[step]);if(!u.rowCount)ok=false} // each code works once
 if(!ok){await LIM.hit('adm-fail-ip:'+ip,900);await LIM.hit('adm-fail-all',900);audit(q,'login_failed',keyOK?'code':'key');return r.status(401).json({error:'no'})}
 const t=SEC.newToken();
 await pool.query('insert into admin_sessions(h,expires) values($1,now()+make_interval(mins=>$2::int))',[SEC.tokHash(t),ADMIN_MIN]);
 await pool.query('delete from admin_sessions where h not in (select h from admin_sessions order by created desc limit 3)');
 audit(q,'login_ok','');
 r.json({token:t,minutes:ADMIN_MIN});
}));
app.post('/api/admin/logout',w(async(q,r)=>{
 const t=q.get('x-admin-token');
 if(SEC.okToken(t)){await ready;await pool.query('delete from admin_sessions where h=$1',[SEC.tokHash(t)]);audit(q,'logout','')}
 r.json({ok:1});
}));
app.get('/api/admin/audit',w(async(q,r)=>{
 if(!await adminOK(q,r))return;await ready;
 r.set('Cache-Control','no-store').json({rows:(await pool.query('select at::text,ip,action,detail from admin_audit order by id desc limit 100')).rows});
}));
const memo=new Map();
const bust=()=>{for(const k of memo.keys())if(k.startsWith('lb'))memo.delete(k)};
const cached=async(k,ms,f)=>{const m=memo.get(k);if(m&&Date.now()-m.t<ms)return m.v;const v=await f();memo.set(k,{t:Date.now(),v});return v};
app.use('/healthz',(q,r,n)=>lim(hits,'hz:'+q.ip,60)?r.status(429).send('slow down'):n()); // unauthenticated and touches the database, so it is capped per address
app.get('/healthz',w(async(q,r)=>{await pool.query('select 1');r.send('ok')}));
app.get('/api/stats',w(async(q,r)=>{
 await ready;
 const x=await cached('stats',5000,async()=>(await pool.query("select (select count(*) from presence where last_seen>now()-interval '70 seconds')::int now,(select count(*) from daily_active where day=$1)::int today,(select count(*) from players)::int total",[today()])).rows[0]);
 r.set('Cache-Control','no-store').json({playingNow:x.now,today:x.today,total:x.total});
}));
app.get('/api/leaderboard',w(async(q,r)=>{
 await ready;const wk=q.query.range==='week',cc=COUNTRIES.includes(q.query.country)?q.query.country:null;
 const rows=await cached('lb:'+(wk?'w':'t')+(cc||''),5000,async()=>wk
  ?(await pool.query("select case when bool_or(hidden) then 'Hidden name' else max(name) end as name,sum(score)::int as daily,ref,count(*)::int days,max(country) country from scores where day>current_date-7 and ($1::text is null or country=$1) group by ref order by sum(score) desc,min(created) asc limit 20",[cc])).rows
  :(await pool.query("select case when hidden then 'Hidden name' else name end as name,score as daily,ref,country from scores where day=$1 and ($2::text is null or country=$2) order by score desc,created asc limit 20",[today(),cc])).rows);
 r.set('Cache-Control','no-store').json({rows});
}));
app.post('/api/me/profile',w(async(q,r)=>{
 const id=q.body&&q.body.id;if(!okId(id))return r.status(400).json({error:'bad'});await ready;
 const A=await playerAuth(q,r,id);if(!A)return;
 const d=await pool.query("select distinct day::text d from runs where player=$1 and status='done' order by d desc limit 90",[id]);
 const days=new Set(d.rows.map(x=>x.d));let streak=0,cur=new Date(today()+'T00:00:00Z');
 if(!days.has(cur.toISOString().slice(0,10)))cur=new Date(cur-864e5);
 while(days.has(cur.toISOString().slice(0,10))){streak++;cur=new Date(cur-864e5)}
 const b=await pool.query('select max(score) best from scores where id=$1',[id]);
 const p=await pool.query("select count(*)::int n from runs where player=$1 and status='done'",[id]);
 r.json({streak,plays:p.rows[0].n,bestRanked:b.rows[0].best,account:A.acct?A.acct.username:null});
}));
const pickCampaign=()=>cached('camp',30000,async()=>(await pool.query("select * from campaigns where status='live' and (start_day is null or start_day<=current_date) and (end_day is null or end_day>=current_date)")).rows).then(rs=>rs.length?rs[Math.floor(Math.random()*rs.length)]:null);
app.post('/api/run/start',w(async(q,r)=>{
 const b=q.body||{};if(!okId(b.id))return r.status(400).json({error:'bad id'});
 await ready;
 const A=await playerAuth(q,r,b.id);if(!A)return;
 if(b.resume){
  const x=await pool.query('select * from runs where id=$1 and player=$2',[String(b.resume),b.id]);
  return x.rows[0]&&x.rows[0].state.v===2?r.json(view(x.rows[0].state,x.rows[0])):r.status(x.rows[0]?410:404).json({error:x.rows[0]?'old_version':'gone'});
 }
 if(await tooMany('start-p:'+b.id,RL(['START_PER_PLAYER_HOUR',60]),3600)||await tooMany('start-ip:'+iph(q.ip),RL(['START_PER_IP_HOUR',300]),3600))return r.status(429).json({error:'slow down'});
 const raw=String(b.name==null?'':b.name),norm=raw.replace(/\s+/g,' ').trim(),cc=COUNTRIES.includes(b.country)?b.country:'OTHER',nameNote='';
 let nm=norm;
 if(norm){
  if(norm.length>20)return r.status(400).json({error:'name_too_long'});
  if(clean(norm)!==norm)return r.status(400).json({error:'name_invalid_chars'});
  if(norm.length<3)return r.status(400).json({error:'name_too_short'});
  if(badName(norm))return r.status(400).json({error:'name_not_allowed'});
 }else nm='Trader '+b.id.slice(2,10);
 const tk=await pool.query('select 1 from players where lower(name)=lower($1) and id<>$2',[nm,b.id]);
 if(tk.rowCount)return r.status(409).json({error:'name_taken'});
 try{await pool.query('insert into players(id,name,country) values($1,$2,$3) on conflict(id) do update set name=$2,country=$3,last_seen=now()',[b.id,nm,cc])}
 catch(e){if(e.code==='23505')return r.status(409).json({error:'name_taken'});throw e}
 const day=today(),ip=iph(q.ip);let ranked=false,note='';
 const bn=await pool.query('select banned from players where id=$1',[b.id]);
 if(b.mode==='daily'&&RANK_ACCT&&!A.acct)note='Ranked play needs a free account. Create one or sign in, then start again. This is a practice run.';
 else if(b.mode==='daily'&&bn.rows[0]&&bn.rows[0].banned)note='Ranked play is turned off for this device.';
 else if(b.mode==='daily'){
  const used=await pool.query('select 1 from ranked_runs where day=$1 and id=$2',[day,b.id]);
  const n=await pool.query('select count(*)::int n from ranked_runs where day=$1 and ip=$2',[day,ip]);
  if(used.rowCount)note="You already used today's ranked run, so this is a practice run.";
  else if(n.rows[0].n>=3)note='Too many ranked runs from this network today, so this is a practice run.';
  else try{await pool.query('insert into ranked_runs(day,id,ip) values($1,$2,$3)',[day,b.id,ip]);ranked=true}catch(e){note="You already used today's ranked run, so this is a practice run."}
 }
 const id=crypto.randomBytes(16).toString('hex'),s=fresh(ranked,day,id);s.note=(note+' '+nameNote).trim();
 const camp=await pickCampaign();let vi=null;
 if(camp){const vs=camp.variants;let mult=1;if(!ranked){vi=Math.floor(Math.random()*vs.length);mult=vs[vi]}
  s.camp={id:camp.id,variant:vi,mult};s.sponsor={brand:camp.brand,product:camp.product,tagline:camp.tagline||''}}
 await pool.query('insert into runs(id,player,mode,day,ranked,state,ip,camp_id,variant) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,b.id,ranked?'daily':'practice',day,ranked,s,ip,s.camp?s.camp.id:null,vi]);
 r.json(view(s,{id,ranked}));
}));
app.post('/api/run/act',w(async(q,r)=>{
 const b=q.body||{};if(!okId(b.id)||!/^[0-9a-f]{32}$/.test(b.runId||''))return r.status(400).json({error:'bad'});
 await ready;const A=await playerAuth(q,r,b.id);if(!A)return;const c=await pool.connect();
 try{
  await c.query('begin');
  const x=await c.query('select * from runs where id=$1 for update',[b.runId]),run=x.rows[0];
  if(!run||run.player!==b.id||run.status!=='active'){await c.query('rollback');return r.status(404).json({error:'no run'})}
  const s=run.state,now=Date.now();
  if(s.v!==2){await c.query('rollback');return r.status(410).json({error:'old_version'})}
  if(now-s.last<200){await c.query('rollback');return r.status(429).json({error:'too fast'})}
  s.last=now;
  const err=apply(s,b);
  if(err){await c.query('rollback');return r.status(400).json({error:err})}
  let ranked=run.ranked,status='active';
  if(s.phase==='final'){
   status='done';
   if(ranked&&now-s.t0>=MIN_RANK_MS){
    const nm=await c.query('select name,country from players where id=$1',[b.id]);
    await c.query('insert into scores(day,id,name,score,ref,country) values($1,$2,$3,$4,$5,$6) on conflict do nothing',[run.day,b.id,(nm.rows[0]&&nm.rows[0].name)||'Trader',s.score,refOf(b.id),(nm.rows[0]&&nm.rows[0].country)||'OTHER']);
   }else if(ranked){ranked=false;s.note='Finished too quickly to be ranked.'}
  }
  await c.query('update runs set state=$2,status=$3,ranked=$4,updated=now() where id=$1',[b.runId,s,status,ranked]);
  await c.query('commit');
  r.json(view(s,{id:b.runId,ranked}));
 }catch(e){try{await c.query('rollback')}catch(_){}throw e}finally{c.release()}
}));
app.get('/api/admin',w(async(q,r)=>{
 if(!await adminOK(q,r))return;await ready;
 const t=await pool.query(`select (select count(*) from players)::int visitors,
  (select count(distinct player) from runs where status='done')::int testers,
  (select count(*) from runs where status='done')::int plays,
  (select count(*) from (select player from runs where status='done' group by player having count(distinct day)>=2) z)::int repeat_players,
  (select count(*) from ranked_runs where day=$1)::int ranked_today,
  (select count(*) from presence where last_seen>now()-interval '70 seconds')::int playing_now`,[today()]);
 const d=await pool.query("select day::text,count(*)::int active from daily_active where day>current_date-14 group by day order by day");
 const rt=await pool.query(`with f as (select id,min(day) d0 from daily_active group by id) select f.d0::text cohort,(current_date-f.d0)::int age,count(*)::int size,count(*) filter(where exists(select 1 from daily_active a where a.id=f.id and a.day=f.d0+1))::int d1,count(*) filter(where exists(select 1 from daily_active a where a.id=f.id and a.day=f.d0+7))::int d7 from f where f.d0>current_date-30 group by f.d0 order by f.d0`);
 const pct=(k,min)=>{const c=rt.rows.filter(x=>x.age>=min),n=c.reduce((a,x)=>a+x.size,0);return n?Math.round(100*c.reduce((a,x)=>a+x[k],0)/n):null};
 const cn=await pool.query("select coalesce(country,'OTHER') country,count(*)::int players from players group by 1 order by 2 desc");
 r.set('Cache-Control','no-store').json({totals:t.rows[0],activeByDay:d.rows,retention:{d1:pct('d1',1),d7:pct('d7',7),cohorts:rt.rows},countries:cn.rows});
}));
app.post('/api/report',w(async(q,r)=>{
 const b=q.body||{};if(!okId(b.id)||!/^[0-9a-f]{12}$/.test(b.ref||''))return r.status(400).json({error:'bad'});
 await ready;const A=await playerAuth(q,r,b.id);if(!A)return;if(refOf(b.id)===b.ref)return r.json({ok:1});
 const ok=await pool.query("select 1 from runs where player=$1 and status='done' limit 1",[b.id]);
 if(!ok.rowCount)return r.status(403).json({error:'play first'});
 const day=today(),c=await pool.query('select count(*)::int n from reports where day=$1 and reporter=$2',[day,b.id]);
 if(c.rows[0].n>=10)return r.status(429).json({error:'limit'});
 const t=await pool.query('select 1 from scores where ref=$1 and day>current_date-7 limit 1',[b.ref]);
 if(!t.rowCount)return r.status(404).json({error:'gone'});
 await pool.query('insert into reports(day,reporter,target) values($1,$2,$3) on conflict do nothing',[day,b.id,b.ref]);
 const n=await pool.query('select count(distinct reporter)::int n from reports where target=$1 and day>current_date-7',[b.ref]);
 if(n.rows[0].n>=3){await pool.query('update scores set hidden=true where ref=$1 and day>current_date-7',[b.ref]);bust()}
 r.json({ok:1});
}));
app.get('/api/admin/reports',w(async(q,r)=>{
 if(!await adminOK(q,r))return;await ready;
 const x=await pool.query('select p.target ref,max(s.name) name,max(s.score) score,bool_or(s.hidden) hidden,count(distinct p.reporter)::int reports from reports p join scores s on s.ref=p.target where p.day>current_date-7 group by p.target order by 5 desc limit 30');
 r.set('Cache-Control','no-store').json({rows:x.rows});
}));
app.post('/api/admin/action',w(async(q,r)=>{
 if(!await adminOK(q,r))return;const b=q.body||{};if(!/^[0-9a-f]{12}$/.test(b.ref||''))return r.status(400).json({error:'bad'});
 await ready;
 if(b.action==='ban'){await pool.query('update players set banned=true where id in (select id from scores where ref=$1)',[b.ref]);await pool.query('delete from scores where ref=$1',[b.ref])}
 else if(b.action==='clear'){await pool.query('update scores set hidden=false where ref=$1',[b.ref]);await pool.query('delete from reports where target=$1',[b.ref])}
 else return r.status(400).json({error:'bad'});
 bust();audit(q,'moderate:'+b.action,b.ref);r.json({ok:1});
}));
// Right to erasure: removes everything tied to this device ID.
app.post('/api/me/delete',w(async(q,r)=>{
 const id=q.body&&q.body.id;if(!okId(id))return r.status(400).json({error:'bad'});await ready;
 const A=await playerAuth(q,r,id);if(!A)return;
 await pool.query('delete from sessions where account in (select id from accounts where player=$1)',[id]);
 await pool.query('delete from accounts where player=$1',[id]);
 for(const[t,c]of[['runs','player'],['scores','id'],['ranked_runs','id'],['daily_active','id'],['presence','id'],['reports','reporter'],['players','id']])await pool.query(`delete from ${t} where ${c}=$1`,[id]);
 seen.delete(id);bust();r.json({ok:1});
}));
app.get('/api/admin/sponsor',w(async(q,r)=>{
 if(!await adminOK(q,r))return;await ready;
 const x=await pool.query(`select l->>'p' p,count(*)::int shoppers,count(*) filter(where l ? 'price')::int sold,count(*) filter(where l ? 'walk')::int walked,count(*) filter(where l ? 'miss')::int nostock,round(avg((l->>'price')::numeric) filter(where l ? 'price'))::int avg_price,round(avg((l->>'max')::numeric) filter(where l ? 'price'))::int avg_max from runs r,jsonb_array_elements(r.state->'log') l where r.status='done' group by 1 order by 1`);
 r.set('Cache-Control','no-store').json({rows:x.rows.map(v=>v.shoppers<30?{p:v.p,shoppers:v.shoppers,hidden:true}:v)});
}));
// Owner-only: confirms the server sees real player addresses behind Netlify and Render (see docs/DEPLOY.md).
app.get('/api/admin/ip',w(async(q,r)=>{if(!await adminOK(q,r))return;r.json({seenAs:q.ip,xForwardedFor:q.get('x-forwarded-for')||null,trustProxy:q.app.get('trust proxy')})}));
/* ---------- public, read-only: rules and aggregated insights ---------- */
app.get('/api/rules',(q,r)=>r.set('Cache-Control','public,max-age=300').json({start:E.START,days:E.DAYS,per:E.PER,liqPct:E.LIQ_PCT,score:E.SCORE,
 campaign:E.CAMPAIGN.map(c=>({t:c.t,d:c.d,obj:c.obj})),products:P.map(p=>({id:p.id,spoil:!!p.spoil}))}));
const MIN_INS=+process.env.MIN_INSIGHT_SHOPPERS||30,MIN_GAMES=+process.env.MIN_INSIGHT_GAMES||10;
app.get('/api/insights',w(async(q,r)=>{
 await ready;
 const v=await cached('insights',60000,async()=>{
  const g=(await pool.query("select count(*)::int n from runs where status='done'")).rows[0].n;
  const l=(await pool.query("select l->>'p' p,count(*)::int shoppers,count(*) filter(where l ? 'price')::int sold,count(*) filter(where l ? 'walk')::int walked,count(*) filter(where l ? 'miss')::int nostock,round(avg((l->>'price')::numeric) filter(where l ? 'price'))::int avg_price,round(avg((l->>'first')::numeric) filter(where l ? 'price'))::int avg_first from runs r,jsonb_array_elements(r.state->'log') l where r.status='done' group by 1 order by 1")).rows;
  const b=(await pool.query("select e.key p,sum(e.value::int)::int bought from runs r,jsonb_each_text(r.state->'bt') e where r.status='done' group by 1")).rows;
  const total=l.reduce((a,x)=>a+x.shoppers,0);
  const rows=l.map(x=>{
   if(g<MIN_GAMES||x.shoppers<MIN_INS)return{p:x.p,hidden:true};
   const bt=(b.find(y=>y.p===x.p)||{}).bought||0;
   return{p:x.p,shoppers:x.shoppers,popularity:Math.round(100*x.shoppers/total),accept_rate:Math.round(100*x.sold/x.shoppers),walk_rate:Math.round(100*x.walked/x.shoppers),nostock_rate:Math.round(100*x.nostock/x.shoppers),
    avg_price:x.avg_price,avg_first:x.avg_first,uplift:x.avg_first?Math.round(100*(x.avg_price-x.avg_first)/x.avg_first):null,turnover:bt?Math.round(100*x.sold/bt)/100:null};
  });
  return{games:g,min_games:MIN_GAMES,min_shoppers:MIN_INS,rows,label:'Simulated activity from game players. These are game prices, not real market prices.'};
 });
 r.set('Cache-Control','public,max-age=60').json(v);
}));
/* ---------- sponsor campaigns: owner-run for now (no self-serve billing) ---------- */
const MIN_N=+process.env.MIN_REPORT_N||30;
app.post('/api/admin/campaign',w(async(q,r)=>{
 if(!await adminOK(q,r))return;const b=q.body||{};await ready;
 const brand=String(b.brand||'').trim().slice(0,40),product=String(b.product||'').trim().slice(0,40),tagline=String(b.tagline||'').trim().slice(0,80);
 if(!brand||!product)return r.status(400).json({error:'brand and product are needed'});
 const why=safeAd({brand,product,tagline,category:b.category});if(why)return r.status(400).json({error:why});
 let vs=Array.isArray(b.variants)?b.variants.map(Number):[1];
 if(!vs.length||vs.length>4||vs.some(v=>!(v>=.5&&v<=1.5)))return r.status(400).json({error:'variants must be 1 to 4 numbers between 0.5 and 1.5'});
 vs=vs.map(v=>Math.round(v*100)/100);
 const d=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')?x:null,fee=Math.max(0,Math.min(1e8,parseInt(b.fee_ngn)||0)),token=crypto.randomBytes(12).toString('hex');
 const x=await pool.query('insert into campaigns(token,brand,product,tagline,category,variants,start_day,end_day,fee_ngn,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id',[token,brand,product,tagline,b.category,JSON.stringify(vs),d(b.start_day),d(b.end_day),fee,String(b.note||'').slice(0,200)]);
 audit(q,'campaign_create',x.rows[0].id);r.json({id:x.rows[0].id,token});
}));
app.post('/api/admin/campaign/action',w(async(q,r)=>{
 if(!await adminOK(q,r))return;const b=q.body||{},id=parseInt(b.id);if(!id)return r.status(400).json({error:'bad'});await ready;
 const m={approve:"status='live'",pause:"status='paused'",resume:"status='live'",end:"status='ended'",unpaid:"invoice='unpaid'",paid:"invoice='paid'"};
 if(!m[b.action])return r.status(400).json({error:'bad action'});
 if(b.action==='approve'||b.action==='resume'){
  const c=await pool.query('select * from campaigns where id=$1',[id]);if(!c.rowCount)return r.status(404).json({error:'gone'});
  const why=safeAd(c.rows[0]);if(why)return r.status(400).json({error:why});
 }
 await pool.query(`update campaigns set ${m[b.action]} where id=$1`,[id]);memo.delete('camp');audit(q,'campaign:'+b.action,id);r.json({ok:1});
}));
app.get('/api/admin/campaigns',w(async(q,r)=>{
 if(!await adminOK(q,r))return;await ready;
 const x=await pool.query("select c.id,c.token,c.brand,c.product,c.tagline,c.category,c.status,c.variants,c.start_day::text start_day,c.end_day::text end_day,c.fee_ngn,c.invoice,(select count(*) from runs r where r.camp_id=c.id)::int served,(select count(*) from runs r where r.camp_id=c.id and r.status='done')::int completed from campaigns c order by c.id desc limit 50");
 r.set('Cache-Control','no-store').json({rows:x.rows});
}));
// Brand-facing report: reached only by an unguessable link, shows one campaign, never player data.
app.get('/api/report/:token',w(async(q,r)=>{
 const t=String(q.params.token||'');if(!/^[0-9a-f]{24}$/.test(t))return r.status(404).json({error:'no'});await ready;
 const c=await pool.query('select id,brand,product,tagline,category,status,variants,start_day::text start_day,end_day::text end_day from campaigns where token=$1',[t]);
 if(!c.rowCount)return r.status(404).json({error:'no'});const cp=c.rows[0];
 const a=await pool.query("select coalesce(variant,-1) v,count(*)::int served,count(*) filter(where status='done')::int runs,coalesce(sum((state->>'spBuy')::int) filter(where status='done'),0)::int units from runs where camp_id=$1 group by 1 order by 1",[cp.id]);
 const l=await pool.query("select coalesce(r.variant,-1) v,count(*)::int shoppers,count(*) filter(where l ? 'price')::int sold,count(*) filter(where l ? 'walk')::int walked,round(avg((l->>'price')::numeric) filter(where l ? 'price'))::int avg_price,round(avg((l->>'gain')::numeric) filter(where l ? 'price'))::int avg_gain from runs r,jsonb_array_elements(r.state->'log') l where r.camp_id=$1 and r.status='done' and l->>'p'='noo' group by 1",[cp.id]);
 const rows=a.rows.map(x=>{const y=l.rows.find(z=>z.v===x.v)||{},ok=x.runs>=MIN_N;
  return Object.assign({variant:x.v,label:x.v<0?'Ranked games (brand shown, prices unchanged)':'Price test: wholesale price x'+cp.variants[x.v],served:x.served,runs:x.runs},ok?{units_bought:x.units,shoppers:y.shoppers||0,sold:y.sold||0,walked:y.walked||0,avg_price:y.avg_price||null,avg_gain:y.avg_gain||null}:{hidden:true})});
 r.set('Cache-Control','no-store').json({campaign:{brand:cp.brand,product:cp.product,tagline:cp.tagline,category:cp.category,status:cp.status,start_day:cp.start_day,end_day:cp.end_day},min_runs:MIN_N,rows,
  disclaimer:'These results come from simulated shoppers and from players who are playing a game. They show how traders in the game reacted to the price tested. They are not real sales data, and they do not predict real-world sales until a pilot with real sales data has checked them.'});
}));
app.use(express.static(path.join(__dirname,'public'),{maxAge:'5m'}));
app.use((err,q,r,n)=>{
 if(r.headersSent)return n(err);
 const c=err&&err.status>=400&&err.status<500?err.status:500;
 if(c===500)console.error('unhandled:',err&&err.message);
 r.status(c).json({error:c===413?'too large':c<500?'bad request':'server'});
});
const srv=app.listen(process.env.PORT||3000,()=>console.log('Haggle up'));
// Slow-connection (slowloris) defences: do not let a client hold a connection open without sending the request.
srv.headersTimeout=15000;srv.requestTimeout=30000;srv.keepAliveTimeout=5000;
module.exports={srv};
