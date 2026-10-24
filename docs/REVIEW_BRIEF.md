# Independent security review: what it is and how to get one
**I cannot do this for you.** The code and its tests were written by me (an AI model) in the same sessions, so I share my own blind spots. A person with security experience who did not write the code must review it, attack a staging copy, and check your hosting accounts. Budget for it before taking real users or sponsor money.

## What to hand a reviewer
This zip, `docs/SECURITY_REVIEW.md`, `docs/RED_FLAGS.md`, and a **staging** deployment (separate database, separate secrets, test data only). Never give access to production data or the real owner key.

## Scope to ask for
1. Code review of `server.js`, `engine.js`, `lib/security.js`, and the browser files.
2. Authentication: password storage, sessions, owner TOTP, lockouts, account takeover and enumeration.
3. Game integrity: can a score be forged, replayed or raced?
4. Abuse: ranking farming, fake accounts, report abuse, name filter bypass.
5. Denial of service on staging only. **Check Render's and Netlify's rules first; most require notice or forbid it.**
6. Hosting accounts and secrets (checklist below).
7. Dependency and supply-chain check (`npm audit`, lockfile, GitHub settings).
8. A written report with severities, reproduction steps and a retest after fixes.

## Things I already know are weak (please attack these)
- Session and device tokens live in browser storage, so any script injection exposes them. CSP `script-src 'self'` is the only barrier, and `style-src` still allows inline styles.
- The database connection does not verify the server certificate unless `DB_SSL_STRICT=1`.
- Limits are per network address; shared mobile networks can punish real players and many-address attackers get around them.
- Failing 10 times locks a username for 15 minutes (a nuisance attack).
- Registering claims an existing device ID; there is no password reset and no email or phone verification.
- The owner key and TOTP secret are both plain Render environment variables.
- Rate limiting is untested beyond about 30 simulated players. No DoS test has ever been run.
- Name filter and ad brand-safety lists are starter lists.

## Hosting-account checklist (you can do this today)
- [ ] Two-factor sign-in on GitHub, Render, Netlify, the database host, your domain registrar, and the email account all of them use.
- [ ] GitHub: private repo, branch protection on `main`, secret scanning and Dependabot on, no secrets in the repo history.
- [ ] Render: only you (and named people) have access; environment variables hold all secrets; deploys only from `main`.
- [ ] Netlify: no environment secrets; deploy previews do **not** point at the production database (or add them to `ALLOWED_ORIGINS` only while testing).
- [ ] Domain: registrar lock on, auto-renew on.
- [ ] Rotate `ADMIN_KEY` and `ADMIN_TOTP_SECRET` if anyone else has ever seen them.
- [ ] Backups on, and one restore drill done (`BACKUPS_AND_MONITORING.md`).
