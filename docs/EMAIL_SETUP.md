# Email setup (verification codes and password reset)
Haggle sends plain-text emails through **Resend** (resend.com). Any provider with a similar sign-up works, but only Resend is built in. Prices and free allowances change, so check their pricing page before choosing a plan. This guide needs a **domain name you own** (about the price of a sandwich per year from any registrar).

1. **Own a domain.** Example: `haggle.game`. Buy one at a registrar if you don't have one, and turn on its two-factor sign-in and registrar lock.
2. **Create a Resend account** (two-factor on), then **Domains > Add Domain** and enter your domain (a subdomain like `mail.haggle.game` keeps things tidy).
3. **Add the DNS records** Resend shows you (usually SPF, DKIM and optional DMARC) in your registrar's DNS page. Without them, Gmail and others send your codes to spam or reject them. Click **Verify** in Resend; it can take from minutes to a day.
4. **Create an API key** (Resend > API Keys), "Sending access" only.
5. **On Render > haggle-game-api > Environment, add:**
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM` = `Haggle <no-reply@yourdomain.com>` (must use the verified domain)
6. **Test it** (staging first, see `STAGING.md`): create an account with your own Gmail, and with a second address at a different provider (Outlook or Yahoo). Check the code arrives within a minute, and check the spam folder.
7. **Add a DMARC record** once delivery works (Resend explains how). It protects people from someone faking your address.

## How it works and what it costs you
- A code is six digits, valid 15 minutes, five wrong tries and it dies, one new code per minute per account.
- Caps protect your bill and stop mail-bombing: 5 per account per hour, 15 per network per hour, 200 per hour overall (`MAIL_PER_ACCOUNT_HOUR`, `MAIL_PER_IP_HOUR`, `MAIL_PER_HOUR_ALL`). If real growth hits the overall cap, raise it and watch your provider's usage.
- If the email service is down, sign-up still works; the player is told the email did not go and can retry. Errors are counted toward your alert (`MONITORING.md`).
- **Production will not start without these two settings.**

## Known limits
- Disposable-address blocking uses a short starter list. Determined people will get around it.
- One verified address allows one account (Gmail dots and `+tags` are treated as the same address).
- Someone can request reset emails for another person's address (at most 5 an hour); they cannot use them, but it is a nuisance.
- Email is not proof of a real person. For stronger proof you would add phone verification (a different provider, per-message cost).
