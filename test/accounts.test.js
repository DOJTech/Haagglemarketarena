// Real-stack test for accounts, sessions, the owner second factor and the shared rate limits.
// Needs a LOCAL Postgres (never production). Run:
//   DATABASE_URL=postgres://... node test/accounts.test.js
// It starts its own server on port 3059, so it does not interfere with the other suites.
// Unlike test/harness/wiring.test.js (fake database), this runs every new SQL statement on real Postgres.
const { spawn } = require('child_process'), path = require('path'), crypto = require('crypto');
const S = require('../lib/security');
const PORT = 3059, B = 'http://localhost:' + PORT, KEY = 'dev-admin-key-0000', TOTP = S.newTotpSecret();
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, fail = 0; const t = (n, c) => { c ? ok++ : (fail++, console.log('FAIL', n)); };
const lt = s => [...s].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
const dev = () => 'p_' + crypto.randomBytes(12).toString('hex');
const uname = () => 'u' + lt(crypto.randomBytes(5).toString('hex'));
const PW = 'a long unusual phrase';
async function call(p, body, h) {
  const r = await fetch(B + '/api/' + p, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'content-type': 'application/json' }, h || {}), body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {} return { s: r.status, j };
}
const sess = tok => ({ 'x-session': tok });
(async () => {
  // The server gets its own SEED_SECRET, which gives it its own bucket for the per-network daily ranked limit.
  const srv = spawn('node', ['server.js'], { cwd: path.join(__dirname, '..'), stdio: 'ignore',
    env: Object.assign({}, process.env, { PORT: String(PORT), SEED_SECRET: 'acct-test-' + crypto.randomBytes(8).toString('hex'), ADMIN_TOTP_SECRET: TOTP, ADMIN_KEY: KEY, NODE_ENV: '', RANKED_NEEDS_ACCOUNT: '', ALLOWED_ORIGINS: '', RATE_MAX: '100000' }) });
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(B + '/healthz')).ok) break; } catch (e) {} await sleep(500); }
    // ---- accounts
    const id = dev(), un = uname();
    const reg = await call('auth/register', { id, username: un, password: PW });
    t('register works', reg.s === 200 && S.okToken(reg.j.token) && reg.j.id === id);
    t('same device cannot register twice', (await call('auth/register', { id, username: uname(), password: PW })).j.error === 'already_registered');
    t('username is unique in any case', (await call('auth/register', { id: dev(), username: un.toUpperCase(), password: PW })).j.error === 'username_taken');
    t('weak password refused', (await call('auth/register', { id: dev(), username: uname(), password: 'password123' })).j.error === 'password_too_common');
    t('profile needs the session', (await call('me/profile', { id })).s === 401 && (await call('me/profile', { id }, sess('a'.repeat(64)))).s === 401);
    const prof = await call('me/profile', { id }, sess(reg.j.token));
    t('profile shows the account with a valid session', prof.s === 200 && prof.j.account === un);
    t('bad password and unknown user look the same', (await call('auth/login', { username: un, password: 'wrong wrong wrong' })).s === 401 && (await call('auth/login', { username: uname(), password: 'wrong wrong wrong' })).s === 401);
    const lg = await call('auth/login', { username: un.toUpperCase(), password: PW });
    t('login works and returns the same player id (sign-in on another device)', lg.s === 200 && lg.j.id === id && lg.j.token !== reg.j.token);
    // ---- the five-session cap keeps the newest and drops the oldest
    let last = lg; for (let i = 0; i < 6; i++) last = await call('auth/login', { username: un, password: PW });
    t('newest session works', (await call('me/profile', { id }, sess(last.j.token))).s === 200);
    t('oldest session was dropped by the cap', (await call('me/profile', { id }, sess(reg.j.token))).s === 401);
    // ---- ranked play
    const anon = dev(), a1 = await call('run/start', { id: anon, name: 'Anon' + uname(), mode: 'daily' });
    t('device without account: ranked becomes practice with a clear note', a1.s === 200 && a1.j.ranked === false && /account/i.test(a1.j.note || ''));
    t('stolen device id of an account holder is refused', (await call('run/start', { id, mode: 'daily', name: 'Thief' + uname() })).s === 401);
    const r1 = await call('run/start', { id, name: 'Rk' + uname(), mode: 'daily' }, sess(last.j.token));
    t('signed-in player gets the ranked run', r1.s === 200 && r1.j.ranked === true);
    t('a move needs the session too', (await call('run/act', { id, runId: r1.j.runId, type: 'buy', pid: 'rice', dir: 1 })).s === 401);
    t('a move with the session works', (await call('run/act', { id, runId: r1.j.runId, type: 'buy', pid: 'rice', dir: 1 }, sess(last.j.token))).s === 200);
    t('second ranked start the same day is practice', (await call('run/start', { id, name: 'Rk' + uname(), mode: 'daily' }, sess(last.j.token))).j.ranked === false);
    // ---- sign out
    await call('auth/logout', {}, sess(last.j.token));
    t('sign-out ends the session', (await call('me/profile', { id }, sess(last.j.token))).s === 401);
    // ---- owner second factor (real HTTP, real database)
    t('owner area closed without a token', (await call('admin')).s === 401 && (await call('admin', null, { 'x-admin-key': KEY })).s === 401);
    t('right key, wrong code refused', (await call('admin/login', { key: KEY, code: '000000' })).s === 401);
    const c1 = S.totpAt(TOTP, Date.now()), ol = await call('admin/login', { key: KEY, code: c1 });
    t('right key and code: owner session issued', ol.s === 200 && S.okToken(ol.j.token));
    const AH = { 'x-admin-token': ol.j.token };
    const m = await call('admin', null, AH);
    t('owner metrics open with the token', m.s === 200 && m.j.totals && Number.isFinite(m.j.totals.visitors));
    t('the same code cannot be used twice', (await call('admin/login', { key: KEY, code: c1 })).s === 401);
    const au = await call('admin/audit', null, AH);
    t('audit trail recorded the sign-ins', au.s === 200 && au.j.rows.some(r => r.action === 'login_ok') && au.j.rows.some(r => r.action === 'login_failed') && !JSON.stringify(au.j).includes(KEY));
    await call('admin/logout', {}, AH);
    t('owner logout ends the session', (await call('admin', null, AH)).s === 401);
    // ---- delete my data removes the account
    t('delete needs a session', (await call('me/delete', { id })).s === 401);
    const l2 = await call('auth/login', { username: un, password: PW });
    t('delete works with a session', (await call('me/delete', { id }, sess(l2.j.token))).s === 200);
    t('account is gone after deletion', (await call('auth/login', { username: un, password: PW })).s === 401);
    // ---- lockout last, because it uses up this address's failure allowance
    let lock = 0; for (let i = 0; i < 8; i++) lock = (await call('admin/login', { key: 'wrong-wrong-wrong-' + i, code: '123456' })).s;
    t('repeated owner-login failures are locked out', lock === 429);
    t('lockout holds even for the right credentials', (await call('admin/login', { key: KEY, code: S.totpAt(TOTP, Date.now() + 30000) })).s === 429);
  } finally { srv.kill(); }
  console.log(ok + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERR', e.stack || e.message); process.exit(1); });
