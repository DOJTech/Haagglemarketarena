'use strict';
const express = require('express'), path = require('path'), crypto = require('crypto');
const { createEngine, rules, ENGINE_V } = require('./lib/engine');
const { createModerator, COUNTRIES, NAME_RE, nameKey } = require('./lib/moderation');
const { RateLimiter } = require('./lib/ratelimit');
const MusicLinks = require('./public/musiclinks.js');

const CSP = "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; manifest-src 'self'; worker-src 'self'; media-src 'self' blob: https:; frame-src https://open.spotify.com https://www.youtube-nocookie.com https://embed.music.apple.com https://audiomack.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const SCHEMA = `
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
alter table reports add column if not exists ip text;
create index if not exists scores_rank on scores(day,score desc);
create index if not exists scores_ref on scores(ref);
create index if not exists reports_target on reports(target);
create index if not exists ranked_runs_ip on ranked_runs(day,ip);
create index if not exists runs_status_updated on runs(status,updated);
create index if not exists runs_player_status on runs(player,status);
alter table players add column if not exists name_key text;
create unique index if not exists players_name_key on players(name_key) where name_key is not null;
alter table scores add column if not exists v int default 1;
alter table scores add column if not exists created timestamptz default now();
create table if not exists campaigns(id serial primary key,brand text not null,product text not null,tagline text default '',category text,variants jsonb not null,fee_ngn bigint,status text not null default 'pending',invoice text not null default 'not invoiced',token text unique not null,start_day date,end_day date,created timestamptz default now());
alter table runs add column if not exists cid int;
alter table runs add column if not exists variant int;
create index if not exists runs_cid on runs(cid);
create table if not exists music_picks(id serial primary key,title text not null,url text not null,created timestamptz default now());`;

const log = (level, msg, extra) => console[level === 'error' ? 'error' : 'log'](JSON.stringify(Object.assign({ t: new Date().toISOString(), level, msg }, extra)));
const today = () => new Date().toISOString().slice(0, 10);
const okId = (s) => typeof s === 'string' && /^p_[0-9a-f]{24}$/.test(s);
const okRun = (s) => typeof s === 'string' && /^[0-9a-f]{32}$/.test(s);
const okRef = (s) => typeof s === 'string' && /^[0-9a-f]{12}$/.test(s);

function createApp(cfg, pool) {
  const app = express();
  const eng = createEngine(cfg.secret), mod = createModerator(cfg.extraBlocked);
  const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
  const safeEq = (a, b) => crypto.timingSafeEqual(sha(a || ''), sha(b || ''));
  const iph = (ip) => crypto.createHmac('sha256', cfg.secret).update('ip' + ip).digest('hex').slice(0, 16);
  const refOf = (id) => crypto.createHmac('sha256', cfg.secret).update('ref' + id).digest('hex').slice(0, 12);

  app.disable('x-powered-by');
  app.set('trust proxy', cfg.trustProxy);

  // Boot: create tables (retrying while a fresh database starts), then back-fill any score rows without a public ref.
  pool.on('error', (e) => log('error', 'idle db client error', { err: e.message }));
  const ready = (async () => {
    for (let i = 0; ; i++) {
      try { await pool.query(SCHEMA); break; } catch (e) { if (i >= 10) throw e; await new Promise((r) => setTimeout(r, 2000)); }
    }
    if (!(await pool.query('select 1 from music_picks limit 1')).rowCount) {
      // Starter shelf: community playlists of recent Nigerian hits. The owner can swap these from the owner page.
      for (const [t, u] of [['Afrobeats Hits 2026 (Naija mix)', 'https://open.spotify.com/playlist/0VRrsChND56p77FczOUBbp'], ['Top 100 Nigeria 2025-26', 'https://open.spotify.com/playlist/0p4SHPnykmP4vXjmLCMxj7'], ['Naija Hits 2016-2026', 'https://open.spotify.com/playlist/1ueeLJNKOGIUwEaC7XU1Oy']])
        await pool.query('insert into music_picks(title,url) values($1,$2)', [t, u]);
    }
    const old = await pool.query('select distinct id from scores where ref is null limit 5000');
    for (const row of old.rows) await pool.query('update scores set ref=$2 where id=$1 and ref is null', [row.id, refOf(row.id)]);
  })();

  /* ---------- headers ---------- */
  app.use((q, r, n) => {
    r.set({
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', 'Content-Security-Policy': CSP,
      'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin',
    });
    n();
  });
  app.get('/healthz', (q, r) => { pool.query('select 1').then(() => r.set('Cache-Control', 'no-store').send('ok'), () => r.status(503).send('db')); });

  /* ---------- API guards (order matters: cheap checks first, body parsing last) ---------- */
  app.use('/api', (q, r, n) => { r.set('Cache-Control', 'no-store'); n(); });
  // 1. Only requests that came through your Netlify proxy are accepted (when PROXY_SECRET is set).
  app.use('/api', (q, r, n) => (cfg.proxySecret && !safeEq(q.get('x-proxy-key'), cfg.proxySecret) ? r.status(403).json({ error: 'proxy' }) : n()));
  // 2. Per-IP limit. Generous, because many phones share one mobile-network address.
  const ipLim = new RateLimiter(6e4), devLim = new RateLimiter(6e4), hourLim = new RateLimiter(36e5), failLim = new RateLimiter(9e5);
  app.use('/api', (q, r, n) => {
    if (ipLim.hit(q.ip, cfg.rateMax)) return r.set('Retry-After', String(ipLim.retryAfter(q.ip))).status(429).json({ error: 'slow down' });
    n();
  });
  // 3. Only your own website may POST.
  app.use('/api', (q, r, n) => (q.method === 'POST' && cfg.origins.length && !cfg.origins.includes(q.get('origin') || '') ? r.status(403).json({ error: 'origin' }) : n()));
  app.use('/api', express.json({ limit: '4kb' }));
  const dev = (id, bucket, max) => devLim.hit(bucket + id, max);
  const tooMany = (r) => r.set('Retry-After', '30').status(429).json({ error: 'slow down' });

  const w = (f) => (q, r, n) => f(q, r).catch((e) => { log('error', 'handler failed', { route: q.path, err: e.message }); if (!r.headersSent) r.status(500).json({ error: 'server' }); });

  function adminOK(q, r) {
    const k = 'adm' + q.ip;
    if (failLim.count(k) >= 10) { r.set('Retry-After', '900').status(429).json({ error: 'slow down' }); return false; }
    if (!safeEq(q.get('x-admin-key'), cfg.adminKey)) { failLim.hit(k, 10); r.status(401).json({ error: 'no' }); return false; }
    failLim.clear(k);
    return true;
  }

  /* ---------- background upkeep ---------- */
  const seen = new Map(), memo = new Map();
  const bust = () => { for (const k of memo.keys()) if (k.startsWith('lb')) memo.delete(k); };
  const cached = async (k, ms, f) => { const m = memo.get(k); if (m && Date.now() - m.t < ms) return m.v; const v = await f(); memo.set(k, { t: Date.now(), v }); return v; };
  const sweepTimer = setInterval(() => {
    for (const l of [ipLim, devLim, hourLim, failLim]) l.sweep();
    const t = Date.now(); for (const [k, v] of seen) if (t - v > 6e5) seen.delete(k);
  }, 6e4); sweepTimer.unref();
  async function upkeep() {
    await pool.query("delete from presence where last_seen<now()-interval '1 day'");
    await pool.query("delete from runs where status='active' and updated<now()-interval '2 days'");
    await pool.query("delete from ranked_runs where day<current_date-7");
    await pool.query("delete from reports where day<current_date-30");
    await pool.query("delete from runs where status='done' and updated<now()-make_interval(days=>$1)", [cfg.retentionDays]);
  }
  const upkeepTimer = setInterval(() => upkeep().catch((e) => log('error', 'upkeep failed', { err: e.message })), 36e5); upkeepTimer.unref();

  /* ---------- public routes ---------- */
  app.post('/api/ping', w(async (q, r) => {
    const id = q.body && q.body.id; if (!okId(id)) return r.status(400).json({ error: 'bad id' });
    if (dev(id, 'ping', 12)) return tooMany(r);
    await ready;
    const first = !seen.has(id);
    if (first) {   // stop one address from minting thousands of fake players
      const ex = await pool.query('select 1 from players where id=$1', [id]);
      if (!ex.rowCount && hourLim.hit('new' + iph(q.ip), cfg.newIdPerIpHour)) return tooMany(r);
    }
    await pool.query('insert into presence(id,last_seen) values($1,now()) on conflict(id) do update set last_seen=now()', [id]);
    const prev = seen.get(id); seen.set(id, Date.now());
    if (!prev || Date.now() - prev > 6e5) {
      await pool.query('insert into players(id) values($1) on conflict(id) do update set last_seen=now()', [id]);
      await pool.query('insert into daily_active(day,id) values($1,$2) on conflict do nothing', [today(), id]);
    }
    r.json({ ok: 1 });
  }));

  app.get('/api/stats', w(async (q, r) => {
    await ready;
    const x = await cached('stats', 5000, async () => (await pool.query("select (select count(*) from presence where last_seen>now()-interval '70 seconds')::int now,(select count(*) from daily_active where day=$1)::int today,(select count(*) from players)::int total", [today()])).rows[0]);
    r.json({ playingNow: x.now, today: x.today, total: x.total });
  }));

  app.get('/api/leaderboard', w(async (q, r) => {
    await ready;
    const wk = q.query.range === 'week', cc = COUNTRIES.includes(q.query.country) ? q.query.country : null;
    // Ties go to whoever finished first.
    const rows = await cached('lb:' + (wk ? 'w' : 't') + (cc || ''), 5000, async () => wk
      ? (await pool.query("select case when bool_or(hidden) then 'Hidden name' else max(name) end as name,sum(score)::int as daily,ref,count(*)::int days,max(country) country from scores where day>current_date-7 and v=" + ENGINE_V + " and ref is not null and ($1::text is null or country=$1) group by ref order by sum(score) desc, max(created) asc limit 20", [cc])).rows
      : (await pool.query("select case when hidden then 'Hidden name' else name end as name,score as daily,ref,country from scores where day=$1 and v=" + ENGINE_V + " and ref is not null and ($2::text is null or country=$2) order by score desc, created asc limit 20", [today(), cc])).rows);
    r.json({ rows });
  }));

  // Public, fixed facts about the game (How it works shows these).
  app.get('/api/rules', (q, r) => { r.set('Cache-Control', 'public, max-age=300'); r.json(rules()); });

  // Anonymous market insights from finished games. Nothing shows until there are enough games and shoppers.
  const MIN_GAMES = 30, MIN_SHOPPERS = 30, MIN_RUNS = 30;
  app.get('/api/insights', w(async (q, r) => {
    await ready;
    const V = String(ENGINE_V);
    const out = await cached('insights', 60000, async () => {
      const g = (await pool.query("select count(*)::int n from runs where status='done' and state->>'v'=$1", [V])).rows[0].n;
      if (g < MIN_GAMES) return { games: g, min_games: MIN_GAMES, min_shoppers: MIN_SHOPPERS, rows: [] };
      const lg = await pool.query(`select x->>'p' p,count(*)::int shoppers,count(*) filter(where x ? 'price')::int sold,count(*) filter(where x ? 'walk')::int walked,
        round(avg((x->>'first')::numeric) filter(where x ? 'first'))::int avg_first,round(avg((x->>'price')::numeric) filter(where x ? 'price'))::int avg_price,
        avg((x->>'first')::numeric) filter(where x ? 'price') first_sold
        from runs r,jsonb_array_elements(r.state->'log') x where r.status='done' and r.state->>'v'=$1 group by 1 order by 1`, [V]);
      const bt = await pool.query("select e.key p,sum(e.value::int)::int bought from runs r,jsonb_each_text(r.state->'tot'->'bought') e where r.status='done' and r.state->>'v'=$1 group by 1", [V]);
      const bought = Object.fromEntries(bt.rows.map((x) => [x.p, x.bought])), total = lg.rows.reduce((a, x) => a + x.shoppers, 0);
      return { games: g, min_games: MIN_GAMES, min_shoppers: MIN_SHOPPERS, rows: lg.rows.map((x) => (x.shoppers < MIN_SHOPPERS ? { p: x.p, hidden: true } : {
        p: x.p, shoppers: x.shoppers, popularity: Math.round(100 * x.shoppers / total), accept_rate: Math.round(100 * x.sold / x.shoppers), walk_rate: Math.round(100 * x.walked / x.shoppers),
        avg_first: x.avg_first, avg_price: x.avg_price, uplift: x.sold && x.first_sold ? Math.round(1000 * (x.avg_price / Number(x.first_sold) - 1)) / 10 : null,
        turnover: bought[x.p] > 0 ? Math.round(10 * x.sold / bought[x.p]) / 10 : null })) };
    });
    r.json(out);
  }));

  app.post('/api/me/profile', w(async (q, r) => {
    const id = q.body && q.body.id; if (!okId(id)) return r.status(400).json({ error: 'bad' });
    if (dev(id, 'prof', 30)) return tooMany(r);
    await ready;
    const d = await pool.query("select distinct day::text d from runs where player=$1 and status='done' order by d desc limit 90", [id]);
    const days = new Set(d.rows.map((x) => x.d)); let streak = 0, cur = new Date(today() + 'T00:00:00Z');
    if (!days.has(cur.toISOString().slice(0, 10))) cur = new Date(cur - 864e5);
    while (days.has(cur.toISOString().slice(0, 10))) { streak++; cur = new Date(cur - 864e5); }
    const b = await pool.query('select max(score) best from scores where id=$1', [id]);
    const p = await pool.query("select count(*)::int n from runs where player=$1 and status='done'", [id]);
    r.json({ streak, plays: p.rows[0].n, bestRanked: b.rows[0].best });
  }));

  app.post('/api/run/start', w(async (q, r) => {
    const b = q.body || {}; if (!okId(b.id)) return r.status(400).json({ error: 'bad id' });
    if (dev(b.id, 'start', 20)) return tooMany(r);
    await ready;
    if (b.resume) {
      if (!okRun(b.resume)) return r.status(404).json({ error: 'gone' });
      const x = await pool.query('select * from runs where id=$1 and player=$2', [b.resume, b.id]), row = x.rows[0];
      if (!row) return r.status(404).json({ error: 'gone' });
      if (!row.state || row.state.v !== ENGINE_V) return r.status(410).json({ error: 'old_version' });
      return r.json(eng.view(row.state, row));
    }
    const cc = COUNTRIES.includes(b.country) ? b.country : 'OTHER';
    // Display names are unique. A blank name means "give me an automatic one".
    const raw = String(b.name == null ? '' : b.name).replace(/\s+/g, ' ').trim(), auto = !raw;
    let nm = null, key = null;
    if (!auto) {
      if (raw.length > 20) return r.status(400).json({ error: 'name_too_long' });
      if (raw.replace(NAME_RE, '') !== raw) return r.status(400).json({ error: 'name_invalid_chars' });
      if (raw.length < 3) return r.status(400).json({ error: 'name_too_short' });
      key = nameKey(raw);
      if (key.length < 3) return r.status(400).json({ error: 'name_invalid_chars' });
      if (mod.bad(raw)) return r.status(400).json({ error: 'name_not_allowed' });
      nm = raw;
    }
    const day = today(), ip = iph(q.ip), c = await pool.connect();
    try {
      await c.query('begin');
      if (auto) {
        for (let n = 4; n <= 12; n += 2) {
          nm = 'Trader ' + b.id.slice(2, 2 + n); key = nameKey(nm);
          if (!(await c.query('select 1 from players where name_key=$1 and id<>$2', [key, b.id])).rowCount) break;
        }
      } else if ((await c.query('select 1 from players where name_key=$1 and id<>$2', [key, b.id])).rowCount) {
        await c.query('rollback'); return r.status(409).json({ error: 'name_taken' });
      }
      await c.query('insert into players(id,name,name_key,country) values($1,$2,$3,$4) on conflict(id) do update set name=$2,name_key=$3,country=$4,last_seen=now()', [b.id, nm, key, cc]);
      const bn = await c.query('select banned from players where id=$1', [b.id]);
      let ranked = false, note = '';
      if (b.mode === 'daily') {
        if (bn.rows[0] && bn.rows[0].banned) note = 'Ranked play is turned off for this device.';
        else {
          // One lock per network and day makes the "3 ranked runs per network" rule exact even under parallel requests.
          await c.query('select pg_advisory_xact_lock(hashtext($1))', ['rk' + day + ip]);
          const used = await c.query('select 1 from ranked_runs where day=$1 and id=$2', [day, b.id]);
          const n = await c.query('select count(*)::int n from ranked_runs where day=$1 and ip=$2', [day, ip]);
          if (used.rowCount) note = "You already used today's ranked run, so this is a practice run.";
          else if (n.rows[0].n >= cfg.rankedPerIp) note = 'Too many ranked runs from this network today, so this is a practice run.';
          else { await c.query('insert into ranked_runs(day,id,ip) values($1,$2,$3)', [day, b.id, ip]); ranked = true; }
        }
      }
      // An approved sponsor appears in every game; wholesale-price tests run only in practice games.
      let sponsor = null, variant = null, mult = 1, cid = null;
      const cp = await c.query("select id,brand,product,tagline,variants from campaigns where status='live' order by random() limit 1");
      if (cp.rows[0]) {
        const k = cp.rows[0]; cid = k.id; sponsor = { brand: k.brand, product: k.product, tagline: k.tagline };
        if (ranked) variant = -1; else { variant = crypto.randomInt(k.variants.length); mult = Number(k.variants[variant]) || 1; }
      }
      const id = crypto.randomBytes(16).toString('hex'), s = eng.fresh(ranked, day, id, { mult, sponsor, variant, cid });
      s.note = note;
      await c.query('insert into runs(id,player,mode,day,ranked,state,ip,cid,variant) values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, b.id, ranked ? 'daily' : 'practice', day, ranked, s, ip, cid, variant]);
      // Keep at most 5 unfinished practice runs per player so the database cannot be filled with abandoned runs.
      await c.query("delete from runs where player=$1 and status='active' and not ranked and id not in (select id from runs where player=$1 and status='active' order by started desc limit 5)", [b.id]);
      await c.query('commit');
      r.json(eng.view(s, { id, ranked }));
    } catch (e) {
      try { await c.query('rollback'); } catch (_) {}
      if (e.code === '23505' && /name_key/.test(String(e.constraint || e.detail || ''))) return r.status(409).json({ error: 'name_taken' });
      throw e;
    } finally { c.release(); }
  }));

  app.post('/api/run/act', w(async (q, r) => {
    const b = q.body || {}; if (!okId(b.id) || !okRun(b.runId)) return r.status(400).json({ error: 'bad' });
    if (dev(b.id, 'act', 240)) return tooMany(r);
    await ready; const c = await pool.connect();
    try {
      await c.query('begin');
      const x = await c.query('select * from runs where id=$1 for update', [b.runId]), run = x.rows[0];
      if (!run || run.player !== b.id || run.status !== 'active') { await c.query('rollback'); return r.status(404).json({ error: 'no run' }); }
      const s = run.state, now = Date.now();
      if (!s || s.v !== ENGINE_V) { await c.query('rollback'); return r.status(410).json({ error: 'old_version' }); }
      if (now - s.last < 200) { await c.query('rollback'); return r.status(429).json({ error: 'too fast' }); }
      s.last = now;
      const err = eng.apply(s, b);
      if (err) { await c.query('rollback'); return r.status(400).json({ error: err }); }
      let ranked = run.ranked, status = 'active', out;
      if (s.phase === 'final') {
        status = 'done';
        const pl = await c.query('select name,country,banned from players where id=$1', [b.id]), p = pl.rows[0] || {};
        if (ranked && p.banned) { ranked = false; s.note = 'Ranked play is turned off for this device.'; }
        else if (ranked && now - s.t0 >= cfg.minRankMs) {
          await c.query('insert into scores(day,id,name,score,ref,country,v) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing', [run.day, b.id, p.name || 'Trader', s.score, refOf(b.id), p.country || 'OTHER', ENGINE_V]);
          bust();
        } else if (ranked) { ranked = false; s.note = 'Finished too quickly to be ranked.'; }
        out = eng.view(s, { id: b.runId, ranked });
        eng.compact(s);   // the hidden week is no longer needed once the run is over
      } else out = eng.view(s, { id: b.runId, ranked });
      await c.query('update runs set state=$2,status=$3,ranked=$4,updated=now() where id=$1', [b.runId, s, status, ranked]);
      await c.query('commit');
      r.json(out);
    } catch (e) { try { await c.query('rollback'); } catch (_) {} throw e; } finally { c.release(); }
  }));

  app.post('/api/report', w(async (q, r) => {
    const b = q.body || {}; if (!okId(b.id) || !okRef(b.ref)) return r.status(400).json({ error: 'bad' });
    if (dev(b.id, 'rep', 10)) return tooMany(r);
    await ready; if (refOf(b.id) === b.ref) return r.json({ ok: 1 });
    const ok = await pool.query("select 1 from runs where player=$1 and status='done' limit 1", [b.id]);
    if (!ok.rowCount) return r.status(403).json({ error: 'play first' });
    const day = today(), c = await pool.query('select count(*)::int n from reports where day=$1 and reporter=$2', [day, b.id]);
    if (c.rows[0].n >= 10) return r.status(429).json({ error: 'limit' });
    const t = await pool.query('select 1 from scores where ref=$1 and day>current_date-7 limit 1', [b.ref]);
    if (!t.rowCount) return r.status(404).json({ error: 'gone' });
    await pool.query('insert into reports(day,reporter,target,ip) values($1,$2,$3,$4) on conflict do nothing', [day, b.id, b.ref, iph(q.ip)]);
    // Hiding needs enough different players AND at least two different networks, so one person cannot hide a rival alone.
    const n = await pool.query('select count(distinct reporter)::int n,count(distinct ip)::int ips from reports where target=$1 and day>current_date-7', [b.ref]);
    if (n.rows[0].n >= cfg.reportHideAt && n.rows[0].ips >= 2) { await pool.query('update scores set hidden=true where ref=$1 and day>current_date-7', [b.ref]); bust(); log('log', 'score auto-hidden', { ref: b.ref }); }
    r.json({ ok: 1 });
  }));

  // Right to erasure: removes everything tied to this device ID.
  app.post('/api/me/delete', w(async (q, r) => {
    const id = q.body && q.body.id; if (!okId(id)) return r.status(400).json({ error: 'bad' });
    if (dev(id, 'del', 5)) return tooMany(r);
    await ready; const c = await pool.connect();
    try {
      await c.query('begin');
      // The daily-limit row loses its link to the device but stays, so deleting data cannot be used to get extra ranked runs.
      await c.query("update ranked_runs set id='x_'||md5(random()::text) where id=$1", [id]);
      for (const [t, col] of [['runs', 'player'], ['scores', 'id'], ['daily_active', 'id'], ['presence', 'id'], ['reports', 'reporter'], ['players', 'id']]) await c.query(`delete from ${t} where ${col}=$1`, [id]);
      await c.query('commit');
    } catch (e) { try { await c.query('rollback'); } catch (_) {} throw e; } finally { c.release(); }
    seen.delete(id); bust(); r.json({ ok: 1 });
  }));

  /* ---------- sponsor campaigns ---------- */
  const CATS = ['food', 'non-alcoholic drinks', 'household', 'personal care', 'phone accessories', 'fashion', 'education', 'general services'];
  const txt = (v, n) => String(v == null ? '' : v).normalize('NFKC').replace(/[^\p{L}\p{N} .,'’&!?()%:+-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, n);
  const okTok = (s) => typeof s === 'string' && /^[0-9a-f]{32}$/.test(s);

  // A sponsor's private report link. The long random token is the only credential, so it is rate limited and never cached.
  app.get('/api/report/:token', w(async (q, r) => {
    if (!okTok(q.params.token)) return r.status(404).json({ error: 'not found' });
    await ready;
    const c = (await pool.query('select * from campaigns where token=$1', [q.params.token])).rows[0];
    if (!c) return r.status(404).json({ error: 'not found' });
    const g = await pool.query("select variant,count(*)::int served,count(*) filter(where status='done')::int runs,coalesce(sum((state->'tot'->'bought'->>'noo')::int) filter(where status='done'),0)::int units_bought from runs where cid=$1 and state->>'v'=$2 group by variant", [c.id, String(ENGINE_V)]);
    const l = await pool.query("select r.variant,count(*)::int shoppers,count(*) filter(where x ? 'price')::int sold,count(*) filter(where x ? 'walk')::int walked,round(avg((x->>'price')::numeric) filter(where x ? 'price'))::int avg_price,round(avg((x->>'gain')::numeric) filter(where x ? 'price'))::int avg_gain from runs r,jsonb_array_elements(r.state->'log') x where r.cid=$1 and r.status='done' and r.state->>'v'=$2 and x->>'p'='noo' group by r.variant", [c.id, String(ENGINE_V)]);
    const byV = Object.fromEntries(l.rows.map((x) => [x.variant, x]));
    const rows = g.rows.sort((a, b) => a.variant - b.variant).map((x) => {
      const label = x.variant === -1 ? 'Ranked games (brand shown, prices unchanged)' : (c.variants[x.variant] + 'x wholesale price');
      if (x.runs < MIN_RUNS) return { label, served: x.served, runs: x.runs, hidden: true };
      const y = byV[x.variant] || {};
      return { label, served: x.served, runs: x.runs, units_bought: x.units_bought, shoppers: y.shoppers || 0, sold: y.sold || 0, walked: y.walked || 0, avg_price: y.avg_price == null ? null : y.avg_price, avg_gain: y.avg_gain == null ? null : y.avg_gain };
    });
    r.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    r.json({ campaign: { brand: c.brand, product: c.product, status: c.status, start_day: c.start_day && c.start_day.toISOString().slice(0, 10), end_day: c.end_day && c.end_day.toISOString().slice(0, 10) }, min_runs: MIN_RUNS, rows,
      disclaimer: 'This is activity from a simulated game. It is not real sales, real market prices or a forecast of real demand, and the groups can be small. Test with real customers before you rely on any of it.' });
  }));

  /* ---------- music shelf ---------- */
  // Only licensed streaming embeds and plain audio links are accepted, so the shelf can never carry other content.
  app.get('/api/music', w(async (q, r) => {
    await ready; const x = await cached('music', 60000, async () => (await pool.query('select id,title,url from music_picks order by id desc limit 30')).rows);
    r.set('Cache-Control', 'public, max-age=300'); r.json({ rows: x });
  }));
  app.get('/api/admin/music', w(async (q, r) => { if (!adminOK(q, r)) return; await ready; r.json({ rows: (await pool.query('select id,title,url from music_picks order by id desc limit 30')).rows }); }));
  app.post('/api/admin/music', w(async (q, r) => {
    if (!adminOK(q, r)) return; await ready;
    const b = q.body || {}, title = txt(b.title, 60), url = String(b.url == null ? '' : b.url).trim().slice(0, 400);
    if (!title) return r.status(400).json({ error: 'A title is required' });
    const p = MusicLinks.parse(url); if (!p) return r.status(400).json({ error: 'Use a Spotify, YouTube, Apple Music or Audiomack link, or a direct https audio file' });
    if ((await pool.query('select count(*)::int n from music_picks')).rows[0].n >= 30) return r.status(400).json({ error: 'The shelf is full (30). Remove one first.' });
    const x = await pool.query('insert into music_picks(title,url) values($1,$2) returning id', [title, url]); memo.delete('music'); r.json({ ok: 1, id: x.rows[0].id });
  }));
  app.post('/api/admin/music/delete', w(async (q, r) => {
    if (!adminOK(q, r)) return; await ready; const id = Number(q.body && q.body.id); if (!Number.isSafeInteger(id)) return r.status(400).json({ error: 'bad' });
    await pool.query('delete from music_picks where id=$1', [id]); memo.delete('music'); r.json({ ok: 1 });
  }));

  /* ---------- owner-only routes ---------- */
  app.get('/api/admin/campaigns', w(async (q, r) => {
    if (!adminOK(q, r)) return; await ready;
    const x = await pool.query("select c.id,c.brand,c.product,c.status,c.invoice,c.token,(select count(*) from runs where cid=c.id)::int served,(select count(*) from runs where cid=c.id and status='done')::int completed from campaigns c order by c.id desc limit 100");
    r.json({ rows: x.rows });
  }));
  app.post('/api/admin/campaign', w(async (q, r) => {
    if (!adminOK(q, r)) return; await ready;
    const b = q.body || {}, brand = txt(b.brand, 40), product = txt(b.product, 40), tagline = txt(b.tagline, 80);
    if (!brand || !product) return r.status(400).json({ error: 'Brand and product are required' });
    if (!CATS.includes(b.category)) return r.status(400).json({ error: 'Pick a category' });
    const vs = [...new Set((Array.isArray(b.variants) ? b.variants : []).map((v) => Math.round(Number(v) * 100) / 100))];
    if (vs.length < 1 || vs.length > 4 || vs.some((v) => !Number.isFinite(v) || v < 0.5 || v > 1.5)) return r.status(400).json({ error: 'Price multipliers must be 1 to 4 numbers between 0.5 and 1.5' });
    const fee = b.fee_ngn === '' || b.fee_ngn == null ? null : Number(b.fee_ngn);
    if (fee !== null && (!Number.isSafeInteger(fee) || fee < 0 || fee > 1e10)) return r.status(400).json({ error: 'Fee must be a whole number of naira' });
    const x = await pool.query('insert into campaigns(brand,product,tagline,category,variants,fee_ngn,token) values($1,$2,$3,$4,$5,$6,$7) returning id', [brand, product, tagline, b.category, JSON.stringify(vs), fee, crypto.randomBytes(16).toString('hex')]);
    log('log', 'campaign created', { id: x.rows[0].id }); r.json({ ok: 1, id: x.rows[0].id });
  }));
  app.post('/api/admin/campaign/action', w(async (q, r) => {
    if (!adminOK(q, r)) return; await ready;
    const b = q.body || {}, id = Number(b.id); if (!Number.isSafeInteger(id)) return r.status(400).json({ error: 'bad' });
    const A = {
      approve: "update campaigns set status='live',start_day=coalesce(start_day,current_date),end_day=null where id=$1 and status in ('pending','paused')",
      pause: "update campaigns set status='paused' where id=$1 and status='live'",
      end: "update campaigns set status='ended',end_day=current_date where id=$1 and status<>'ended'",
      unpaid: "update campaigns set invoice='invoiced' where id=$1",
      paid: "update campaigns set invoice='paid' where id=$1",
    };
    if (!Object.prototype.hasOwnProperty.call(A, b.action)) return r.status(400).json({ error: 'bad' });
    await pool.query(A[b.action], [id]); log('log', 'admin campaign action', { id, action: b.action }); r.json({ ok: 1 });
  }));


  app.get('/api/admin', w(async (q, r) => {
    if (!adminOK(q, r)) return; await ready;
    const t = await pool.query(`select (select count(*) from players)::int visitors,
  (select count(distinct player) from runs where status='done')::int testers,
  (select count(*) from runs where status='done')::int plays,
  (select count(*) from (select player from runs where status='done' group by player having count(distinct day)>=2) z)::int repeat_players,
  (select count(*) from ranked_runs where day=$1)::int ranked_today,
  (select count(*) from presence where last_seen>now()-interval '70 seconds')::int playing_now`, [today()]);
    const d = await pool.query('select day::text,count(*)::int active from daily_active where day>current_date-14 group by day order by day');
    const rt = await pool.query(`with f as (select id,min(day) d0 from daily_active group by id) select f.d0::text cohort,(current_date-f.d0)::int age,count(*)::int size,count(*) filter(where exists(select 1 from daily_active a where a.id=f.id and a.day=f.d0+1))::int d1,count(*) filter(where exists(select 1 from daily_active a where a.id=f.id and a.day=f.d0+7))::int d7 from f where f.d0>current_date-30 group by f.d0 order by f.d0`);
    const pct = (k, min) => { const c = rt.rows.filter((x) => x.age >= min), n = c.reduce((a, x) => a + x.size, 0); return n ? Math.round(100 * c.reduce((a, x) => a + x[k], 0) / n) : null; };
    const cn = await pool.query("select coalesce(country,'OTHER') country,count(*)::int players from players group by 1 order by 2 desc");
    r.json({ totals: t.rows[0], activeByDay: d.rows, retention: { d1: pct('d1', 1), d7: pct('d7', 7), cohorts: rt.rows }, countries: cn.rows });
  }));
  app.get('/api/admin/reports', w(async (q, r) => {
    if (!adminOK(q, r)) return; await ready;
    const x = await pool.query('select p.target ref,max(s.name) name,max(s.score) score,bool_or(s.hidden) hidden,count(distinct p.reporter)::int reports from reports p join scores s on s.ref=p.target where p.day>current_date-7 group by p.target order by 5 desc limit 30');
    r.json({ rows: x.rows });
  }));
  app.post('/api/admin/action', w(async (q, r) => {
    if (!adminOK(q, r)) return; const b = q.body || {}; if (!okRef(b.ref)) return r.status(400).json({ error: 'bad' });
    await ready;
    if (b.action === 'ban') { await pool.query('update players set banned=true where id in (select id from scores where ref=$1)', [b.ref]); await pool.query('delete from scores where ref=$1', [b.ref]); }
    else if (b.action === 'clear') { await pool.query('update scores set hidden=false where ref=$1', [b.ref]); await pool.query('delete from reports where target=$1', [b.ref]); }
    else return r.status(400).json({ error: 'bad' });
    log('log', 'admin action', { action: b.action, ref: b.ref }); bust(); r.json({ ok: 1 });
  }));
  app.get('/api/admin/sponsor', w(async (q, r) => {
    if (!adminOK(q, r)) return; await ready;
    const x = await pool.query(`select l->>'p' p,count(*)::int shoppers,count(*) filter(where l ? 'price')::int sold,count(*) filter(where l ? 'walk')::int walked,count(*) filter(where l ? 'miss')::int nostock,round(avg((l->>'price')::numeric) filter(where l ? 'price'))::int avg_price,round(avg((l->>'max')::numeric) filter(where l ? 'price'))::int avg_max from runs r,jsonb_array_elements(r.state->'log') l where r.status='done' group by 1 order by 1`);
    r.json({ rows: x.rows.map((v) => (v.shoppers < 30 ? { p: v.p, shoppers: v.shoppers, hidden: true } : v)) });
  }));
  // Confirms the server sees real player addresses behind Netlify and Render (see docs/PRODUCTION_CHECKLIST.md).
  app.get('/api/admin/ip', (q, r) => { if (!adminOK(q, r)) return; r.json({ seenAs: q.ip, xForwardedFor: q.get('x-forwarded-for') || null, trustProxy: q.app.get('trust proxy') }); });

  app.use('/api', (q, r) => r.status(404).json({ error: 'not found' }));
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m', dotfiles: 'ignore' }));
  // JSON errors only; never a stack trace.
  app.use((e, q, r, n) => {
    if (r.headersSent) return n(e);
    if (e.type === 'entity.too.large') return r.status(413).json({ error: 'too big' });
    if (e.type === 'entity.parse.failed' || e.status === 400) return r.status(400).json({ error: 'bad json' });
    log('error', 'unhandled', { err: e.message }); r.status(500).json({ error: 'server' });
  });

  return { app, ready, upkeep, stop: () => { clearInterval(sweepTimer); clearInterval(upkeepTimer); } };
}
module.exports = { createApp, log };
