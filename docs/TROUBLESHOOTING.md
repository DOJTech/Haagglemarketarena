# Troubleshooting: "Could not start" or no "N playing now" line

Open these three addresses in a browser, in order (use your own names):
1. `https://haggle-game-api.onrender.com/healthz` should show **ok**. If it takes about a minute, the free server was asleep: that is normal, and it will work once awake.
2. `https://haggle-ng.netlify.app/api/stats` should show text like `{"playingNow":0,...}`.
   - A Netlify "Page not found" means the forwarding rule is missing: fix the `to = ...` line in `netlify.toml` on GitHub so it points to your Render address followed by `/api/:splat`, commit, and wait for Netlify to redeploy.
   - A 502 or 504 means the server is asleep or the address in `netlify.toml` is wrong.
3. If step 2 works but Play fails with "not allowed to reach the game server": on Render, set `ALLOWED_ORIGINS` to exactly `https://haggle-ng.netlify.app` (no slash at the end), save, and wait for the restart.

## The server will not start (Render logs show an error and the site cannot connect)
- `ALLOWED_ORIGINS is not set` or `invalid entry`: set it to your site address exactly, like `https://haggle-ng.netlify.app` (https, no path).
- `ADMIN_TOTP_SECRET is required` or `not a valid base32`: make one with `npm run make-owner-secret` and paste it exactly.
- `ADMIN_KEY` error: production needs 20 or more characters.

## Owner sign-in fails
- The code changes every 30 seconds and each code works once. Wait for the next one. Your phone's clock must be on automatic time.
- After 5 wrong tries from your address you are locked out for 15 minutes.
- Lost your phone: make a new secret with `npm run make-owner-secret`, replace `ADMIN_TOTP_SECRET` on Render, and add the new one to your authenticator app.

## A player cannot sign in or lost their password
- There is no email or phone on file, so a forgotten password cannot be reset. The player can keep practising with a new device ID or create a new account. After 10 wrong passwords for one username, that username is locked for 15 minutes.

Keep the free server awake: a free uptime monitor that opens `https://haggle-ng.netlify.app/api/stats` every 5 minutes. For real launch, use a paid Render plan.
