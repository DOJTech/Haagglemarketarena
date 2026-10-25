# Automatic tests (GitHub Actions): how to read the results
Every time you open or change a pull request, GitHub starts a real Postgres and runs all the tests for you, free for private repos within GitHub's monthly allowance (check the current limit on GitHub's pricing page).

**Where to look:** open your pull request and scroll to the bottom to **Checks**. Click **Details** next to any line.
- **Green tick:** passed.
- **Red cross:** click it, open the red step, and copy the last 20 lines of the log. Send them to me and I will tell you what to fix.
- **Do not merge while "tests / Full tests (real Postgres)" is red.** The earlier security update was only tested against a fake database, so this is the first real check.

**What each part covers**
- *Quick tests:* game engine, security helpers, server wiring (no database).
- *Full tests:* the new account and owner sign-in code on real Postgres, then the older suites (anti-cheat, moderation, features, campaigns, security, a 30-player load test, a simulated browser).
- *Known-vulnerability check:* `npm audit`. If it fails, a library has a published security hole. Dependabot will usually have opened a pull request to fix it.

**Make it a rule (2 minutes):** GitHub repo > Settings > Branches > Add rule for `main` > tick "Require status checks to pass before merging" and select the checks above. Then nobody (including you, by accident) can merge a failing change.

**Limits:** this is a test run on GitHub's machines, not your live site. It does not replace staging, a load test at real scale, or an independent security review.
