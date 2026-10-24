// Run: node --test test/security.unit.test.js   (no database, no network, no installed packages needed)
const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../lib/security');

// RFC 6238 Appendix B: the secret is the ASCII string 12345678901234567890 (SHA-1 vectors, 8 digits; we use the last 6).
const RFC_SECRET = S.base32Encode(Buffer.from('12345678901234567890'));
test('base32 round-trips and rejects junk', () => {
  assert.equal(RFC_SECRET, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.deepEqual(S.base32Decode(RFC_SECRET), Buffer.from('12345678901234567890'));
  assert.deepEqual(S.base32Decode('gezd gnbv-gy3t qojq gezd gnbv gy3t qojq'), Buffer.from('12345678901234567890'));
  assert.equal(S.base32Decode('not*base32!'), null);
  assert.equal(S.base32Decode(''), null);
  for (let i = 0; i < 50; i++) { const b = require('crypto').randomBytes(1 + (i % 30)); assert.deepEqual(S.base32Decode(S.base32Encode(b)), b); }
});
test('TOTP matches the official RFC 6238 test vectors', () => {
  for (const [t, code] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']])
    assert.equal(S.totpAt(RFC_SECRET, t * 1000), code, 'time ' + t);
});
test('verifyTotp: accepts current and adjacent step, refuses others, returns the step for replay protection', () => {
  const t = 1234567890 * 1000, step = Math.floor(t / 30000);
  assert.equal(S.verifyTotp(RFC_SECRET, '005924', t), step);
  assert.equal(S.verifyTotp(RFC_SECRET, '005 924', t), step, 'spaces allowed');
  assert.equal(S.verifyTotp(RFC_SECRET, S.totpAt(RFC_SECRET, t - 30000), t), step - 1, 'one step late');
  assert.equal(S.verifyTotp(RFC_SECRET, S.totpAt(RFC_SECRET, t + 30000), t), step + 1, 'one step early');
  assert.equal(S.verifyTotp(RFC_SECRET, S.totpAt(RFC_SECRET, t - 90000), t), null, 'three steps old is refused');
  assert.equal(S.verifyTotp(RFC_SECRET, '000000', t), null);
  for (const bad of ['', 'abcdef', '12345', '1234567', null, undefined, {}, '١٢٣٤٥٦']) assert.equal(S.verifyTotp(RFC_SECRET, bad, t), null, String(bad));
  assert.equal(S.verifyTotp('!!!', '005924', t), null);
});
test('new TOTP secrets are long enough and valid; short ones are refused', () => {
  const s = S.newTotpSecret();
  assert.ok(S.validTotpSecret(s)); assert.equal(S.base32Decode(s).length, 20); assert.notEqual(s, S.newTotpSecret());
  assert.ok(!S.validTotpSecret('ABCDEFGH')); assert.ok(!S.validTotpSecret('')); assert.ok(!S.validTotpSecret('0189'));
  assert.match(S.otpauthUri(s, 'owner', 'Haggle'), /^otpauth:\/\/totp\/Haggle%3Aowner\?secret=[A-Z2-7]+&issuer=Haggle/);
});
test('tokens: 256-bit, unique, validated, stored only as a hash', () => {
  const a = S.newToken(), b = S.newToken();
  assert.ok(S.okToken(a) && a !== b && a.length === 64);
  for (const bad of ['', 'x', a.slice(1), a.toUpperCase(), null, 5, a + 'a']) assert.ok(!S.okToken(bad));
  assert.notEqual(S.tokHash(a), a); assert.equal(S.tokHash(a), S.tokHash(a)); assert.equal(S.tokHash(a).length, 64);
});
test('passwords: hash is salted, verifies, and refuses wrong or malformed input', async () => {
  const h1 = await S.hashPassword('correct horse battery'), h2 = await S.hashPassword('correct horse battery');
  assert.notEqual(h1, h2, 'salted');
  assert.ok(!h1.includes('correct horse'));
  assert.ok(await S.verifyPassword('correct horse battery', h1));
  assert.ok(!(await S.verifyPassword('correct horse batterz', h1)));
  assert.ok(!(await S.verifyPassword('', h1)));
  for (const bad of ['', 'x', 'scrypt$1$2', 'md5$1$1$1$a$b', null, undefined]) assert.ok(!(await S.verifyPassword('x', bad)), String(bad));
  assert.ok(!(await S.verifyPassword('x', 'scrypt$1073741824$8$1$AAAA$AAAA')), 'a stored record cannot demand a huge memory cost');
});
test('password and username rules', () => {
  assert.equal(S.passwordProblem('short', 'bob'), 'password_too_short');
  assert.equal(S.passwordProblem('x'.repeat(129), 'bob'), 'password_too_long');
  assert.equal(S.passwordProblem('Password123', 'bob'), 'password_too_common');
  assert.equal(S.passwordProblem('aaaaaaaaaaaa', 'bob'), 'password_too_common');
  assert.equal(S.passwordProblem('myBOBpassword99', 'bob'), 'password_has_username');
  assert.equal(S.passwordProblem(12345678901, 'bob'), 'password_invalid');
  assert.equal(S.passwordProblem('a long unusual phrase', 'bob'), null);
  assert.equal(S.usernameProblem('ab'), 'username_too_short');
  assert.equal(S.usernameProblem('x'.repeat(21)), 'username_too_long');
  assert.equal(S.usernameProblem('<script>'), 'username_invalid_chars');
  assert.equal(S.usernameProblem('has space'), 'username_invalid_chars');
  assert.equal(S.usernameProblem('Ada_Lovelace-1.0'), null);
  assert.equal(S.usernameProblem(null), 'username_invalid');
});
test('concurrency gate: caps parallel work, queues, and refuses when the queue is full', async () => {
  const gate = S.createGate(2, 3); let run = 0, peak = 0;
  const job = () => gate(async () => { run++; peak = Math.max(peak, run); await new Promise(r => setTimeout(r, 20)); run--; return 1; });
  const ok = await Promise.all([job(), job(), job(), job(), job()]); // 2 running + 3 queued
  assert.equal(ok.length, 5); assert.ok(peak <= 2, 'peak ' + peak);
  const many = await Promise.allSettled(Array.from({ length: 10 }, job));
  assert.equal(many.filter(x => x.status === 'fulfilled').length, 5);
  assert.ok(many.filter(x => x.status === 'rejected').every(x => x.reason.busy));
  assert.equal(await gate(async () => 'still works'), 'still works', 'recovers afterwards');
  await assert.rejects(gate(async () => { throw new Error('boom'); }), /boom/);
  assert.equal(await gate(async () => 'and after an error'), 'and after an error');
});
// A tiny stand-in for the rate_hits table, so the limiter's logic can be tested here. The real SQL needs a real Postgres (see docs).
function fakeDb() {
  const rows = new Map();
  return async (sql, p) => {
    if (/^insert into rate_hits/.test(sql)) { const k = p[0] + '|' + p[1]; const n = (rows.get(k) || 0) + 1; rows.set(k, n); return { rows: [{ n }], rowCount: 1 }; }
    if (/^select n from rate_hits/.test(sql)) { const k = p[0] + '|' + p[1]; return rows.has(k) ? { rows: [{ n: rows.get(k) }], rowCount: 1 } : { rows: [], rowCount: 0 }; }
    throw new Error('unexpected sql ' + sql);
  };
}
test('limiter: counts per key and window, separate keys do not interfere, window rolls over', async () => {
  let t = 1_000_000_000_000; const L = S.createLimiter(fakeDb(), () => t);
  for (let i = 1; i <= 3; i++) assert.equal(await L.hit('login:a', 60), i);
  assert.equal(await L.hit('login:b', 60), 1);
  assert.equal(await L.count('login:a', 60), 3);
  assert.equal(await L.count('login:zzz', 60), 0);
  assert.equal(await L.over('x', 2, 60), false); assert.equal(await L.over('x', 2, 60), false); assert.equal(await L.over('x', 2, 60), true);
  assert.equal(await L.hit('login:a', 3600), 1, 'same key, different window length, is counted separately');
  t += 61_000;
  assert.equal(await L.hit('login:a', 60), 1, 'new window starts again');
});
test('two limiter instances on one database share counts (this is what makes it work across servers)', async () => {
  const db = fakeDb(), t = 5_000_000_000_000, A = S.createLimiter(db, () => t), B = S.createLimiter(db, () => t);
  await A.hit('k', 60); await B.hit('k', 60);
  assert.equal(await A.count('k', 60), 2);
});
