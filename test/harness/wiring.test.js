// Run: node --test test/harness/wiring.test.js   (needs no database, no network, no installed packages)
// Drives the REAL server.js route handlers against a fake in-memory database (see stubs.js for what that does and does not prove).
const test = require('node:test'), assert = require('node:assert/strict');
const { spawnSync } = require('child_process'), path = require('path');
const { bootServer } = require('./stubs');
const S = require('../../lib/security');

const ORIGIN = 'https://haggle.example.com', OH = { origin: ORIGIN };
const TOTP = S.newTotpSecret(), KEY = 'owner-key-for-tests-0123456789';
const BASE = { ADMIN_KEY: KEY, ADMIN_TOTP_SECRET: TOTP, SEED_SECRET: 'seed-secret-for-tests-0001', ALLOWED_ORIGINS: ORIGIN, NODE_ENV: null, RANKED_NEEDS_ACCOUNT: null };
const devId = () => 'p_' + require('crypto').randomBytes(12).toString('hex');
let ipn = 10; const nextIp = () => '198.51.100.' + (ipn++);
const post = (h, p, body, headers = {}, ip) => h.app.dispatch('POST', p, { body, headers: Object.assign({}, OH, headers), ip: ip || nextIp() });
const get = (h, p, headers = {}, ip) => h.app.dispatch('GET', p, { headers, ip: ip || nextIp() });
const code = (offsetSteps = 0) => S.totpAt(TOTP, Date.now() + offsetSteps * 30000);
const PW = 'a long unusual phrase';

/* ============ owner second factor ============ */
test('owner: old key-in-header access no longer works; endpoints need a session token', async () => {
  const h = bootServer(BASE);
  try {
    for (const p of ['/api/admin', '/api/admin/campaigns', '/api/admin/reports', '/api/admin/sponsor', '/api/admin/ip', '/api/admin/audit'])
      assert.equal((await get(h, p)).status, 401, p);
    assert.equal((await get(h, '/api/admin/ip', { 'x-admin-key': KEY })).status, 401, 'raw key is not accepted');
    assert.equal((await get(h, '/api/admin/ip', { 'x-admin-token': KEY })).status, 401, 'key used as a token is not accepted');
    assert.equal((await get(h, '/api/admin/ip', { 'x-admin-token': 'f'.repeat(64) })).status, 401, 'unknown token');
  } finally { h.restore(); }
});
test('owner login: needs BOTH the key and a valid one-time code; each code works once; token is stored hashed', async () => {
  const h = bootServer(BASE);
  try {
    const ip = nextIp();
    assert.equal((await post(h, '/api/admin/login', { key: KEY, code: '000000' }, {}, ip)).status, 401, 'right key, wrong code');
    assert.equal((await post(h, '/api/admin/login', { key: KEY }, {}, ip)).status, 401, 'right key, no code');
    assert.equal((await post(h, '/api/admin/login', { key: 'wrong-key-wrong-key-wrong', code: code() }, {}, ip)).status, 401, 'right code, wrong key');
    const ok = await post(h, '/api/admin/login', { key: KEY, code: code() }, {}, ip);
    assert.equal(ok.status, 200); assert.ok(S.okToken(ok.body.token));
    assert.ok(!h.db.adminSessions.some(s => s.h === ok.body.token), 'raw token is not stored');
    assert.equal(h.db.adminSessions[0].h, S.tokHash(ok.body.token));
    assert.equal((await get(h, '/api/admin/ip', { 'x-admin-token': ok.body.token })).status, 200, 'token opens owner area');
    // replay: the same code cannot be used again, even with the right key
    assert.equal((await post(h, '/api/admin/login', { key: KEY, code: code() }, {}, nextIp())).status, 401, 'replayed code refused');
    // the next 30-second code is accepted
    assert.equal((await post(h, '/api/admin/login', { key: KEY, code: code(1) }, {}, nextIp())).status, 200, 'next code works');
    // a wrong key does not burn a good code
    const c2 = code(-1);
    assert.equal((await post(h, '/api/admin/login', { key: 'nope-nope-nope-nope-nope', code: c2 }, {}, nextIp())).status, 401);
    assert.equal((await post(h, '/api/admin/login', { key: KEY, code: c2 }, {}, nextIp())).status, 200, 'code still usable after a wrong-key attempt');
    // hostile bodies do not crash it
    for (const b of [null, {}, { key: {}, code: [] }, { key: 1e9, code: {} }, 'x']) assert.ok([401, 400].includes((await post(h, '/api/admin/login', b, {}, nextIp())).status));
  } finally { h.restore(); }
});
test('owner login: lockout after repeated failures, even for the correct credentials; session expires; logout works; audit trail has no secrets', async () => {
  const h = bootServer(BASE);
  try {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) assert.equal((await post(h, '/api/admin/login', { key: KEY, code: String(100000 + i) }, {}, ip)).status, 401);
    const locked = await post(h, '/api/admin/login', { key: KEY, code: code() }, {}, ip);
    assert.equal(locked.status, 429, 'locked out after 5 failures from one address');
    const other = await post(h, '/api/admin/login', { key: KEY, code: code() }, {}, nextIp());
    assert.equal(other.status, 200, 'a different address is not locked (the owner cannot be locked out by one attacker)');
    const tok = other.body.token;
    h.clock.t += 31 * 60000;
    assert.equal((await get(h, '/api/admin/ip', { 'x-admin-token': tok })).status, 401, 'session expires after 30 minutes');
    const l2 = await post(h, '/api/admin/login', { key: KEY, code: code(1) }, {}, nextIp());
    assert.equal(l2.status, 200);
    assert.equal((await post(h, '/api/admin/logout', {}, { 'x-admin-token': l2.body.token })).status, 200);
    assert.equal((await get(h, '/api/admin/ip', { 'x-admin-token': l2.body.token })).status, 401, 'logout ends the session');
    const acts = h.db.audit.map(a => a.action);
    assert.ok(acts.includes('login_failed') && acts.includes('login_ok') && acts.includes('login_locked') && acts.includes('logout'), acts.join());
    const dump = JSON.stringify(h.db.audit); assert.ok(!dump.includes(KEY) && !dump.includes(TOTP) && !dump.includes('198.51.100.'), 'audit holds no key, secret or raw address');
  } finally { h.restore(); }
});
test('owner login without a second-factor secret (local testing only): key alone works, wrong key refused', async () => {
  const h = bootServer(Object.assign({}, BASE, { ADMIN_TOTP_SECRET: null }));
  try {
    assert.equal((await post(h, '/api/admin/login', { key: 'bad-bad-bad-bad-bad' })).status, 401);
    assert.equal((await post(h, '/api/admin/login', { key: KEY })).status, 200);
  } finally { h.restore(); }
});
test('origin lock still applies to the new POST routes', async () => {
  const h = bootServer(BASE);
  try {
    for (const p of ['/api/admin/login', '/api/auth/login', '/api/auth/register', '/api/auth/logout'])
      assert.equal((await h.app.dispatch('POST', p, { body: {}, ip: nextIp() })).status, 403, p + ' without Origin');
    assert.equal((await h.app.dispatch('POST', '/api/auth/login', { body: {}, headers: { origin: 'https://evil.example' }, ip: nextIp() })).status, 403);
  } finally { h.restore(); }
});

/* ============ accounts and sessions ============ */
async function registered(h, name, ip) {
  const id = devId(), r = await post(h, '/api/auth/register', { id, username: name, password: PW }, {}, ip);
  assert.equal(r.status, 200, JSON.stringify(r.body)); return { id, tok: r.body.token, name };
}
test('register: validates input, stores only a salted hash, issues a hashed session', async () => {
  const h = bootServer(BASE);
  try {
    const id = devId();
    const bad = async (b, err) => { const r = await post(h, '/api/auth/register', b); assert.equal(r.status, 400, JSON.stringify(b)); assert.equal(r.body.error, err); };
    await bad({ id: 'bad', username: 'abcd', password: PW }, 'bad id');
    await bad({ id, username: 'ab', password: PW }, 'username_too_short');
    await bad({ id, username: '<script>x</script>', password: PW }, 'username_invalid_chars');
    await bad({ id, username: "x');--", password: PW }, 'username_invalid_chars');
    await bad({ id, username: "x'); drop table accounts;--", password: PW }, 'username_too_long');
    await bad({ id, username: 'admin', password: PW }, 'name_not_allowed');
    await bad({ id, username: 'gooduser', password: 'short' }, 'password_too_short');
    await bad({ id, username: 'gooduser', password: 'password123' }, 'password_too_common');
    await bad({ id, username: 'gooduser', password: 'xx gooduser xx yy' }, 'password_has_username');
    await bad({ id, username: 'gooduser' }, 'password_invalid');
    assert.equal(h.db.accounts.length, 0, 'nothing stored for refused requests');
    const r = await post(h, '/api/auth/register', { id, username: 'GoodUser', password: PW });
    assert.equal(r.status, 200); assert.ok(S.okToken(r.body.token)); assert.equal(r.body.id, id); assert.equal(r.body.username, 'GoodUser');
    assert.equal(r.headers['Cache-Control'], 'no-store');
    const a = h.db.accounts[0];
    assert.ok(a.pass.startsWith('scrypt$') && !a.pass.includes(PW) && !JSON.stringify(h.db).includes(PW), 'password is not stored');
    assert.equal(a.username_lc, 'gooduser');
    assert.ok(!h.db.sessions.some(s => s.h === r.body.token) && h.db.sessions[0].h === S.tokHash(r.body.token), 'session stored hashed');
    assert.equal((await post(h, '/api/auth/register', { id, username: 'another1', password: PW })).body.error, 'already_registered', 'one account per device');
    assert.equal((await post(h, '/api/auth/register', { id: devId(), username: 'GOODUSER', password: PW })).body.error, 'username_taken', 'usernames unique, any case');
  } finally { h.restore(); }
});
test('login: right password works; wrong password and unknown user look identical; failures lock the username', async () => {
  const h = bootServer(BASE);
  try {
    const u = await registered(h, 'LoginUser', nextIp());
    const wrong = await post(h, '/api/auth/login', { username: 'LoginUser', password: 'definitely wrong pass' });
    const none = await post(h, '/api/auth/login', { username: 'NoSuchPerson', password: 'definitely wrong pass' });
    assert.equal(wrong.status, 401); assert.equal(none.status, 401);
    assert.deepEqual(wrong.body, none.body, 'no hint whether the username exists');
    const ok = await post(h, '/api/auth/login', { username: 'loginuser', password: PW });
    assert.equal(ok.status, 200); assert.equal(ok.body.id, u.id); assert.ok(S.okToken(ok.body.token)); assert.notEqual(ok.body.token, u.tok);
    for (const b of [{}, { username: 'x' }, { password: PW }, { username: 'a'.repeat(50), password: PW }, { username: 'LoginUser', password: 'p'.repeat(500) }, null])
      assert.equal((await post(h, '/api/auth/login', b)).status, 401);
    // many different addresses guessing ONE account: the per-username limit still stops them
    let last;
    for (let i = 0; i < 12; i++) last = await post(h, '/api/auth/login', { username: 'LoginUser', password: 'guess number ' + i + ' wrong' }, {}, nextIp());
    assert.equal(last.status, 429);
    assert.equal((await post(h, '/api/auth/login', { username: 'LoginUser', password: PW }, {}, nextIp())).status, 429, 'even the right password is refused while locked');
    assert.equal((await post(h, '/api/auth/login', { username: 'someone', password: PW }, {}, nextIp())).status, 401, 'other usernames unaffected');
  } finally { h.restore(); }
});
test('login: one address making many attempts across usernames is limited', async () => {
  const h = bootServer(Object.assign({}, BASE, { LOGIN_PER_IP_15MIN: '8' }));
  try {
    const ip = nextIp(); let last;
    for (let i = 0; i < 10; i++) last = await post(h, '/api/auth/login', { username: 'user' + i + 'abc', password: 'whatever password' }, {}, ip);
    assert.equal(last.status, 429);
  } finally { h.restore(); }
});
test('register: per-address and global caps', async () => {
  let h = bootServer(Object.assign({}, BASE, { REGISTER_PER_IP_DAY: '3' }));
  try {
    const ip = nextIp(); let codes = [];
    for (let i = 0; i < 5; i++) codes.push((await post(h, '/api/auth/register', { id: devId(), username: 'bot' + i + 'user', password: PW }, {}, ip)).status);
    assert.deepEqual(codes, [200, 200, 200, 429, 429]);
    assert.equal((await post(h, '/api/auth/register', { id: devId(), username: 'honest1user', password: PW }, {}, nextIp())).status, 200, 'another address is fine');
  } finally { h.restore(); }
  h = bootServer(Object.assign({}, BASE, { REGISTER_PER_HOUR_ALL: '2' }));
  try {
    const c = []; for (let i = 0; i < 4; i++) c.push((await post(h, '/api/auth/register', { id: devId(), username: 'swarm' + i + 'xx', password: PW }, {}, nextIp())).status);
    assert.deepEqual(c, [200, 200, 429, 429], 'global ceiling stops an many-address flood');
  } finally { h.restore(); }
});
test('a stolen device ID alone cannot act for a player who has an account', async () => {
  const h = bootServer(BASE);
  try {
    const u = await registered(h, 'Victim' + 1, nextIp()), S1 = { 'x-session': u.tok };
    const attempts = [['/api/run/start', { id: u.id, mode: 'practice' }], ['/api/run/start', { id: u.id, resume: 'a'.repeat(32) }], ['/api/run/act', { id: u.id, runId: 'a'.repeat(32), type: 'open' }],
      ['/api/me/profile', { id: u.id }], ['/api/me/delete', { id: u.id }], ['/api/report', { id: u.id, ref: 'a'.repeat(12) }]];
    for (const [p, b] of attempts) {
      assert.equal((await post(h, p, b)).status, 401, p + ' with no session');
      assert.equal((await post(h, p, b, { 'x-session': 'b'.repeat(64) })).status, 401, p + ' with a made-up session');
      assert.equal((await post(h, p, b, { 'x-session': 'not-hex' })).status, 401, p + ' with a malformed session');
    }
    assert.equal(h.db.accounts.length, 1, 'delete without a session did nothing');
    const ok = await post(h, '/api/run/start', { id: u.id, mode: 'practice' }, S1);
    assert.equal(ok.status, 200); assert.ok(ok.body.runId);
    assert.equal((await post(h, '/api/me/profile', { id: u.id }, S1)).body.account, 'Victim1');
    // another player's valid session does not work for this device ID
    const v = await registered(h, 'Other' + 2 + 'xx', nextIp());
    assert.equal((await post(h, '/api/run/start', { id: u.id, mode: 'practice' }, { 'x-session': v.tok })).status, 401, "someone else's session is not accepted");
    // logging out ends the session
    await post(h, '/api/auth/logout', {}, S1);
    assert.equal((await post(h, '/api/run/start', { id: u.id, mode: 'practice' }, S1)).status, 401, 'after sign-out');
    // sessions expire
    const l = await post(h, '/api/auth/login', { username: 'Victim1', password: PW });
    assert.equal((await post(h, '/api/run/start', { id: u.id, mode: 'practice' }, { 'x-session': l.body.token })).status, 200);
    h.clock.t += 15 * 864e5;
    assert.equal((await post(h, '/api/run/start', { id: u.id, mode: 'practice' }, { 'x-session': l.body.token })).status, 401, 'after 14 days');
  } finally { h.restore(); }
});
test('delete my data also removes the account and its sessions', async () => {
  const h = bootServer(BASE);
  try {
    const u = await registered(h, 'Leaver' + 'xx', nextIp());
    assert.equal((await post(h, '/api/me/delete', { id: u.id }, { 'x-session': u.tok })).status, 200);
    assert.equal(h.db.accounts.length, 0); assert.equal(h.db.sessions.length, 0);
  } finally { h.restore(); }
});
test('at most 5 sessions per account', async () => {
  const h = bootServer(BASE);
  try {
    await registered(h, 'Many' + 'Sess', nextIp());
    for (let i = 0; i < 8; i++) await post(h, '/api/auth/login', { username: 'ManySess', password: PW }, {}, nextIp());
    assert.ok(h.db.sessions.length <= 5, String(h.db.sessions.length));
  } finally { h.restore(); }
});

/* ============ ranked play needs an account ============ */
test('ranked play: needs an account and a session; practice and legacy devices still work', async () => {
  const h = bootServer(BASE);
  try {
    const anon = devId();
    const p = await post(h, '/api/run/start', { id: anon, mode: 'practice' });
    assert.equal(p.status, 200, 'a device with no account can still practise');
    const d = await post(h, '/api/run/start', { id: anon, mode: 'daily' });
    assert.equal(d.status, 200); assert.equal(d.body.ranked, false); assert.match(d.body.note || '', /free account/);
    assert.equal(h.db.rankedRuns.length, 0, 'no ranked slot used');
    const u = await registered(h, 'Ranker' + 'xx', nextIp());
    const r = await post(h, '/api/run/start', { id: u.id, mode: 'daily' }, { 'x-session': u.tok });
    assert.equal(r.status, 200); assert.equal(r.body.ranked, true);
    assert.equal(h.db.rankedRuns.length, 1);
    const again = await post(h, '/api/run/start', { id: u.id, mode: 'daily' }, { 'x-session': u.tok });
    assert.equal(again.body.ranked, false, 'still one ranked run per day');
  } finally { h.restore(); }
});
test('RANKED_NEEDS_ACCOUNT=0 (local legacy suites only) lets a bare device rank', async () => {
  const h = bootServer(Object.assign({}, BASE, { RANKED_NEEDS_ACCOUNT: '0' }));
  try { assert.equal((await post(h, '/api/run/start', { id: devId(), mode: 'daily' })).body.ranked, true); } finally { h.restore(); }
});

/* ============ rate limits shared through the database; fake-ID flooding ============ */
test('starting games is limited per player and per address (counted in the database, so shared by every server)', async () => {
  let h = bootServer(Object.assign({}, BASE, { START_PER_PLAYER_HOUR: '3' }));
  try {
    const id = devId(), ip = nextIp(), c = [];
    for (let i = 0; i < 5; i++) c.push((await post(h, '/api/run/start', { id, mode: 'practice' }, {}, ip)).status);
    assert.deepEqual(c, [200, 200, 200, 429, 429]);
    assert.equal((await post(h, '/api/run/start', { id, resume: 'a'.repeat(32) }, {}, ip)).status, 404, 'resuming a game is not counted');
  } finally { h.restore(); }
  h = bootServer(Object.assign({}, BASE, { START_PER_IP_HOUR: '4' }));
  try {
    const ip = nextIp(), c = [];
    for (let i = 0; i < 6; i++) c.push((await post(h, '/api/run/start', { id: devId(), mode: 'practice' }, {}, ip)).status);
    assert.deepEqual(c, [200, 200, 200, 200, 429, 429], 'many fake devices from one address are capped');
  } finally { h.restore(); }
});
test('ping: fake device IDs cannot fill the players table; known devices are unaffected', async () => {
  const h = bootServer(Object.assign({}, BASE, { NEW_DEVICES_PER_IP_HOUR: '3' }));
  try {
    const ip = nextIp();
    for (let i = 0; i < 10; i++) assert.equal((await post(h, '/api/ping', { id: devId() }, {}, ip)).status, 200);
    assert.equal(h.db.players.size, 3, 'only 3 new device records created from one address');
    const known = [...h.db.players.keys()][0];
    assert.equal((await post(h, '/api/ping', { id: known }, {}, ip)).status, 200);
    assert.equal((await post(h, '/api/ping', { id: 'nope' }, {}, ip)).status, 400);
  } finally { h.restore(); }
});

/* ============ startup refusals (run in separate processes because the server exits) ============ */
function boot(env) {
  const code = `const {bootServer}=require(${JSON.stringify(path.join(__dirname, 'stubs.js'))});bootServer(${JSON.stringify(env)});console.log('LOADED')`;
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', env: Object.assign({}, process.env, { NODE_ENV: '', ALLOWED_ORIGINS: '', ADMIN_TOTP_SECRET: '', RANKED_NEEDS_ACCOUNT: '' }) });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const PROD = { NODE_ENV: 'production', SEED_SECRET: 'prod-seed-secret-0123456789', ADMIN_KEY: 'prod-admin-key-0123456789ab', ADMIN_TOTP_SECRET: TOTP, ALLOWED_ORIGINS: ORIGIN };
test('startup: a complete production setup starts', () => { const r = boot(PROD); assert.equal(r.code, 0, r.out); assert.match(r.out, /LOADED/); });
test('startup: production REFUSES to start without ALLOWED_ORIGINS', () => {
  const r = boot(Object.assign({}, PROD, { ALLOWED_ORIGINS: null })); assert.equal(r.code, 1); assert.match(r.out, /ALLOWED_ORIGINS is not set\. Refusing to start/); assert.doesNotMatch(r.out, /LOADED/);
  const r2 = boot(Object.assign({}, PROD, { ALLOWED_ORIGINS: ' , ' })); assert.equal(r2.code, 1, 'blank entries do not count');
});
test('startup: production refuses a malformed or insecure origin list; a trailing slash is tolerated', () => {
  for (const bad of ['haggle.example.com', 'http://haggle.example.com', 'https://haggle.example.com/app', 'https://ok.example.com,notaurl'])
    assert.equal(boot(Object.assign({}, PROD, { ALLOWED_ORIGINS: bad })).code, 1, bad);
  assert.equal(boot(Object.assign({}, PROD, { ALLOWED_ORIGINS: 'https://haggle.example.com/,https://haggle.netlify.app' })).code, 0);
});
test('startup: production refuses without the owner second factor, with a weak owner key, or with ranked-needs-account switched off', () => {
  let r = boot(Object.assign({}, PROD, { ADMIN_TOTP_SECRET: null })); assert.equal(r.code, 1); assert.match(r.out, /ADMIN_TOTP_SECRET is required/);
  r = boot(Object.assign({}, PROD, { ADMIN_TOTP_SECRET: 'ABCD' })); assert.equal(r.code, 1); assert.match(r.out, /not a valid base32/);
  r = boot(Object.assign({}, PROD, { ADMIN_KEY: 'short-but-12ch' })); assert.equal(r.code, 1);
  r = boot(Object.assign({}, PROD, { RANKED_NEEDS_ACCOUNT: '0' })); assert.equal(r.code, 1); assert.match(r.out, /RANKED_NEEDS_ACCOUNT/);
});
test('startup: local development (no NODE_ENV) still starts without origins or a second factor', () => {
  const r = boot({ NODE_ENV: null, ADMIN_KEY: null, SEED_SECRET: null }); assert.equal(r.code, 0, r.out);
});
