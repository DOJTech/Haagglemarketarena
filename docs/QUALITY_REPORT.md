# Haggle Market Arena v2.0 beta: quality report
Verified facts are separated from assumptions. Nothing here claims the product is fully secure, enterprise-ready, production-ready, unique, or suitable for critical business decisions.

## A. Features retained
Seven-day simulation and ₦20,000 simulated start; buying, selling and haggling with hidden shopper limits; server-run authoritative engine; seeded daily ranked market; daily, weekly and country leaderboards; streaks; name reporting and owner moderation; "Delete my data"; owner Metrics (visitors, testers, plays, repeat players, D1/D7 return, countries); sponsor campaigns, price tests and brand reports; installable web app; cold-start retry; your privacy and terms pages (untouched).

## B. Features added
Arena landing page and brand copy; setup screen with simulated-balance and public-name notices; unique, validated display names; business dashboard (starting balance, cash, revenue, cost of goods sold, gross profit, gross margin, units bought and sold, stock, spoilage, transactions, satisfaction, campaign progress); transaction history; daily profit and loss; fixed seven-day campaign with objectives; plain-language consequences of accept, counter and let-go; loss-sale confirmation; customer satisfaction; documented 1000-point score with breakdown and a tip; honest aggregated Market insights; How it works page generated from the server rules; versioned, validated saved data with a reset path; one tested engine module (`engine.js`); full documentation set.

## C. Features repaired
Decimal money (D-01); repeating random events (D-04); silently altered names (D-05); third-party font calls (D-07); misleading Brand view (D-11); stack-trace error pages and server fingerprint header (D-08, D-09).

## D. Bugs found
15 (D-01 to D-15 in `DEFECT_REGISTER.md`). Two were my own: a duplicate HTML id found by a failing test (D-14) and low-contrast form borders found by calculation (D-15).

## E. Bugs fixed
D-01 to D-09 and D-11 to D-15. D-10 is only mitigated.

## F. Bugs still open
D-10 (partly), D-20 to D-29. Most important: no accounts (fake devices), and no real-device testing.

## G. Security findings and H. remediated
11 findings in `SECURITY_REVIEW.md`. Remediated: SEC-01, 02, 03, 05. Mitigated or open: SEC-04, 06, 07, 08, 09, 10. SEC-11: 0 known vulnerabilities in production dependencies when checked.

## I. Tests executed (actual results)
| Suite | Result |
|---|---|
| Engine unit tests (`test/engine.unit.test.js`) | 28 of 28 passed |
| Simulated-browser tests (jsdom) | 31 of 31 passed |
| Names, reporting, ban, erasure (API) | 33 of 33 passed |
| Leagues, streaks, retention, headers, install files (API) | 16 of 16 passed |
| Sponsor campaigns and reports (API) | 27 of 27 passed |
| Anti-cheat (API) | 19 of 19 passed |
| Security (local server) | 58 of 58 passed |
| **Total** | **212 of 212 passed** |
| Load: 30 simulated players at once | 30 finished, 2,458 requests in 21 s, 0 server errors, response time p50 23 ms, p95 97 ms, p99 329 ms (small test machine, indicative only) |
| Accessibility scan (axe-core) | 0 violations on 8 screens (colour-contrast rule not available in the simulated browser) |
| Contrast from design tokens | First palette: 2 failures (form-field borders), fixed; all checked pairs now pass |
| Pre-deploy checks | Every page, script and style answers 200 locally; no third-party hosts; no inline style attributes in player code; no console errors while using every tab; `npm audit` found 0 vulnerabilities |

Your 25-item test list: covered by the suites above, except **partly covered**: item 16 (tie-break order is documented but not separately tested), item 20 (mobile navigation: markup and layout rules only, no real touch or small-screen run) and item 21 (keyboard: structure, labels and the axe scan only, not real keyboard walking).

## J. Tests that could not be run
Real phones, tablets, laptops and browsers; screen readers; Lighthouse or timing on real networks; a Netlify deploy preview; production; more than 30 simulated players; database backup and restore; penetration testing beyond the scripted checks; rendered colour contrast (checked from the colour values instead).

## K. Performance and accessibility
Gzipped sizes: page 1.3 KB, styles 2.2 KB, shared script 2.0 KB, game script 9.2 KB. The owner script (2.7 KB) loads only for the owner. No fonts, images or libraries are fetched. Reduced motion respected (no animation). Touch targets 44 px or larger on touch screens. Not measured: real-device speed.

## L. Known limitations
See D-20 to D-29. Also: scoring weights are provisional; simulated prices are not real market prices; results do not predict real markets; single-player only.

## M. Deployment status
**Not deployed.** The live site is untouched. A baseline tag exists only in my working copy; create your own GitHub release as in `DEPLOYMENT_CHECKLIST.md`.

## N. Rollback
`docs/ROLLBACK.md`, including a required database step.

## O. Recommended next stage
1. Deploy to a branch preview and test on 3 or more real phones, a tablet and a laptop.
2. Add sign-in (phone or email) to close the fake-device gap.
3. Calibrate the score with real play data, then update `engine.js` and the tests.
4. Add automatic data expiry, then update the privacy page.
5. Only then consider multiplayer negotiation.

## Verified versus assumed
Verified: everything in section I. Assumed: that simulated-browser tests reflect real browsers; that the free hosting and database behave as in testing; that the scoring weights feel fair to players.

## v2.1 security update: tests actually executed
| Suite | Result |
|---|---|
| `test/engine.unit.test.js` | 28 of 28 pass |
| `test/security.unit.test.js` (new) | 10 of 10 pass, including the official RFC 6238 vectors |
| `test/harness/wiring.test.js` (new, real `server.js` against a fake database) | 21 of 21 pass; five deliberate code breakages were each caught |
| `test/accounts.test.js` (new, real Postgres) | **Not run** (no database where this was prepared) |
| Older integration and browser suites | **Not run.** Five were edited for the new owner login; the browser suite does not cover the new account box |
Treat this release as untested on a real database until you have run `accounts.test.js` and the older suites.
