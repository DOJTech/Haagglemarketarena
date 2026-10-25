'use strict';
// Integration test: needs Postgres. Run with TEST_DATABASE_URL=postgres://user:pass@localhost:5432/dbname npm test
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('crypto');
const { Pool } = require('pg');
const { loadConfig } = require('../lib/config');
const { createApp } = require('../app');
const URL_ = process.env.TEST_DATABASE_URL;
const opts = { skip: URL_ ? false : 'set TEST_DATABASE_URL to run API tests' };
const ORIGIN = 'https://haggle.example.com';
const newId = () => 'p_' + crypto.randomBytes(12).toString('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = { DATABASE_URL: 'postgres://u:p@h/db', SEED_SECRET: 's'.repeat(40), ADMIN_KEY: 'a'.repeat(30), ALLOWED_ORIGINS: ORIGIN };

async function boot(extra = {}) {
  const cfg = loadConfig(Object.assign({ NODE_ENV: 'test', DATABASE_URL: URL_, ALLOWED_ORIGINS: ORIGIN, MIN_RANK_MS: '0', RATE_MAX: '5000' }, extra));
  const pool = new Pool({ connectionString: URL_, max: 10 });
  const h = createApp(cfg, pool); await h.ready;
  const server = await new Promise((res) => { const s = h.app.listen(0, '127.0.0.1', () => res(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, path, body, headers = {}) => {
    const r = await fetch(base + path, { method, headers: Object.assign(method === 'POST' ? { 'content-type': 'application/json', origin: ORIGIN } : {}, headers), body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
    let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, body: j, headers: r.headers };
  };
  const adm = { 'x-admin-key': cfg.adminKey };
  return { cfg, pool, call, adm, close: async () => { h.stop(); server.closeAllConnections(); await new Promise((r) => server.close(r)); await pool.end(); } };
}
async function playToEnd(call, id, runId, buy = ['rice', 'fab']) {
  let v = { phase: 'stock' }, guard = 0;
  const act = async (b) => { for (;;) { const r = await call('POST', '/api/run/act', Object.assign({ id, runId }, b)); if (r.status === 429 && r.body.error === 'too fast') { await sleep(220); continue; } return r; } };
  while (v.phase !== 'final' && guard++ < 500) {
    if (v.phase === 'stock') for (const pid of buy) for (let i = 0; i < 2; i++) await act({ type: 'buy', pid, dir: 1 });
    const r = await act({ type: v.phase === 'stock' ? 'open' : v.phase === 'haggle' ? 'accept' : v.phase === 'dayend' ? 'nextday' : 'next' });
    assert.equal(r.status, 200, JSON.stringify(r.body)); v = r.body;
  }
  return v;
}

test('config refuses unsafe production settings', () => {
  const env = (o) => Object.assign({ NODE_ENV: 'production' }, BASE, o);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@h/db' }), /SEED_SECRET/);
  assert.throws(() => loadConfig(env({ SEED_SECRET: 'change-me-' + 'x'.repeat(40) })), /SEED_SECRET/);
  assert.throws(() => loadConfig(env({ ALLOWED_ORIGINS: '' })), /ALLOWED_ORIGINS/);
  assert.throws(() => loadConfig(env({ ALLOWED_ORIGINS: 'http://x.com' })), /https/);
  const ok = loadConfig(env({ DATABASE_URL: 'postgres://u:p@dpg-abc/db', ALLOWED_ORIGINS: ORIGIN + '/' }));
  assert.deepEqual(ok.origins, [ORIGIN]); assert.equal(ok.ssl, false);
  assert.notEqual(loadConfig(env({ DATABASE_URL: 'postgres://u:p@dpg-abc.oregon-postgres.render.com/db' })).ssl, false);
});

test('API: ranked game, names, leaderboard, guards, reports, erasure', opts, async () => {
  const t = await boot(); const { call, pool, adm } = t;
  try {
    await pool.query('truncate players,presence,daily_active,ranked_runs,runs,scores,reports,campaigns restart identity');
    const h = await call('GET', '/api/stats'); assert.equal(h.status, 200); assert.equal(h.headers.get('cache-control'), 'no-store'); assert.equal(h.headers.get('x-powered-by'), null);
    assert.match(h.headers.get('content-security-policy'), /object-src 'none'/); assert.doesNotMatch(h.headers.get('content-security-policy'), /googleapis/);
    assert.equal((await call('POST', '/api/ping', { id: newId() }, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await call('POST', '/api/ping', { id: 'bad' })).status, 400);
    assert.equal((await call('POST', '/api/ping', '{not json')).status, 400);
    assert.equal((await call('POST', '/api/ping', { id: newId(), pad: 'x'.repeat(6000) })).status, 413);
    assert.equal((await call('GET', '/api/nope')).status, 404);
    assert.equal((await call('GET', '/api/admin')).status, 401);
    assert.equal((await call('GET', '/api/admin', undefined, adm)).status, 200);
    const R = await call('GET', '/api/rules'); assert.equal(R.body.campaign.length, 7); assert.equal(R.body.score.TOTAL_MAX, 1000);
    assert.equal((await call('GET', '/api/insights')).body.rows.length, 0);
    assert.ok(R.body.campaign.every((c) => c.wx));

    // names: validation, uniqueness, automatic names
    const id = newId(); await call('POST', '/api/ping', { id });
    const nameErr = async (name) => (await call('POST', '/api/run/start', { id: newId(), mode: 'practice', name })).body.error;
    assert.equal(await nameErr('ab'), 'name_too_short'); assert.equal(await nameErr('x'.repeat(21)), 'name_too_long');
    assert.equal(await nameErr('no <tags>'), 'name_invalid_chars'); assert.equal(await nameErr('f*ck'), 'name_invalid_chars'); assert.equal(await nameErr('fuck'), 'name_not_allowed');
    const s = await call('POST', '/api/run/start', { id, mode: 'daily', name: 'Tunde', country: 'NG' });
    assert.equal(s.status, 200); assert.equal(s.body.ranked, true); assert.equal(JSON.stringify(s.body).includes('sched'), false);
    assert.equal((await call('POST', '/api/run/start', { id: newId(), mode: 'practice', name: 'tunde' })).status, 409);
    assert.equal((await call('POST', '/api/run/start', { id: newId(), mode: 'practice', name: 'T.u_nde' })).body.error, 'name_taken');
    assert.equal((await call('POST', '/api/run/start', { id, mode: 'practice', name: 'Tunde' })).status, 200, 'you can reuse your own name');
    const nz = await call('POST', '/api/run/start', { id: newId(), mode: 'practice', name: 'Nazir' }); assert.equal(nz.status, 200);
    const au = await call('POST', '/api/run/start', { id: newId(), mode: 'practice', name: '' }); assert.equal(au.status, 200);

    // hostile actions, then a full ranked game
    assert.equal((await call('POST', '/api/run/act', { id, runId: s.body.runId, type: 'buy', pid: '__proto__', dir: 1 })).status, 400);
    assert.equal((await call('POST', '/api/run/act', { id: newId(), runId: s.body.runId, type: 'open' })).status, 404);
    const fin = await playToEnd(call, id, s.body.runId);
    assert.equal(fin.ranked, true); assert.ok(fin.score > 0 && fin.score <= 1000); assert.equal(Object.keys(fin.breakdown.parts).length, 5); assert.ok(typeof fin.liq === 'number');
    const st = (await pool.query('select state from runs where id=$1', [s.body.runId])).rows[0].state; assert.ok(JSON.stringify(st).length < 24000);
    const resumed = await call('POST', '/api/run/start', { id, resume: s.body.runId }); assert.equal(resumed.body.score, fin.score);
    const lb = await call('GET', '/api/leaderboard'); assert.equal(lb.body.rows.length, 1); assert.equal(lb.body.rows[0].name, 'Tunde'); assert.equal(lb.body.rows[0].daily, fin.score);
    assert.equal((await call('POST', '/api/run/start', { id, mode: 'daily', name: 'Tunde' })).body.ranked, false);

    // old saved games from the previous version are refused cleanly
    await pool.query("insert into runs(id,player,mode,day,state,status) values($1,$2,'practice',current_date,'{\"v\":1}','active')", ['a'.repeat(32), id]);
    assert.equal((await call('POST', '/api/run/start', { id, resume: 'a'.repeat(32) })).body.error, 'old_version');
    assert.equal((await call('POST', '/api/run/act', { id, runId: 'a'.repeat(32), type: 'open' })).status, 410);

    // concurrent ranked starts from one network: only the remaining slots are ranked
    const par = await Promise.all(Array.from({ length: 12 }, () => call('POST', '/api/run/start', { id: newId(), mode: 'daily' })));
    assert.equal(par.filter((x) => x.body.ranked).length, 2);
    const pid = newId(); for (let i = 0; i < 7; i++) { await call('POST', '/api/run/start', { id: pid, mode: 'practice' }); await sleep(5); }
    assert.equal((await pool.query("select count(*)::int n from runs where player=$1 and status='active'", [pid])).rows[0].n, 5);

    // reports need 3 players on 2+ networks
    const ref = lb.body.rows[0].ref, reporters = [];
    for (let i = 0; i < 3; i++) { const rid = newId(); const rs = await call('POST', '/api/run/start', { id: rid, mode: 'practice' }); await playToEnd(call, rid, rs.body.runId); reporters.push(rid); }
    for (const rid of reporters) assert.equal((await call('POST', '/api/report', { id: rid, ref })).status, 200);
    assert.equal((await call('GET', '/api/leaderboard')).body.rows[0].name, 'Tunde', 'one network cannot hide a score');
    await pool.query("update reports set ip='other-network' where reporter=$1", [reporters[0]]);
    await call('POST', '/api/report', { id: reporters[1], ref });
    assert.equal((await pool.query('select hidden from scores')).rows[0].hidden, true);
    assert.equal((await call('POST', '/api/admin/action', { ref, action: 'clear' }, adm)).status, 200);
    assert.equal((await pool.query('select hidden from scores')).rows[0].hidden, false);

    // insights stay hidden until there are 30 finished games
    assert.equal((await call('GET', '/api/insights')).body.rows.length, 0);

    // erasure keeps the daily limit but removes the device
    assert.equal((await call('POST', '/api/me/delete', { id })).status, 200);
    assert.equal((await pool.query('select count(*)::int n from players where id=$1', [id])).rows[0].n, 0);
    assert.equal((await pool.query('select count(*)::int n from ranked_runs where id=$1', [id])).rows[0].n, 0);
    assert.ok((await pool.query('select count(*)::int n from ranked_runs where day=current_date')).rows[0].n >= 3);
    assert.equal((await call('POST', '/api/run/start', { id: newId(), mode: 'practice', name: 'Tunde' })).status, 200, 'a deleted name is free again');
  } finally { await t.close(); }
});

test('API: sponsor campaign lifecycle and private report link', opts, async () => {
  const t = await boot(); const { call, pool, adm } = t;
  try {
    await pool.query('truncate players,presence,daily_active,ranked_runs,runs,scores,reports,campaigns restart identity');
    const bad = (b) => call('POST', '/api/admin/campaign', b, adm);
    assert.equal((await call('POST', '/api/admin/campaign', { brand: 'X' })).status, 401);
    assert.equal((await bad({ brand: 'Acme', product: 'Beans', category: 'food', variants: [0.2] })).status, 400);
    assert.equal((await bad({ brand: 'Acme', product: 'Beans', category: 'nope', variants: [1] })).status, 400);
    assert.equal((await bad({ brand: 'Acme', product: 'Beans', category: 'food', variants: [1], fee_ngn: '1.5' })).status, 400);
    const mk = await bad({ brand: '<b>Acme</b>', product: 'Golden Beans', tagline: 'Taste <script>', category: 'food', variants: [0.9, 1, 1.1, 1], fee_ngn: '50000' }); assert.equal(mk.status, 200);
    let list = (await call('GET', '/api/admin/campaigns', undefined, adm)).body.rows; assert.equal(list.length, 1); assert.equal(list[0].status, 'pending'); assert.equal(list[0].brand, 'bAcmeb');
    const a = newId(); assert.equal((await call('POST', '/api/run/start', { id: a, mode: 'practice' })).body.sponsor, null, 'pending sponsors never appear');
    assert.equal((await call('POST', '/api/admin/campaign/action', { id: 1, action: 'hack' }, adm)).status, 400);
    assert.equal((await call('POST', '/api/admin/campaign/action', { id: 1, action: 'approve' }, adm)).status, 200);
    const pr = await call('POST', '/api/run/start', { id: a, mode: 'practice' }); assert.equal(pr.body.sponsor.product, 'Golden Beans');
    const rk = await call('POST', '/api/run/start', { id: newId(), mode: 'daily' }); assert.equal(rk.body.ranked, true); assert.equal(rk.body.sponsor.brand, 'bAcmeb');
    assert.equal((await pool.query('select variant from runs where id=$1', [rk.body.runId])).rows[0].variant, -1, 'ranked runs are never price-tested');
    await playToEnd(call, a, pr.body.runId, ['noo', 'rice']);
    list = (await call('GET', '/api/admin/campaigns', undefined, adm)).body.rows; assert.equal(list[0].served, 2); assert.equal(list[0].completed, 1);
    const rep = await call('GET', '/api/report/' + list[0].token); assert.equal(rep.status, 200); assert.equal(rep.headers.get('cache-control'), 'no-store');
    assert.ok(rep.body.rows.every((x) => x.hidden), 'small groups are hidden'); assert.match(rep.body.disclaimer, /simulated/);
    assert.equal((await call('GET', '/api/report/' + 'f'.repeat(32))).status, 404); assert.equal((await call('GET', '/api/report/short')).status, 404);
    for (const act of ['pause', 'approve', 'unpaid', 'paid', 'end']) assert.equal((await call('POST', '/api/admin/campaign/action', { id: 1, action: act }, adm)).status, 200);
    const end = (await call('GET', '/api/admin/campaigns', undefined, adm)).body.rows[0]; assert.equal(end.status, 'ended'); assert.equal(end.invoice, 'paid');
    assert.equal((await call('POST', '/api/run/start', { id: newId(), mode: 'practice' })).body.sponsor, null, 'ended sponsors disappear');
  } finally { await t.close(); }
});

test('API: admin lockout, rate limit, proxy secret', opts, async () => {
  const t = await boot({ PROXY_SECRET: 'p'.repeat(30), RATE_MAX: '40' });
  try {
    const px = { 'x-proxy-key': 'p'.repeat(30) };
    assert.equal((await t.call('GET', '/api/stats')).status, 403);
    assert.equal((await t.call('GET', '/api/stats', undefined, px)).status, 200);
    for (let i = 0; i < 10; i++) assert.equal((await t.call('GET', '/api/admin', undefined, Object.assign({ 'x-admin-key': 'wrong' }, px))).status, 401);
    assert.equal((await t.call('GET', '/api/admin', undefined, Object.assign({ 'x-admin-key': t.cfg.adminKey }, px))).status, 429, 'locked out even with the right key');
    let limited = 0; for (let i = 0; i < 60; i++) if ((await t.call('GET', '/api/stats', undefined, px)).status === 429) limited++;
    assert.ok(limited > 0);
  } finally { await t.close(); }
});

test('API: music shelf is curated by the owner and only accepts safe links', opts, async () => {
  const t = await boot(); const { call, pool, adm } = t;
  try {
    await pool.query('truncate music_picks restart identity'); await pool.query('delete from music_picks');
    // the shelf is seeded when empty at boot, so reboot the schema step by inserting nothing and checking the public list works
    assert.equal((await call('GET', '/api/music')).status, 200);
    assert.equal((await call('POST', '/api/admin/music', { title: 'X', url: 'https://open.spotify.com/playlist/0VRrsChND56p77FczOUBbp' })).status, 401);
    const add = (b) => call('POST', '/api/admin/music', b, adm);
    assert.equal((await add({ title: '', url: 'https://open.spotify.com/playlist/0VRrsChND56p77FczOUBbp' })).status, 400);
    for (const bad of ['javascript:alert(1)', 'https://evil.example/page.html', 'http://open.spotify.com/track/5xwoFsaLjSMeiW9tdYPrWy', 'https://open.spotify.com.evil.com/track/5xwoFsaLjSMeiW9tdYPrWy', 'https://192.168.0.1/a.mp3'])
      assert.equal((await add({ title: 'Bad', url: bad })).status, 400, bad);
    const ok = await add({ title: '<b>Hot</b> Naija 2026', url: 'https://open.spotify.com/playlist/0VRrsChND56p77FczOUBbp?si=zzz' }); assert.equal(ok.status, 200);
    const list = (await call('GET', '/api/music')).body.rows; assert.equal(list.length, 1); assert.equal(list[0].title, 'bHotb Naija 2026');
    assert.equal((await call('POST', '/api/admin/music/delete', { id: list[0].id }, adm)).status, 200);
    assert.equal((await call('POST', '/api/admin/music/delete', { id: 'x' }, adm)).status, 400);
    for (let i = 0; i < 30; i++) await add({ title: 'Song ' + i, url: 'https://cdn.example.com/s' + i + '.mp3' });
    assert.equal((await add({ title: 'One more', url: 'https://cdn.example.com/more.mp3' })).status, 400, 'shelf is capped at 30');
    const h = await call('GET', '/api/stats'); assert.match(h.headers.get('content-security-policy'), /frame-src https:\/\/open\.spotify\.com/); assert.match(h.headers.get('content-security-policy'), /media-src 'self' blob: https:/);
  } finally { await t.close(); }
});
test('API: a fresh database starts with a seeded Naija hits shelf', opts, async () => {
  const t = await boot(); const { call, pool } = t;
  try {
    await pool.query('delete from music_picks'); await t.close();
    const t2 = await boot();
    try { const rows = (await t2.call('GET', '/api/music')).body.rows; assert.ok(rows.length >= 3); assert.ok(rows.every((r) => /^https:\/\/open\.spotify\.com\/playlist\//.test(r.url))); } finally { await t2.close(); }
  } catch (e) { try { await t.close(); } catch (_) {} throw e; }
});
