# Launch gates: do not open to the public until every box is ticked
Each line is something that can hurt real people or your reputation if skipped.

**Code and tests**
- [ ] All checks green on the pull request (`CI_GUIDE.md`), including "Full tests (real Postgres)".
- [ ] `npm audit` check green.
- [ ] You tested on staging with real phones: sign up, receive code (Gmail and one other provider), verify, ranked run, forgot password, sign out and in on a second device, delete my data.

**Operations**
- [ ] Paid always-on server and database with backups (`PRODUCTION_SETUP.md`).
- [ ] One restore drill completed from a real backup.
- [ ] Uptime monitor and error alert tested (you received a test message on your phone).
- [ ] You know the rollback steps (`ROLLBACK.md`) and a second person has them.

**Security**
- [ ] Owner sign-in with authenticator code works; two-factor on GitHub, Render, Netlify, database host, registrar, email.
- [ ] `DB_SSL_STRICT=1` tested.
- [ ] Independent security review booked, and at least the high-severity findings fixed before wide launch (`REVIEW_BRIEF.md`).

**Legal and trust**
- [ ] Privacy page and terms finished and reviewed by a lawyer, covering accounts, email, the email provider as a service that handles data, and where data is stored.
- [ ] A working contact address for deletion and abuse requests, answered by a person.
- [ ] Age rule (13+) matches the sign-up text.

**Rollout**
- [ ] Soft launch first: invite 20 to 50 people for a week. Watch errors, email delivery, sign-ups, and support messages.
- [ ] Then widen in steps (for example 10x each week) while watching the owner ops view and your bill.
- [ ] Decide in advance what number of errors or complaints makes you pause sign-ups.

Until the unticked boxes are done, calling it "live with real users" carries real risk: lost data, locked-out players, a leaked password hash or a legal complaint.
