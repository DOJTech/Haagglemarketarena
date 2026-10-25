# What to change in your privacy page (I did not touch your edited file)
Have your lawyer review these. They describe what the code actually does.
- **Collected:** random device ID; display name; country (optional, self-declared); game decisions and scores; a short "playing now" signal; a scrambled (hashed) network address used to limit repeat ranked runs.
- **Public:** display name, country code and score appear on the leaderboard.
- **Third parties:** the pages no longer call any third-party font or analytics service. Hosting providers (Netlify, Render, and your database provider) process the data.
- **Combined statistics:** the Market insights page shows only combined results, and a product appears only after at least 30 shoppers and at least 10 finished games. Do not say "anonymised" beyond this: the data is combined, not guaranteed anonymous.
- **Deletion:** "Delete my data" removes your records from our server (games, scores, device record). Backups held by our hosting providers may take longer to disappear. Fill in the real backup period.
- **Retention:** nothing is deleted automatically, except unfinished games (after 2 days) and the "playing now" signal (after 1 day). If you want a fixed period, ask for automatic deletion to be built first.
- **New in v2.1, accounts (only if the player creates one):** a private username, a salted scrypt hash of the password (never the password), and sign-in sessions (stored only as hashes, expire after 14 days, deleted automatically once expired). No email or phone is collected, so passwords cannot be reset.
- **New in v2.1, owner audit log:** each owner sign-in, failed sign-in and moderation or campaign action is recorded with a scrambled network address and the time. Kept 365 days, then deleted automatically. It holds no keys or codes.
- **New in v2.1, rate-limit counters:** short-lived counters keyed by a scrambled network address, username hash or device ID. They are deleted automatically about an hour after their window ends.
- **New in v2.2, email:** the address you give at sign-up (shown back to you only in masked form), whether it is verified, and short-lived hashed verification or reset codes (deleted when used or expired). Your email is sent to the email provider (Resend) only to deliver the codes. It is never shown to other players or used for marketing. **Your privacy page must name the provider and say where it processes data.**
- **New in v2.2, server logs:** errors and slow requests are logged with the route name and time only. No passwords, codes, request bodies or raw network addresses.
- **New in v2.3, music and currency:** your music source, volume and currency choice are saved only in your browser. Songs you pick from your phone are played on the phone and never uploaded. If you choose a Spotify or YouTube link, that company's own player loads in the page and can use its own cookies; the game warns you first. We never receive what you listen to.
- **Deletion:** "Delete my data" now also removes the account, its email address, codes and sessions. A player with an account must be signed in to use it.
- **Age:** 13 and over; under 18 should ask a parent or guardian (as you chose).

**Not done by me:** `public/privacy.html` and `public/terms.html` are not in this zip, so I could not edit them. They remain drafts until you fill the [brackets] and a lawyer reviews them. Nothing in this file is legal advice.
