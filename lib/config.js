'use strict';
/* Reads and validates the environment. In production the server refuses to start on unsafe settings. */
function loadConfig(env = process.env) {
  const mode = env.NODE_ENV || 'production';
  const dev = mode === 'development' || mode === 'test';   // only these two modes may use built-in dev secrets
  const errors = [], warnings = [];
  const int = (v, d) => (Number.isFinite(+v) && +v >= 0 && v !== undefined && v !== '' ? Math.floor(+v) : d);

  const secret = env.SEED_SECRET || (dev ? 'dev-seed-secret-00000000000000000' : '');
  const adminKey = env.ADMIN_KEY || (dev ? 'dev-admin-key-000000000000' : '');
  const proxySecret = env.PROXY_SECRET || '';
  if (!dev) {
    if (secret.length < 32 || /change-me/i.test(secret)) errors.push('SEED_SECRET must be a random string of 32+ characters (not the example value).');
    if (adminKey.length < 24 || /change-me/i.test(adminKey)) errors.push('ADMIN_KEY must be a random string of 24+ characters (not the example value).');
    if (secret === adminKey) errors.push('SEED_SECRET and ADMIN_KEY must be different.');
    if (!env.DATABASE_URL) errors.push('DATABASE_URL is required.');
    if (proxySecret && proxySecret.length < 24) errors.push('PROXY_SECRET must be 24+ characters when set.');
    if (!proxySecret) warnings.push('PROXY_SECRET is not set: anyone who calls the Render URL directly can fake their IP address. See docs/PRODUCTION_CHECKLIST.md.');
  } else if (!env.DATABASE_URL && mode !== 'test') errors.push('DATABASE_URL is required.');

  // Normalise origins so a trailing slash in the setting can never silently block every request.
  const origins = [];
  for (const raw of (env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    try {
      const u = new URL(raw);
      if (!dev && u.protocol !== 'https:') errors.push('ALLOWED_ORIGINS must use https:// in production: ' + raw);
      origins.push(u.origin);
    } catch (e) { errors.push('ALLOWED_ORIGINS has an invalid entry: ' + raw); }
  }
  if (!dev && !origins.length) errors.push('ALLOWED_ORIGINS is required in production (your Netlify URL and any custom domain).');

  // Database TLS: Render's private (no dots) hostnames need none; public hosts get TLS.
  let host = ''; try { host = new URL(env.DATABASE_URL || 'postgres://x@localhost/x').hostname; } catch (e) { errors.push('DATABASE_URL is not a valid URL.'); }
  const mode_ssl = env.PGSSL || (dev || !host.includes('.') || host === 'localhost' ? 'off' : 'no-verify');
  if (!['off', 'no-verify', 'verify'].includes(mode_ssl)) errors.push('PGSSL must be off, no-verify or verify.');
  const ssl = mode_ssl === 'off' ? false : { rejectUnauthorized: mode_ssl === 'verify' };
  if (mode_ssl === 'no-verify') warnings.push('Database TLS is on but the certificate is not verified. Use the private Render URL or set PGSSL=verify with a CA.');

  if (errors.length) { const e = new Error('Invalid configuration:\n - ' + errors.join('\n - ')); e.config = true; throw e; }
  return {
    mode, dev, port: int(env.PORT, 3000), trustProxy: Math.max(1, int(env.TRUST_PROXY, 1)),
    secret, adminKey, proxySecret, origins, databaseUrl: env.DATABASE_URL, ssl, warnings,
    rateMax: int(env.RATE_MAX, 600), minRankMs: int(env.MIN_RANK_MS, 60000), rankedPerIp: int(env.RANKED_PER_IP, 3),
    newIdPerIpHour: int(env.NEW_ID_PER_IP_HOUR, 300), reportHideAt: Math.max(2, int(env.REPORT_HIDE_AT, 3)),
    retentionDays: Math.max(30, int(env.RETENTION_DAYS, 365)), poolMax: Math.max(2, int(env.PG_POOL_MAX, 10)),
    extraBlocked: (env.BLOCKED_WORDS || '').split(',').map((x) => x.trim()).filter(Boolean),
  };
}
module.exports = { loadConfig };
