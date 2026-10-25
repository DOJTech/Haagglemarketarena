// Email helpers with no third-party dependencies.
const crypto = require('crypto');
// Starter list only. Disposable-address services appear faster than any list can track.
const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com', 'throwawaymail.com', 'maildrop.cc', 'fakeinbox.com', 'mintemail.com', 'mailnesia.com', 'moakt.com']);
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
function emailProblem(e) {
  if (typeof e !== 'string') return 'email_invalid';
  const s = e.trim();
  if (s.length < 6 || s.length > 254 || /[\r\n\s<>,;"]/.test(s) || !EMAIL_RE.test(s)) return 'email_invalid';
  const [local, domain] = [s.slice(0, s.lastIndexOf('@')), s.slice(s.lastIndexOf('@') + 1).toLowerCase()];
  if (local.length > 64 || !/[a-z]{2,}$/.test(domain)) return 'email_invalid';
  if (DISPOSABLE.has(domain)) return 'email_disposable';
  return null;
}
// One person, one address: lowercase, drop "+tag", and drop dots for Gmail. Used only to stop duplicate accounts.
function normEmail(e) {
  let [l, d] = String(e).trim().toLowerCase().split('@');
  l = l.split('+')[0];
  if (d === 'googlemail.com') d = 'gmail.com';
  if (d === 'gmail.com') l = l.replace(/\./g, '');
  return l + '@' + d;
}
const maskEmail = e => { const [l, d] = String(e).split('@'); return (l.slice(0, 1) + '***') + '@' + d; };
const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
// Codes are stored only as a keyed hash tied to the account and purpose.
const codeHash = (secret, account, purpose, code) => crypto.createHmac('sha256', secret).update('email-code|' + account + '|' + purpose + '|' + code).digest('hex');
module.exports = { emailProblem, normEmail, maskEmail, newCode, codeHash };
