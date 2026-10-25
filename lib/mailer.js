// Sends plain-text email. Modes: "resend" (real, needs RESEND_API_KEY and EMAIL_FROM), "file" (local tests only: appends to MAIL_OUTBOX), "off".
const fs = require('fs');
function createMailer(env = process.env, fetchFn = globalThis.fetch) {
  const prod = env.NODE_ENV === 'production';
  const mode = env.MAIL_MODE === 'file' && !prod ? 'file' : (env.RESEND_API_KEY ? 'resend' : 'off');
  const from = (env.EMAIL_FROM || '').trim();
  return {
    mode, from,
    configured: mode === 'resend' && /@/.test(from),
    async send({ to, subject, text }) {
      if (mode === 'file') { fs.appendFileSync(env.MAIL_OUTBOX || 'mail-outbox.jsonl', JSON.stringify({ to, subject, text }) + '\n'); return; }
      if (mode !== 'resend' || !/@/.test(from)) throw new Error('mail not configured');
      const r = await fetchFn('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text }), signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error('mail provider answered ' + r.status); // status only: never log the response body
    },
  };
}
module.exports = { createMailer };
