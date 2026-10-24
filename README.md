# Haggle
Built by Dolapo Oyatomi. (c) 2026, all rights reserved.

Haggle Market Arena (v2.0 beta): a market negotiation simulation with a server-run engine. Simulation only; no real money. Node + Postgres. No Claude or Anthropic services are used.

- **Deploy:** `docs/DEPLOY.md` (GitHub, then Render for the server and database, then Netlify for the pages)
- **Sponsors and price tests (what it is and is not):** `docs/AD_PLATFORM.md`; validating results: `docs/PILOT_PLAYBOOK.md`
- **Security status, accounts and owner sign-in:** `docs/SECURITY_REVIEW.md`; independent-review brief and hosting-account checklist: `docs/REVIEW_BRIEF.md`; backups and uptime monitoring: `docs/BACKUPS_AND_MONITORING.md`
- **Tests:** `npm run test:unit` needs no database; the full suites need a scratch Postgres (see `docs/DEPLOY.md`)
- **Rules and scoring:** `docs/RULES.md` (generated from `engine.js`)
- **Quality report, defects, security review:** `docs/QUALITY_REPORT.md`, `docs/DEFECT_REGISTER.md`, `docs/SECURITY_REVIEW.md`
- **Deploy safely and roll back:** `docs/DEPLOYMENT_CHECKLIST.md`, `docs/ROLLBACK.md`
- **Something not working?** `docs/TROUBLESHOOTING.md`
- **Red flags and status:** `docs/RED_FLAGS.md`
- **For investors:** `docs/INVESTOR_BRIEF.md`
- **Owner metrics:** open `/#owner` on your site, tap Metrics, enter your `ADMIN_KEY` and the code from your authenticator app (set up once with `npm run make-owner-secret`)
- **Before public launch:** fill the [brackets] in `public/privacy.html` and `public/terms.html` and get a lawyer to review them.

How cheating is blocked, how moderation works, and what is still open are all in `docs/RED_FLAGS.md`.
