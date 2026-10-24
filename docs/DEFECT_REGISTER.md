# Defect register (baseline v1.2 inspected, then upgraded to v2.0)
Evidence types: **Reproduced** = shown by running the code. **Code reading** = found by inspection only. Nothing is marked fixed without a test that passes.

| ID | Sev | Finding at baseline | Evidence | Status in v2.0 | Verified by |
|---|---|---|---|---|---|
| D-01 | High | Money was stored as decimals (for example `spent: 14256.714285714284`) | Reproduced (database inspection after a played week) | **Fixed.** Whole-naira integers; average-cost COGS with exact conservation | 28 engine tests, incl. 60 random weeks checking every total stays an integer and cash + stock − start = revenue − COGS − spoilage |
| D-02 | High | No gross profit, COGS, margin, units, satisfaction, transaction history or daily P&L (required by the spec) | Code reading + tab inventory | **Added** | Engine tests; browser tests (dashboard and history update after buying and selling) |
| D-03 | Med | Score was profit only: rewarded profit at any cost, ignored customers | Code reading | **Replaced** by the documented 1000-point formula | Tests: revenue alone not rewarded; lowest price not automatically best; doing nothing = 0; always 0 to 1000. Weights are provisional |
| D-04 | Med | Each day's event was picked at random with replacement, so the same event could repeat | Code reading (not reproduced) | **Replaced** by a fixed seven-day campaign | Test: seven distinct documented days |
| D-05 | Med | Display names not unique; blocked names were silently replaced | Code reading + tests | **Fixed.** Unique (case-insensitive), 3 to 20 characters, clear refusal messages | Moderation suite (33) and browser tests |
| D-06 | Low | Public-name notice only inside "About" | Reproduced | **Fixed.** Shown on the setup screen before starting | Browser test |
| D-07 | Med | Google Fonts requested on every page load (not disclosed in the privacy page) | Reproduced (page source) | **Fixed.** System fonts; no third-party requests | Pre-deploy scan: none |
| D-08 | Low | `X-Powered-By: Express` header exposed | Reproduced | **Fixed** | Security suite |
| D-09 | Med | Malformed JSON returned an error page with a stack trace and server file path (development mode) | Reproduced | **Fixed.** Generic JSON error | Security suite. Production-mode behaviour of the old code was not tested |
| D-10 | Med | If `ALLOWED_ORIGINS` is unset in production, any website may post to the API | Code reading | **Mitigated only.** Loud warning at start-up; still open if you forget to set it | Origin-lock tests (set: refused/allowed correctly) |
| D-11 | Low | Public "Brand view" showed only the visitor's own session, which looked like market data | Code reading | **Replaced** by aggregated, thresholded insights with honest empty states | Browser tests, API smoke |
| D-12 | Med | Accessibility: no skip link; tab buttons used toggle semantics; local storage unvalidated | Code reading | **Fixed** | axe scan clean on 8 screens; browser tests |
| D-13 | Low | Saved data on the device was not versioned or validated | Code reading | **Fixed.** Versioned; invalid values dropped; reset path | Browser test: corrupted data |
| D-14 | Med | **Found during this upgrade (my own bug):** the landing "How it works" button and the How tab shared one HTML id, so opening the tab overwrote the button | Reproduced by a failing test | **Fixed** | Browser test (unique ids) |
| D-15 | Low | **Found by contrast calculation:** my first palette's form-field borders failed the 3:1 rule | Reproduced (calculation) | **Fixed** (new control border colour) | Contrast table: all pass |

## Still open
| ID | Sev | Item |
|---|---|---|
| D-20 | Med | No accounts: a device ID is the only identity. Fake devices on many networks can still farm ranked slots |
| D-21 | Med | No testing on real phones, tablets, browsers or screen readers; no Lighthouse measurements |
| D-22 | Low | Free-tier hosting sleeps; first visit after quiet time is slow (retry handling hides, not removes, this) |
| D-23 | Low | Names with 6 or more digits in a row are refused (phone-number protection), which also blocks some harmless names |
| D-24 | Low | Scoring weights and the ₦12,000 profit target are starting values, not calibrated with real players |
| D-25 | Low | Netlify's security-header file still allows inline styles and the old font hosts (left unchanged to protect your Render address) |
| D-26 | Low | Brand report links never expire |
| D-27 | Info | Multiplayer negotiation and AI negotiation are not built. Single-player, rule-based only |
| D-28 | Info | The seller's "minimum price" is the item's cost with a loss-confirmation step; there is no separate user-set floor |
| D-29 | Info | The landing text "realistic market scenarios" is your wording, kept as written. Consider whether "realistic" is accurate for a simulation |
