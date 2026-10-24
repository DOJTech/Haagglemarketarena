# Backups and uptime monitoring
Status today: **nothing here is automatic until you switch it on.** The scripts were syntax-checked but never run (no database where they were written).

## 1. Backups
Pick one, then do the restore drill. A backup you have never restored is a hope, not a backup.

**A. Managed backups (simplest).** Use a paid database plan that includes backups (Render paid Postgres, or Neon with history retention; your docs name both, so use whichever actually holds your database). Check the plan's current retention period on the provider's site and write it in your privacy page. Turn on two-factor sign-in for that account.

**B. Your own copy (recommended in addition).** `scripts/backup.sh` makes a compressed dump and prunes old ones (needs `pg_dump`):
`DATABASE_URL=... BACKUP_DIR=./backups bash scripts/backup.sh`
Schedule it daily (a Render cron job, GitHub Actions, or a computer that is on). Then copy the file **off** that machine to storage with its own login. Backups hold player data: keep them private and delete old ones.

**Restore drill (monthly, 10 minutes).** Make an empty scratch database, then:
`RESTORE_URL=postgres://...scratch... bash scripts/restore-check.sh backups/haggle-XXXX.sql.gz`
It checks the file, restores it, and prints row counts. Compare them with production. It refuses to run against `DATABASE_URL`.

## 2. Uptime monitoring
Use any free monitor (UptimeRobot, Better Stack, etc.).
1. Monitor `https://YOUR-SITE/api/stats` every 5 minutes, alert if it is not HTTP 200 or lacks the word `playingNow`. This goes through Netlify, Render and the database, so it tests the whole chain. (It also keeps a free Render server awake.)
2. Monitor `https://YOUR-SITE/` for the page itself.
3. Send alerts to something you read (phone push or SMS, not only email), and to a second person if you have one.
4. `/healthz` on the Render address is limited to 60 requests a minute per address; do not poll it faster than once a minute.

## 3. When an alert fires
1. Open `docs/TROUBLESHOOTING.md` and run the three-address check. 2. Check the Render and database dashboards. 3. If a new deploy caused it, follow `docs/ROLLBACK.md`. 4. Note what happened and how long it lasted.
Also look at Render's logs weekly for repeated `429`, sign-in failures or `database pool` errors.
