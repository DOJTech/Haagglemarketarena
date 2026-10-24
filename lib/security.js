// Security helpers with no third-party dependencies, so they can be unit-tested without a database or web server.
const crypto = require('crypto');

/* ---------- tokens ---------- */
const newToken = () => crypto.randomBytes(32).toString('hex'); // 256 bits
const okToken = s => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
// Only the hash of a token is stored, so a database leak does not hand out working sessions.
const tokHash = t => crypto.createHash('sha256').update(String(t)).digest('hex');

/* ---------- TOTP (RFC 6238, SHA-1, 6 digits, 30 s) : the owner's second factor ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(s) {
  const clean = String(s).toUpperCase().replace(/[\s=-]/g, '');
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0, val = 0;
  const out = [];
  for (const ch of clean) {
    val = (val << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
const base32Encode = buf => {
  let bits = 0, val = 0, out = '';
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
};
const newTotpSecret = () => base32Encode(crypto.randomBytes(20)); // 160 bits, the size RFC 4226 recommends
const validTotpSecret = s => { const b = base32Decode(s); return !!b && b.length >= 16; }; // 128 bits minimum
function hotp(key, counter, digits = 6) {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(c).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, '0');
}
const totpAt = (secretB32, ms, digits = 6) => hotp(base32Decode(secretB32), Math.floor(ms / 1000 / 30), digits);
// Returns the matching 30-second step number (so the caller can refuse a replay), or null. Accepts one step either side for clock drift.
function verifyTotp(secretB32, code, ms, window = 1) {
  const key = base32Decode(secretB32);
  if (!key || !/^\d{6}$/.test(String(code).replace(/\s/g, ''))) return null;
  const given = Buffer.from(String(code).replace(/\s/g, ''));
  const now = Math.floor(ms / 1000 / 30);
  let hit = null;
  for (let d = -window; d <= window; d++) { // no early exit: the loop takes the same time whatever the code
    const want = Buffer.from(hotp(key, now + d));
    if (crypto.timingSafeEqual(want, given) && hit === null) hit = now + d;
  }
  return hit;
}
const otpauthUri = (secretB32, label, issuer) =>
  'otpauth://totp/' + encodeURIComponent(issuer + ':' + label) + '?secret=' + secretB32 + '&issuer=' + encodeURIComponent(issuer) + '&algorithm=SHA1&digits=6&period=30';

/* ---------- passwords (scrypt, salted, parameters stored with the hash so they can be raised later) ---------- */
const SCRYPT = { N: 16384, r: 8, p: 1 };
const scryptAsync = (pw, salt, len, o) => new Promise((res, rej) => crypto.scrypt(pw, salt, len, Object.assign({ maxmem: 64 * 1024 * 1024 }, o), (e, k) => e ? rej(e) : res(k)));
// scrypt runs on a small shared thread pool. Without a cap, a flood of logins would starve the whole server.
function createGate(max, maxQueue) {
  let running = 0; const q = [];
  const next = () => { while (running < max && q.length) { running++; q.shift()(); } };
  return fn => new Promise((res, rej) => {
    if (q.length >= maxQueue) return rej(Object.assign(new Error('busy'), { busy: true }));
    q.push(() => Promise.resolve().then(fn).then(res, rej).finally(() => { running--; next(); }));
    next();
  });
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const k = await scryptAsync(pw, salt, 64, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), k.toString('base64')].join('$');
}
async function verifyPassword(pw, stored) {
  const p = String(stored).split('$');
  if (p.length !== 6 || p[0] !== 'scrypt') return false;
  const [N, r, pp] = [+p[1], +p[2], +p[3]];
  if (!(N <= 1 << 17 && r <= 16 && pp <= 4)) return false; // never let stored data pick a huge cost
  const want = Buffer.from(p[5], 'base64');
  const got = await scryptAsync(pw, Buffer.from(p[4], 'base64'), want.length, { N, r, p: pp });
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
const COMMON = new Set(['password', 'password1', 'password12', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'qwerty12345', 'iloveyou12', 'letmein123', 'welcome123', 'abcdefghij', 'admin12345', 'haggle1234', 'haggle12345', '0123456789', '1111111111', '0000000000']);
function passwordProblem(pw, username) {
  if (typeof pw !== 'string') return 'password_invalid';
  if (pw.length < 10) return 'password_too_short';
  if (pw.length > 128) return 'password_too_long';
  const lc = pw.toLowerCase();
  if (COMMON.has(lc) || /^(.)\1+$/.test(pw)) return 'password_too_common';
  if (username && lc.includes(String(username).toLowerCase())) return 'password_has_username';
  return null;
}
const usernameProblem = u => {
  if (typeof u !== 'string') return 'username_invalid';
  if (u.length < 3) return 'username_too_short';
  if (u.length > 20) return 'username_too_long';
  if (!/^[A-Za-z0-9_.-]+$/.test(u)) return 'username_invalid_chars';
  return null;
};

/* ---------- rate limiter shared through the database (works across several servers and restarts) ---------- */
// `query` is a function (sql, params) => Promise<{rows,rowCount}>. Windows are fixed; each key is counted per window.
function createLimiter(query, now = () => Date.now()) {
  const win = sec => Math.floor(now() / 1000 / sec);
  const key = (k, sec) => sec + ':' + k;
  return {
    // Counts one hit and returns the number of hits in the current window.
    async hit(k, sec) {
      const w = win(sec);
      const r = await query('insert into rate_hits(k,w,exp,n) values($1,$2,to_timestamp($3),1) on conflict(k,w) do update set n=rate_hits.n+1 returning n', [key(k, sec), w, (w + 1) * sec]);
      return r.rows[0].n;
    },
    // Reads the count without adding to it (used for lockouts that only count failures).
    async count(k, sec) {
      const r = await query('select n from rate_hits where k=$1 and w=$2', [key(k, sec), win(sec)]);
      return r.rowCount ? r.rows[0].n : 0;
    },
    async over(k, max, sec) { return (await this.hit(k, sec)) > max; },
  };
}

module.exports = { newToken, okToken, tokHash, base32Decode, base32Encode, newTotpSecret, validTotpSecret, hotp, totpAt, verifyTotp, otpauthUri,
  hashPassword, verifyPassword, createGate, passwordProblem, usernameProblem, createLimiter };
