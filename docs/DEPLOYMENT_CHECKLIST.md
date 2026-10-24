# Deployment checklist (nothing has been deployed by me)

## Before you upload: two settings are now REQUIRED (v2.1)
0. On Render, **before** deploying this version, add `ADMIN_TOTP_SECRET` (make it with `npm run make-owner-secret`, see `DEPLOY.md` step 2.5) and confirm `ALLOWED_ORIGINS` is set to your site address in `https://...` form. Also confirm `ADMIN_KEY` is at least 20 characters. If any is missing, the new server refuses to start and the site will show "cannot reach the game server" until you add it.
0b. Run `test/accounts.test.js` and the other suites on a scratch Postgres first (`DEPLOY.md`, "Run the tests locally"). The new account and owner-login SQL has only been run against a fake database.
0c. The page and the server must go live together. An old page against the new server can still practise, but ranked play falls back to practice (no account box) and the old owner screen cannot sign in.

## Before you upload (protect the working version)
1. GitHub: open the repo, click **Releases**, then **Create a new release**. Tag `baseline-v1.2`, title "Working version before Arena", publish. This keeps the last working code.
2. Netlify: **Deploys**, find the current live deploy. Note it. You can re-publish it later.
3. Render: **haggle-game-api** then **Deploys**. Note the latest deploy.
4. Use a quiet time. The page and the server change together: the new page needs the new server, and the old page will not work with it. Right now you have almost no players, so a short gap is fine.

## Upload
5. Unzip `haggle-arena-update-v2.0.zip`. It leaves out your privacy page, terms page, `netlify.toml` and `render.yaml` on purpose, so your edits and addresses stay.
6. Safer option: in GitHub create a branch called `arena` (the branch button, then type a name), upload the files there, and open a pull request. Netlify can make a preview address for the branch. **The preview talks to your live server and database**, so add the preview address to `ALLOWED_ORIGINS` (comma separated) first, and remove it afterwards.
7. Merge to `main`. Render and Netlify redeploy by themselves. If Render does not, use **Manual Deploy**, then **Deploy latest commit**.

## Check (10 minutes)
8. Run the checks in `docs/TROUBLESHOOTING.md` (the three addresses).
9. On a phone: open the site, choose **Enter the Arena**, set a name, play one full day, open every tab. Then try a laptop and a tablet.
10. Open your site with `/#owner`, tap Metrics, check your numbers appear.
11. Optional clean-up: old test scores use the old scoring (naira profit) and sit beside the new points. In Neon, open the SQL editor and run `delete from scores;` only if all current scores are your own tests.
12. Do not call this production-ready until steps 8 to 10 pass on real devices.

## If a critical check fails
Do not leave it live. Follow `docs/ROLLBACK.md`.
