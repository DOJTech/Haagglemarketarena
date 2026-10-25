# Monitoring and error tracking
Three layers. All work without extra software.

**1. Uptime monitor (tells you the site is down).** `BACKUPS_AND_MONITORING.md`, section 2.

**2. Error alerts (tells you the server is hurting).** The server counts internal errors and crashes. When 10 or more happen within 5 minutes it posts **one** message to a chat address you choose, then stays quiet for 15 minutes. It also posts if the server crashes and restarts.
- Pick a chat tool you read on your phone. In Discord: channel settings > Integrations > Webhooks > New Webhook > Copy URL. In Slack: create an Incoming Webhook. Both are free.
- On Render add `ALERT_WEBHOOK_URL` = that address (must start with `https://`). Treat it like a password: anyone with it can post to your channel.
- Test it: temporarily set `ALERT_WEBHOOK_URL`, then trigger by stopping your database for a minute in staging.

**3. Logs.** Render > haggle-game-api > Logs. The server writes one JSON line for each error, each request that takes over 3 seconds, and each failed email send. It never logs passwords, codes, request bodies or raw network addresses. Search for `"level":"error"`.

**Owner health view.** After signing in as owner, `GET /api/admin/ops` (same token header as the other owner pages) shows uptime, errors in the last 5 minutes, whether alerts are on, email mode and memory.

**Sentry or similar later.** A hosted error tracker gives stack traces grouped by bug and release. It needs one added library and a Sentry account; add it once you have users, and keep personal data out of the reports.

**What to watch weekly:** error count, slow requests, email failures, sign-up and verification rate, owner audit log (`/api/admin/audit`).
