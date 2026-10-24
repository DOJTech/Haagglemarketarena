// Test stand-ins for `express` and `pg`, so the REAL server.js routes can be driven without installed packages or a database.
// LIMIT: the fake database only understands the SQL that server.js sends; it does not prove the SQL is valid on Postgres.
// The full integration suites (test/*.test.js against a real Postgres) are still required before deploy.
const Module = require('module');

function makeExpress() {
  function express() {
    const stack = [], routes = [], settings = {};
    const app = {
      disable() {}, set(k, v) { settings[k] = v; },
      get(a, h) { if (h === undefined) return settings[a]; routes.push({ m: 'GET', p: a, h }); },
      post(p, h) { routes.push({ m: 'POST', p, h }); },
      use(a, b) { if (typeof a === 'function') stack.push({ p: null, h: a }); else stack.push({ p: a, h: b }); },
      listen(port, cb) { if (cb) cb(); return {}; },
      _settings: settings,
    };
    app.dispatch = async (method, path, o = {}) => {
      const headers = Object.fromEntries(Object.entries(o.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      const q = { method, path, url: path, body: o.body, ip: o.ip || '203.0.113.1', query: o.query || {}, params: {}, app,
        get: h => headers[String(h).toLowerCase()] };
      let status = 200, payload, ended = false; const out = {};
      const r = {
        headersSent: false,
        status(c) { status = c; return r; },
        set(k, v) { if (typeof k === 'object') Object.assign(out, k); else out[k] = v; return r; },
        json(b) { payload = b; ended = true; r.headersSent = true; return r; },
        send(b) { payload = b; ended = true; r.headersSent = true; return r; },
      };
      const chain = [];
      for (const s of stack) if (!s.p || path === s.p || path.startsWith(s.p + '/')) chain.push(s.h);
      const route = routes.find(x => x.m === method && x.p === path);
      if (route) chain.push(route.h);
      for (const h of chain) {
        if (ended) break;
        if (h.length >= 4) continue; // error handlers are skipped
        let nexted = false;
        await new Promise((res, rej) => { try { const rv = h(q, r, e => { nexted = true; e ? rej(e) : res(); }); if (rv && rv.then) rv.then(() => res(), rej); else if (ended) res(); else if (h.length < 3) res(); } catch (e) { rej(e); } });
        if (ended) break;
      }
      if (!ended && !route) status = 404;
      return { status, body: payload, headers: out };
    };
    return app;
  }
  express.json = () => (q, r, n) => n();
  express.static = () => (q, r, n) => n();
  return express;
}

// ---- in-memory fake of just the tables and statements server.js uses ----
function makeFakeDb(clock) {
  const db = { players: new Map(), accounts: [], sessions: [], rate: new Map(), adminSessions: [], totp: new Set(), audit: [], rankedRuns: [], runs: [], now: () => clock.t, queries: [] };
  const ok = (rows = [], rowCount = rows.length) => ({ rows, rowCount });
  db.query = async (sqlRaw, p = []) => {
    const sql = String(sqlRaw).replace(/\s+/g, ' ').trim(); db.queries.push(sql);
    if (/^insert into rate_hits/.test(sql)) { const k = p[0] + '|' + p[1], n = (db.rate.get(k) || 0) + 1; db.rate.set(k, n); return ok([{ n }]); }
    if (/^select n from rate_hits/.test(sql)) { const k = p[0] + '|' + p[1]; return db.rate.has(k) ? ok([{ n: db.rate.get(k) }]) : ok(); }
    if (/^select 1 from players where id=\$1/.test(sql)) return db.players.has(p[0]) ? ok([{}]) : ok();
    if (/^insert into players\(id,name\) values\(\$1,\$2\) on conflict\(id\) do update/.test(sql)) { db.players.set(p[0], db.players.get(p[0]) || {}); return ok([], 1); }
    if (/^insert into players\(id,name\) values\(\$1,null\)/.test(sql)) { if (!db.players.has(p[0])) db.players.set(p[0], {}); return ok([], 1); }
    if (/^insert into players\(id,name,country\)/.test(sql)) { db.players.set(p[0], { name: p[1] }); return ok([], 1); }
    if (/^select 1 from accounts where player=/.test(sql)) return db.accounts.some(a => a.player === p[0]) ? ok([{}]) : ok();
    if (/^insert into accounts/.test(sql)) {
      if (db.accounts.some(a => a.username_lc === p[2])) throw Object.assign(new Error('dup'), { code: '23505', constraint: 'accounts_username_uniq' });
      if (db.accounts.some(a => a.player === p[4])) throw Object.assign(new Error('dup'), { code: '23505', constraint: 'accounts_player_uniq' });
      db.accounts.push({ id: p[0], username: p[1], username_lc: p[2], pass: p[3], player: p[4] }); return ok([], 1);
    }
    if (/^select id,pass,player,username from accounts where username_lc/.test(sql)) { const a = db.accounts.find(x => x.username_lc === p[0]); return a ? ok([a]) : ok(); }
    if (/^select a\.id,a\.username,exists/.test(sql)) {
      const a = db.accounts.find(x => x.player === p[0]); if (!a) return ok();
      const good = db.sessions.some(s => s.h === p[1] && s.account === a.id && s.expires > db.now());
      return ok([{ id: a.id, username: a.username, ok: good }]);
    }
    if (/^insert into sessions/.test(sql)) { db.sessions.push({ h: p[0], account: p[1], expires: db.now() + p[2] * 864e5, created: db.sessions.length }); return ok([], 1); }
    if (/^delete from sessions where account=\$1 and h not in/.test(sql)) {
      const mine = db.sessions.filter(s => s.account === p[0]).sort((a, b) => b.created - a.created).slice(0, 5);
      db.sessions = db.sessions.filter(s => s.account !== p[0] || mine.includes(s)); return ok();
    }
    if (/^delete from sessions where h=/.test(sql)) { db.sessions = db.sessions.filter(s => s.h !== p[0]); return ok(); }
    if (/^delete from sessions where account in/.test(sql)) { const ids = db.accounts.filter(a => a.player === p[0]).map(a => a.id); db.sessions = db.sessions.filter(s => !ids.includes(s.account)); return ok(); }
    if (/^delete from accounts where player/.test(sql)) { db.accounts = db.accounts.filter(a => a.player !== p[0]); return ok(); }
    if (/^insert into admin_sessions/.test(sql)) { db.adminSessions.push({ h: p[0], expires: db.now() + p[1] * 60000, created: db.adminSessions.length }); return ok([], 1); }
    if (/^select 1 from admin_sessions/.test(sql)) return db.adminSessions.some(s => s.h === p[0] && s.expires > db.now()) ? ok([{}]) : ok();
    if (/^delete from admin_sessions where h not in/.test(sql)) { const keep = db.adminSessions.slice().sort((a, b) => b.created - a.created).slice(0, 3); db.adminSessions = db.adminSessions.filter(s => keep.includes(s)); return ok(); }
    if (/^delete from admin_sessions where h=/.test(sql)) { db.adminSessions = db.adminSessions.filter(s => s.h !== p[0]); return ok(); }
    if (/^insert into admin_totp_used/.test(sql)) { if (db.totp.has(String(p[0]))) return ok([], 0); db.totp.add(String(p[0])); return ok([], 1); }
    if (/^insert into admin_audit/.test(sql)) { db.audit.push({ ip: p[0], action: p[1], detail: p[2] }); return ok([], 1); }
    if (/^select at::text,ip,action,detail from admin_audit/.test(sql)) return ok(db.audit.slice().reverse());
    if (/^select banned from players/.test(sql)) return ok();
    if (/^select 1 from ranked_runs where day=\$1 and id=\$2/.test(sql)) return db.rankedRuns.some(x => x.id === p[1]) ? ok([{}]) : ok();
    if (/^select count\(\*\)::int n from ranked_runs/.test(sql)) return ok([{ n: db.rankedRuns.filter(x => x.ip === p[1]).length }]);
    if (/^insert into ranked_runs/.test(sql)) { db.rankedRuns.push({ id: p[1], ip: p[2] }); return ok([], 1); }
    if (/^insert into runs\(/.test(sql)) { db.runs.push({ id: p[0], player: p[1], ranked: p[4] }); return ok([], 1); }
    if (/^select max\(score\) best/.test(sql)) return ok([{ best: null }]); // aggregates always return one row in Postgres
    if (/count\(\*\)/.test(sql)) return ok([{ n: 0 }]);
    return ok(); // anything else (schema, housekeeping, unrelated reads) is treated as empty
  };
  return db;
}

// Loads the real server.js with the stubs. Returns { app, db, clock, srvModule }.
function bootServer(env = {}) {
  const clock = { t: 1_800_000_000_000 }, db = makeFakeDb(clock), express = makeExpress();
  const saved = {}; for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === null) delete process.env[k]; else process.env[k] = env[k]; }
  let app;
  const wrapped = () => { app = express(); return app; }; Object.assign(wrapped, express);
  const pg = { Pool: class { constructor() {} query(s, p) { return db.query(s, p); } on() {} connect() { throw new Error('connect not available in the harness'); } } };
  const orig = Module._load;
  Module._load = function (req, ...a) { if (req === 'express') return wrapped; if (req === 'pg') return pg; return orig.call(this, req, ...a); };
  const path = require.resolve('../../server.js');
  delete require.cache[path];
  try { require(path); } finally { Module._load = orig; }
  // Some settings are read when a request arrives, so the variables stay set until the caller runs restore().
  const restore = () => { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } };
  return { app, db, clock, restore };
}
module.exports = { bootServer };
