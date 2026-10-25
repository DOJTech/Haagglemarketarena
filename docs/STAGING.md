# Staging: a practice copy of the whole game
Staging is a second, separate copy (own server, own database, own secrets, own web address). Every change goes there first. It must **never** share a database or secrets with production.

## Create it (about 45 minutes, once)
1. **Git branch:** in GitHub create a branch called `staging` from `main`.
2. **Database:** create a second, empty Postgres (Neon free tier is fine for staging). Copy its address.
3. **Render:** New > Web Service > same repo > branch `staging` > name `haggle-game-api-staging`. Same build and start commands as production. Add environment variables:
   | Name | Value |
   |---|---|
   | NODE_ENV | production (so it behaves like the real thing) |
   | DATABASE_URL | the staging database |
   | SEED_SECRET | a NEW random value, not the production one |
   | ADMIN_KEY | a NEW key (`npm run make-owner-secret -- --key`) |
   | ADMIN_TOTP_SECRET | a NEW secret, added to your phone app as "Haggle STAGING" |
   | ALLOWED_ORIGINS | the staging Netlify address |
   | RESEND_API_KEY / EMAIL_FROM | same provider; staging may use a test key |
   | ALERT_WEBHOOK_URL | a different channel, or leave unset |
4. **Netlify:** Site settings > Build & deploy > Branches > turn on **branch deploys** for `staging`. Its address looks like `https://staging--yoursite.netlify.app`. In `netlify.toml` add a context so the staging page talks to the staging server (replace both addresses):
   ```
   [context.staging]
   [[context.staging.redirects]]
     from = "/api/*"
     to = "https://haggle-game-api-staging.onrender.com/api/:splat"
     status = 200
     force = true
   ```
   Keep your existing production redirect as it is.
5. Put the staging Netlify address in staging's `ALLOWED_ORIGINS` (https, no slash or path).

## How to use it
1. Make changes on a branch, open a pull request into `staging`. Wait for the green checks (`CI_GUIDE.md`).
2. Merge. Staging redeploys. Test by hand with real phones: sign up, verify email, play ranked, forgot-password, owner sign-in.
3. When happy, open a pull request from `staging` into `main`. Merge. Production redeploys.
4. Never put real players' data into staging.

## Cost note
A second always-on server and database cost extra. Free tiers sleep and have limits, which is acceptable for staging only.
