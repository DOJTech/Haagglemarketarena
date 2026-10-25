# Haggle production checklist

Do these in order. Nothing here needs code changes.

## 0. What is in this package
The server (`server.js`, `app.js`, `lib/`), the pages (`public/`: game, owner metrics, sponsor report, languages) and the deploy files. **Keep your own `public/privacy.html` and `public/terms.html`** (they were not provided, so they are not here). Games saved by the previous version are refused politely (`old_version`) and their old leaderboard scores are not mixed into the new 1000-point board.

## 1. Deploy settings (Render, then Netlify)
1. Push to a **private** GitHub repository.
2. In Render: New > Blueprint > pick the repo. When asked, fill in:
   - `ALLOWED_ORIGINS` = your Netlify URL and any custom domain, `https` only, comma separated (no path).
   - `PROXY_SECRET` = a long random value. Generate one: `openssl rand -hex 32`.
3. In `netlify.toml`, put the **same** value in place of `PUT-YOUR-PROXY-SECRET-HERE`, and check the service name in the `to =` line matches your Render service (`haggle-api` by default).
4. Deploy Netlify. Open your site, play one practice game.
5. Confirm player addresses are read correctly: open `/#owner` or call `GET /api/admin/ip` with your `ADMIN_KEY`. `seenAs` must be **your own** public IP, not a Netlify or Render address. If it is wrong, change `TRUST_PROXY` on Render (try 1, 2 or 3) and recheck. If this is wrong, every player behind it shares one rate limit and one set of 3 ranked runs.
6. Never change `SEED_SECRET` after launch. It fixes the daily game and the public player refs.

## 2. Plans and backups
- The Blueprint uses a paid web service (`starter`) and `basic-256mb` database. Free Render web services sleep when idle (players see a long first load) and free databases are time-limited. Check current Render pricing.
- Confirm backups are on for your database plan in the Render dashboard, and do one restore test into a spare database before launch.
- Watch database disk and connections in Render metrics. Upgrade the plan before it is full.

## 3. Monitoring
- Add a free uptime monitor (UptimeRobot, Better Stack) on `https://YOUR-SITE/` and on `https://YOUR-RENDER-URL/healthz`, with alerts to your phone.
- Render logs are JSON lines. Search for `"level":"error"` after each release.

## 4. Before the public sees it
- Fill every `[bracket]` in `public/privacy.html` and `public/terms.html` and have a lawyer review them. The game stores a device ID, a hashed network address, a display name and a country. Nigerian users fall under the Nigeria Data Protection Act 2023, and players from the EU or UK fall under GDPR. Players can erase their data with the in-game delete (`/api/me/delete`); make sure the page links to it and your privacy page names a contact.
- Add a security contact: put your email in `SECURITY.md` and a `public/.well-known/security.txt`.
- Prizes, cash rewards or sponsored rankings can trigger gaming and promotion rules. Get advice before offering any.
- Run `npm test` and `npm run audit` (CI does this on every push). Turn on GitHub Dependabot alerts and branch protection for `main`.

## 5. Scaling limits (read before adding servers)
- The rate limiter, the "recently seen" cache and the leaderboard cache live in server memory, so run **one** instance (`numInstances: 1`). With 2+ instances limits are per instance and can be bypassed by alternating. A single `starter` instance is plenty for thousands of daily players because the work is small; when you outgrow it, move limits into the database or Redis first.
- Mobile networks put many players behind one address. `RATE_MAX` (600 per minute per address) and `NEW_ID_PER_IP_HOUR` (300) are deliberately generous. Lower them only if you see abuse in the logs.

## 6. Tuning without code
Set on Render: `BLOCKED_WORDS` (extra banned names), `RATE_MAX`, `MIN_RANK_MS`, `RANKED_PER_IP`, `NEW_ID_PER_IP_HOUR`, `REPORT_HIDE_AT`, `RETENTION_DAYS`, `PGSSL`.

## 7. Sponsors
Owner page > Sponsor campaigns: create (starts *pending*), **Approve** to go live, Copy report link for the sponsor. Nothing shows to players until you approve. Reports hide any group with fewer than 30 finished games.

## 8. Languages
Have a Nigerian Pidgin speaker and a French speaker read every screen (`docs/LOCALIZATION.md`).

## 9. Music and currency
Test the radio on a real Android and iPhone (docs/MUSIC_AND_CURRENCY.md lists what I could not verify). Replace the three starter playlists with ones you trust. Add a line to your terms that third-party players follow their own terms. Review the currency rates there every few months.

## 10. Weekly routine
Open `/#owner` > Reports, clear or ban reported names, glance at Metrics, check Dependabot pull requests.
