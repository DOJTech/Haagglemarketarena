# Security notes: what changed and what is still open

## Fixed in this release
| Problem | Fix |
|---|---|
| `netlify.toml` had `https://https://...`, so every API call from the Netlify site would have failed | Corrected; proxy now also sends a secret header |
| A crafted product id such as `__proto__` or `constructor` passed validation and corrupted a player's cash | Product ids are checked against a Map; regression-tested with fuzzing |
| Anyone could call the Render URL directly and fake their IP address | Optional `PROXY_SECRET` locks `/api` to the Netlify proxy |
| Server started with built-in dev secrets whenever `NODE_ENV` was not `production` | Dev secrets only in `development` or `test`; production refuses weak, example or missing secrets, missing `ALLOWED_ORIGINS`, non-https origins |
| Trailing slash in `ALLOWED_ORIGINS` silently blocked every request | Origins are normalised |
| Database connection skipped TLS certificate checks | Private Render address uses no TLS (never leaves Render's network); public hosts use TLS; `PGSSL=verify` available |
| "3 ranked runs per network" could be beaten with parallel requests | Done inside one transaction with a lock per network and day |
| Ranked slot could be lost if the run failed to save | Slot and run are created together or not at all |
| Unlimited fake players from one address; unlimited abandoned runs | New-player limit per address per hour; max 5 unfinished practice runs per player; per-device limits on ping, start, act, report, delete |
| Report brigading: 3 throwaway devices could hide anyone's score | Needs 3 players on at least 2 different networks |
| Banned players could still post a ranked score from a run already in progress | Checked when the run finishes |
| Deleting your data also deleted the daily-limit record (free extra ranked runs) | Limit row is detached from the device, not removed |
| Name filter blocked real names (Nazir, Nazia) and missed look-alike letters | Whole-word matching for short words, Unicode normalisation, look-alike map, `BLOCKED_WORDS` setting |
| Database grew without limit (full hidden week stored per game) | Finished runs are compacted; old data pruned (`RETENTION_DAYS`) |
| Admin lockout counted successes; no `Retry-After` | Failed-attempt lockout (10 per 15 minutes per address), `Retry-After` on limits |
| Body parsing ran before rate limiting; errors returned HTML | Order fixed; all API errors are JSON, never stack traces |
| No graceful shutdown, no DB timeouts, idle-client crashes, keep-alive 502s behind the balancer | Added (SIGTERM drain, statement timeouts, pool error handler, 65 s keep-alive) |
| Extra headers | COOP, CORP, `object-src 'none'`, wider Permissions-Policy, `no-store` on all API responses, `X-Powered-By` removed |
| Dependencies | Express 4.22.3, pg 8.23.1, `npm audit` clean; CI + Dependabot added |

## Added to match the pages
Unique display names (look-alike letters and punctuation are treated as the same name), 1000-point scoring computed on the server, `rules` and `insights` endpoints (insights stay hidden below 30 games and 30 shoppers), sponsor campaigns that only appear after you approve them, price tests only in practice games, private sponsor report links, and a clean `old_version` answer for games saved by the previous version.

## Still open (be honest with investors and players)
1. **Daily-seed learning.** Everyone's ranked game uses the same hidden week. A determined cheater with several devices or networks could play a ranked run to learn customers, then use that knowledge on another. Limits (3 ranked runs per network, minimum finish time, hiding and banning) make it costly, not impossible. The game also shows the customer's hidden maximum after each deal ("left on the table"), which makes learning easier. Options if it becomes a problem: widen the per-run price jitter, hide post-deal maxima in ranked runs, or require accounts.
2. **Device IDs are bearer tokens.** There are no accounts. Whoever holds an ID can use that player. The pages do generate IDs with `crypto.getRandomValues` (checked), so they cannot be guessed, but anyone who copies one from a device can act as that player.
3. **Bots.** Nothing stops a script from playing a legitimate-looking ranked game slowly. Use the owner Reports tool, and add a CAPTCHA (for example Cloudflare Turnstile) before any prize is offered.
4. **Single instance** (see the checklist).
5. **Translations need a native review** (see `docs/LOCALIZATION.md`).
6. **`privacy.html` and `terms.html` were not provided**, so they are not in this package. Keep yours, and fill the [brackets].

## Music (new)
- The security policy now allows audio from any https site and frames from four named services (Spotify, YouTube privacy-enhanced, Apple Music, Audiomack). Links are checked by one shared allowlist on the pages and the server; hostile links are refused. Embedded players are sandboxed.
- Anything a player plays from a link still contacts that service or site (as any link would), so a direct audio link reveals the player's IP address to that host. The pages say direct links use mobile data.
- The owner shelf is admin-only, capped at 30 and uses the same allowlist.

## Pages (public/)
- Reviewed: no inline scripts or handlers (so the strict `script-src 'self'` policy holds), every server value is escaped before it is shown, saved data on the device is validated, device IDs are cryptographically random.
- Tightened: the policy no longer allows external fonts (none are used); the service worker never caches `/api`, owner or sponsor-report pages; `report.html` is `no-store` and `noindex`.
- Fixed: share used to fail silently (now uses the phone's share sheet); the page now notices going offline and coming back; the pages work when the server is restarting (retry with a clear message).
