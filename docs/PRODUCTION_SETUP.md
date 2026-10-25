# Moving to proper hosting (do this before real users)
I cannot create accounts or spend money for you. These are the changes only you can make, in order. Prices and plan names change often: check each provider's pricing page.

1. **Server that never sleeps.** Render > haggle-game-api > Settings > Instance Type: choose a paid always-on type. Free servers sleep when idle, so the first player of the day waits about a minute.
2. **Database with backups.** Use a paid Postgres plan that includes automatic backups (Render paid Postgres, or Neon paid with history). Free databases may be deleted or limited. After switching, run the restore drill in `BACKUPS_AND_MONITORING.md`.
3. **Change the database address safely.** Make the new database, copy data over with `scripts/backup.sh` then `psql`, set the new `DATABASE_URL` on Render, redeploy, check `/api/stats`. Keep the old one for a week.
4. **Turn on strict database TLS:** set `DB_SSL_STRICT=1`, redeploy, check the site still connects. If not, remove it and ask your database host which certificate setting they need.
5. **Your own domain.** Buy a domain, add it in Netlify (Domain management), and add it to `ALLOWED_ORIGINS` (comma separated, https). Netlify makes the HTTPS certificate for you.
6. **Email** (`EMAIL_SETUP.md`), **alerts** (`MONITORING.md`), **uptime monitor** (`BACKUPS_AND_MONITORING.md`).
7. **Staging** (`STAGING.md`).
8. **Real address check** after any change in front of the server (a new domain or a service like Cloudflare): run the "three-address" check in `TROUBLESHOOTING.md`. If the server sees the wrong address for players, every rate limit breaks.
9. **Two-factor sign-in** on every account that can change the site (`REVIEW_BRIEF.md` checklist).

## Don't do yet
- Putting a CDN or firewall (for example Cloudflare) in front of the server: useful later, but it changes how player addresses are seen and needs the hop setting changed and re-tested.
- Running two server copies: the code supports it (limits are in the database) but it has never been tested that way.
