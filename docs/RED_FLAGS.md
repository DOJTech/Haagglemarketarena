# Red-flag register (honest status)

| # | Concern (who asks) | Status | Evidence / what is left |
|---|---|---|---|
| 1 | Scores can be faked (Investor, CSO) | Fixed in code | Server runs the whole game; hidden prices never reach the page; actions checked for phase, values and speed. 19 + 33 + 16 automated checks pass. |
| 2 | Bots and farming rankings (CSO, CRO) | Mitigated, not solved | v2.1: ranked play needs an account; account creation, new-device creation and game starts are capped per network and counted in the database. One ranked run per account per day, 3 per network, 60-second minimum. **Open:** nothing proves an account is a real person; a patient attacker with many addresses can still make many accounts. Needs verified phone or email (a provider and your decision). |
| 3 | Offensive names, abuse (Risk, Legal) | Fixed | Server name filter, report button (3 reports hide), owner Keep/Ban. Starter word list: extend it. |
| 4 | Personal data and erasure (Legal) | Fixed in code | No real names, numbers or emails collected; hashed network address; "Delete my data" button. Open: lawyer-reviewed privacy policy and terms (drafts included). |
| 5 | Playing-now count resets (CTO) | Fixed | Stored in the database; survives restarts and more than one server. |
| 6 | Wrong player addresses behind Netlify and Render (CTO, CSO) | Handled | `TRUST_PROXY` setting plus owner check `/api/admin/ip`. Must be verified after deploy (DEPLOY.md step 4.2). |
| 7 | Anyone can call the API from another website (CSO) | Fixed | `ALLOWED_ORIGINS` lock: 403 for no/evil origin, 200 for yours. v2.1: production **refuses to start** if it is missing or malformed. It stops other websites only; a script can fake the header, so it is not bot protection. |
| 8 | Missing browser protections (CSO) | Fixed | CSP, HSTS, no-framing, permissions policy on both Netlify and the server. |
| 9 | Scale (CTO) | Indicative only | 30 simulated players at once on a small test machine: 0 server errors, p95 79 ms. Not a production load test. Each move rewrites a game record; for thousands of simultaneous players move live game state to a cache. |
| 10 | No proof of demand (Investor) | Open | Zero real users so far. The Metrics tab measures D1/D7 return, plays and repeat players once people play. |
| 11 | Revenue unproven (Investor, CRO) | Open | Sponsor campaigns, price tests, brand reports and invoicing records are built and tested (27 checks). No sponsor has paid yet. |
| 12 | Simulated market events (Product) | Open | Needs a real price source. |
| 13 | Company, IP, contracts (Legal) | Owner task | Register the company; assign IP; code is marked (c) Dolapo Oyatomi, all rights reserved. |
| 14 | Backups, monitoring, uptime (CTO) | Owner task, now with scripts and a guide | `scripts/backup.sh`, `scripts/restore-check.sh` and `docs/BACKUPS_AND_MONITORING.md` added (shell syntax checked only; **not run**). Nothing is automatic until you switch on provider backups or schedule the script and set up a monitor. |
| 15 | Gambling rules (Legal) | Designed out | No real money or prizes. Keep it that way, or take legal advice first. |
| 16 | "Ad exchange" claim (Investor) | Not claimed | Described as an early sponsored price-test platform. Built: ad serving, brand-safety rules with approval, reporting, invoicing records. Not built: bidding, advertiser sign-up, automated payments. See `AD_PLATFORM.md`. |
| 17 | Automated advertiser payments (CFO, Legal) | Owner task | Needs a registered business and a payment provider's approval (for example Paystack or Flutterwave). Until then, invoice outside the app. |
| 18 | Do game results predict real shoppers? (Investor, Brand) | Open | Reports carry a plain warning. Prove it with `PILOT_PLAYBOOK.md` before claiming it. |
| 19 | "Best for every business" (Marketing, Legal) | Never claim | Use: "early product, looking for first pilot partners." |

## v2.0 (Haggle Market Arena) update
| # | Item | Status |
|---|---|---|
| 20 | Money accuracy | Fixed: whole-naira integers, single tested engine (28 tests incl. 60 random weeks) |
| 21 | Display names unique, validated, public-name notice before start | Fixed |
| 22 | Honest market insights | Done: aggregated, thresholded (30 shoppers, 10 games), labelled as simulation |
| 23 | Accessibility | Automated scan clean on 8 screens; contrast computed. **Not tested** with real assistive technology or devices |
| 24 | Real-device testing | **Open.** Only simulated-browser tests were run |
| 25 | Calibrated scoring | **Open.** Weights are starting values |
| 26 | Multiplayer and AI negotiation | **Not built** |
Full details: `DEFECT_REGISTER.md`, `SECURITY_REVIEW.md`, `QUALITY_REPORT.md`.


## v2.1 (security hardening) update
| # | Item | Status |
|---|---|---|
| 27 | Owner key has no second factor | Fixed in code: key + one-time code, 30-minute sessions, lockout, audit log. **You must create `ADMIN_TOTP_SECRET`** (`npm run make-owner-secret`) or the production server will not start |
| 28 | Device ID alone identifies a player | Fixed for players who create an account. Players without one are practice-only |
| 29 | Rate limits only in memory | Sensitive limits now in the database (shared across servers). General limiter unchanged. No network-level DoS protection |
| 30 | Independent security review | **Open. Cannot be done by the author.** See `REVIEW_BRIEF.md` |
| 31 | Privacy page still a draft | **Open. Owner and lawyer task.** `PRIVACY_NOTES.md` lists what the code now collects |
| 32 | New code tested only against a fake database | **Open.** Run `test/accounts.test.js` and the other suites on a real Postgres before deploying |
