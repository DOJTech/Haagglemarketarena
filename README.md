# Haggle
Built by Dolapo Oyatomi. (c) 2026, all rights reserved.

A daily market game with a server-run, cheat-resistant engine. Node + Postgres. No Claude or Anthropic services are used.

- **Go-live steps:** `docs/PRODUCTION_CHECKLIST.md`
- **What is protected and what is still open:** `docs/SECURITY_NOTES.md`
- **Deploy walkthrough, red flags, investors:** `docs/DEPLOY.md`, `docs/RED_FLAGS.md`, `docs/INVESTOR_BRIEF.md`
- **Owner metrics:** open `/#owner` on your site, tap Metrics, enter your `ADMIN_KEY`
- **Before public launch:** fill the [brackets] in `public/privacy.html` and `public/terms.html` and get a lawyer to review them.

## Run locally
```
cp .env.example .env      # edit the secrets and DATABASE_URL
npm ci
npm run dev
npm test                  # engine + name-filter tests; add TEST_DATABASE_URL for the API tests
```
- **Languages and Naija flavour:** `docs/LOCALIZATION.md`
- **Music, currency, weather:** `docs/MUSIC_AND_CURRENCY.md`

## Layout
`public/` the pages (game, owner, sponsor report, languages, radio, currency), `server.js` boot and shutdown, `app.js` routes and guards, `lib/engine.js` the game, `lib/moderation.js` names, `lib/config.js` settings checks, `lib/ratelimit.js` limits, `test/` tests.
