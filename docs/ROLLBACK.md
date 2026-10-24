# Rollback

Order matters: the server and the page must go back together.

1. **Netlify** (the page): **Deploys**, pick the last good deploy, **Publish deploy**.
2. **Render** (the server): **haggle-game-api**, **Deploys**, pick the last good deploy, **Rollback**.
3. **Database fix (required if the new server ran at all):** the new version added a rule that display names are unique. The old server inserts the name "Trader" for every new visitor, which would then fail. In Neon open the **SQL editor** and run:
   `drop index if exists players_name_uniq;`
   (The other database changes only add columns and are safe to leave.)
4. **GitHub:** your `baseline-v1.2` release holds the old code. To go back, use **Releases**, download it, and upload it over `main`, or revert the pull request.
5. Games started on the new version cannot be continued on the old one. Players simply start a new game.
5b. v2.1 only adds tables (`accounts`, `sessions`, `rate_hits`, `admin_sessions`, `admin_totp_used`, `admin_audit`); they are safe to leave. After rolling back, the old server knows nothing about accounts, so a device that has an account is protected only by its device ID again, and the old server accepts the owner key alone. Rotate `ADMIN_KEY` if you stay on the old version.
6. After rolling back, run the three-address check in `docs/TROUBLESHOOTING.md`.
