'use strict';
const { Pool } = require('pg');
const { loadConfig } = require('./lib/config');
const { createApp, log } = require('./app');

let cfg;
try { cfg = loadConfig(); } catch (e) { console.error(e.message); process.exit(1); }
cfg.warnings.forEach((m) => log('warn', m));

const pool = new Pool({
  connectionString: cfg.databaseUrl, ssl: cfg.ssl, max: cfg.poolMax,
  connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
  statement_timeout: 10000, idle_in_transaction_session_timeout: 15000,
  options: '-c timezone=UTC',   // leaderboard days are UTC days, the same as the server's clock
});
const { app, ready, stop } = createApp(cfg, pool);
ready.catch((e) => { log('error', 'Database not reachable', { err: e.message }); process.exit(1); });

const server = app.listen(cfg.port, () => log('log', 'Haggle up', { port: cfg.port, mode: cfg.mode }));
// Behind a load balancer: keep connections open longer than the balancer does, and drop slow clients.
server.keepAliveTimeout = 65e3; server.headersTimeout = 66e3; server.requestTimeout = 30e3;

let closing = false;
function shutdown(sig) {
  if (closing) return; closing = true; log('log', 'shutting down', { sig }); stop();
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
}
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(s)));
process.on('unhandledRejection', (e) => log('error', 'unhandledRejection', { err: String(e && e.message || e) }));
process.on('uncaughtException', (e) => { log('error', 'uncaughtException', { err: e.message }); shutdown('crash'); });
