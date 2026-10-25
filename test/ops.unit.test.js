// Run: node --test test/ops.unit.test.js (no database, no network)
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path');
const E = require('../lib/emailutil'), { createMailer } = require('../lib/mailer'), { createOps } = require('../lib/ops');
test('email validation', () => {
  for (const ok of ['a.b@example.com', 'x+tag@mail.example.co.uk', 'user_1@gmail.com']) assert.equal(E.emailProblem(ok), null, ok);
  for (const bad of ['', 'plain', 'a@b', 'a@@b.com', 'a b@c.com', 'a@b..com', '<x>@c.com', 'a@b.c', null, 5, 'a@' + 'x'.repeat(70) + '.com', 'a'.repeat(70) + '@x.com', 'a@b.com\nBcc: x@y.com'])
    assert.equal(E.emailProblem(bad), 'email_invalid', String(bad));
  assert.equal(E.emailProblem('x@mailinator.com'), 'email_disposable');
});
test('one person, one address', () => {
  assert.equal(E.normEmail('John.Doe+spam@Gmail.com'), 'johndoe@gmail.com');
  assert.equal(E.normEmail('j.o.h.n@googlemail.com'), 'john@gmail.com');
  assert.equal(E.normEmail('a.b+c@example.com'), 'a.b@example.com', 'dots kept for other providers');
  assert.equal(E.maskEmail('johndoe@gmail.com'), 'j***@gmail.com');
});
test('codes: six digits, uniform format, keyed hash bound to account and purpose', () => {
  for (let i = 0; i < 300; i++) assert.match(E.newCode(), /^\d{6}$/);
  const h = E.codeHash('secret-secret-secret', 'acct1', 'verify', '123456');
  assert.equal(h.length, 64);
  assert.notEqual(h, E.codeHash('secret-secret-secret', 'acct2', 'verify', '123456'));
  assert.notEqual(h, E.codeHash('secret-secret-secret', 'acct1', 'reset', '123456'));
  assert.notEqual(h, E.codeHash('other-secret-secret', 'acct1', 'verify', '123456'));
  assert.notEqual(h, E.codeHash('secret-secret-secret', 'acct1', 'verify', '123457'));
});
test('mailer: file mode works outside production only; real mode needs key and sender; provider errors expose status only', async () => {
  const f = path.join(os.tmpdir(), 'haggle-outbox-' + Date.now() + '.jsonl');
  const m = createMailer({ MAIL_MODE: 'file', MAIL_OUTBOX: f });
  await m.send({ to: 'a@b.com', subject: 's', text: 't' });
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8').trim()).to, 'a@b.com'); fs.unlinkSync(f);
  assert.equal(createMailer({ MAIL_MODE: 'file', NODE_ENV: 'production' }).mode, 'off', 'file mode refused in production');
  assert.equal(createMailer({}).configured, false);
  await assert.rejects(createMailer({}).send({ to: 'a@b.com', subject: 's', text: 't' }), /not configured/);
  let seen; const ok = createMailer({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'Haggle <no-reply@example.com>' }, async (u, o) => { seen = { u, o }; return { ok: true }; });
  assert.ok(ok.configured); await ok.send({ to: 'a@b.com', subject: 'Hi', text: 'Body' });
  assert.equal(seen.u, 'https://api.resend.com/emails'); assert.equal(seen.o.headers.Authorization, 'Bearer re_x'); assert.deepEqual(JSON.parse(seen.o.body).to, ['a@b.com']);
  const bad = createMailer({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'x@example.com' }, async () => ({ ok: false, status: 403, text: async () => 'secret detail' }));
  await assert.rejects(bad.send({ to: 'a@b.com', subject: 's', text: 't' }), e => /403/.test(e.message) && !/secret detail/.test(e.message));
});
test('ops: one alert when errors pile up, then quiet during the cool-down; stale errors expire; non-https hooks are ignored', async () => {
  let t = 1e12, sent = []; const f = async (u, o) => { sent.push({ u, body: JSON.parse(o.body) }); return { ok: true }; };
  const o = createOps({ webhook: 'https://hooks.example.com/x', threshold: 3, fetchFn: f, now: () => t });
  await o.record('5xx'); await o.record('5xx'); assert.equal(sent.length, 0);
  await o.record('5xx'); assert.equal(sent.length, 1); assert.match(sent[0].body.text, /3 server problems/); assert.equal(sent[0].body.text, sent[0].body.content);
  for (let i = 0; i < 5; i++) await o.record('5xx'); assert.equal(sent.length, 1, 'no alert storm');
  t += 20 * 60000; await o.record('5xx'); assert.equal(sent.length, 1, 'old errors expired so below threshold');
  await o.record('5xx'); await o.record('5xx'); assert.equal(sent.length, 2, 'new burst after cool-down alerts again');
  const off = createOps({ webhook: 'http://insecure.example.com', fetchFn: f }); assert.equal(off.enabled, false); assert.equal(await off.alert('x'), false);
  const fail = createOps({ webhook: 'https://hooks.example.com/x', fetchFn: async () => { throw new Error('down'); }, log: () => {} }); assert.equal(await fail.alert('x'), false);
});
