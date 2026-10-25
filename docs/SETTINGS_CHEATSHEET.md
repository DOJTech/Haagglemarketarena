# Every setting, and exactly what to put in it

## Netlify: environment variables = NONE
Netlify only serves the web pages and forwards `/api` to Render. **Do not add any environment variables on Netlify.** All secrets live on Render. (Putting secrets on Netlify would be a mistake.)

What Netlify does need are three ordinary site settings, not variables:
| Setting (Site configuration > Build & deploy) | Value |
|---|---|
| Branch to deploy | `main` |
| Build command | leave empty |
| Publish directory | `public` |

And your repo's `netlify.toml` must forward `/api` to your Render service. Your file is not in this zip, so compare yours with this and only change the address if it differs. Your Render service is called `haggle-game-api`, so its address is probably `https://haggle-game-api.onrender.com` (the real one is shown at the top of the service page on Render):
```
[[redirects]]
  from = "/api/*"
  to = "https://haggle-game-api.onrender.com/api/:splat"
  status = 200
  force = true
```

## Render > haggle-game-api > Environment (these are the real settings)
| Key | Value | Where the value comes from |
|---|---|---|
| NODE_ENV | `production` | type it |
| DATABASE_URL | the database address | Render > your Postgres > **Internal Database URL** (use the internal one when both are on Render in the same region) |
| SEED_SECRET | 32 or more random characters | make with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **If you already have one, keep it.** Changing it changes every future daily market |
| ADMIN_KEY | 20 or more random characters | `npm run make-owner-secret -- --key` |
| ADMIN_TOTP_SECRET | a base32 code, 32 characters | the same command; also type it into your authenticator app |
| ALLOWED_ORIGINS | `https://your-site.netlify.app` | your Netlify address, `https://`, no slash, no path. Add a custom domain after a comma |
| TRUST_PROXY | `2` | Netlify then Render. Check it with the "real address" test in `DEPLOY.md` |
| RESEND_API_KEY | `re_...` | Resend dashboard > API Keys (see `EMAIL_SETUP.md`) |
| EMAIL_FROM | `Haggle <no-reply@yourdomain.com>` | must use the domain you verified in Resend |
| ALERT_WEBHOOK_URL | `https://...` (recommended) | a Discord or Slack webhook address (see `MONITORING.md`) |
| DB_SSL_STRICT | `1` (recommended, after testing) | set it, redeploy, check the site still loads; remove it if not |

Render supplies `PORT` itself. **Do not set it.**

**Never set these on the real site** (they exist only for local testing; production refuses to start with the first four): `RANKED_NEEDS_ACCOUNT=0`, `RANKED_NEEDS_VERIFIED_EMAIL=0`, `MAIL_MODE`, `MAIL_OUTBOX`, `RATE_MAX`, `MIN_RANK_MS`.

### Optional tuning (the defaults are fine; leave these out until you have real players)
`REGISTER_PER_IP_DAY` 20, `REGISTER_PER_HOUR_ALL` 300, `LOGIN_PER_IP_15MIN` 40, `LOGIN_FAILS_PER_USER_15MIN` 10, `START_PER_PLAYER_HOUR` 60, `START_PER_IP_HOUR` 300, `NEW_DEVICES_PER_IP_HOUR` 200, `MAIL_PER_ACCOUNT_HOUR` 5, `MAIL_PER_IP_HOUR` 15, `MAIL_PER_HOUR_ALL` 200, `SESSION_DAYS` 14, `ADMIN_SESSION_MIN` 30, `MIN_REPORT_N` 30, `MIN_INSIGHT_SHOPPERS` 30, `MIN_INSIGHT_GAMES` 10.
Many phones share one mobile-network address, so if real players report "slow down" messages, raise the per-network ones (`REGISTER_PER_IP_DAY`, `LOGIN_PER_IP_15MIN`, `START_PER_IP_HOUR`).

## Staging copy
Same list with **different** values for `SEED_SECRET`, `ADMIN_KEY`, `ADMIN_TOTP_SECRET`, `DATABASE_URL` and `ALLOWED_ORIGINS` (see `STAGING.md`). Never share any secret between staging and the real site.

## After changing anything
Render restarts by itself. Wait for **Live**, then open your site, then `/api/stats` on your Netlify address (should show numbers, not an error). If the logs say "Refusing to start", the message names the missing setting.
