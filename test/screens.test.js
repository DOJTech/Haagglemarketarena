// Renders every game screen from REAL engine data inside a fake page, so a typo or an undefined variable shows up as a failed test
// instead of a blank game. It does not check how things look, only that every screen builds and shows the right facts.
// Run: node test/screens.test.js   (no browser, no server, no database)
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const { createEngine, P } = require('../engine');
const E = createEngine('screens-test-secret-0123456789');
let ok = 0, bad = 0; const t = (n, c, extra) => { c ? ok++ : (bad++, console.log('FAIL', n, extra || '')); };
const store = {}, els = {};
const el = id => els[id] || (els[id] = { id, innerHTML: '', textContent: '', value: '', hidden: false, className: '', dataset: {}, style: {}, classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, appendChild() {}, focus() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], onclick: null });
const doc = { querySelector: s => el(s), querySelectorAll: () => [], getElementById: id => el('#' + id), createElement: () => el('x'), addEventListener() {}, hidden: false, head: el('head'), body: el('body'), activeElement: null, readyState: 'complete' };
const ctx = { document: doc, window: { crypto: crypto.webcrypto, addEventListener() {}, dispatchEvent() {}, matchMedia: () => ({ matches: false }) }, crypto: crypto.webcrypto, console, Math, JSON, Date, Object, Array, String, Number, Promise, Set, Map, URL, Intl,
  localStorage: { getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; } },
  navigator: {}, location: { hash: '', reload() {} }, fetch: () => Promise.reject(new Error('no network in this test')), setInterval() { return 0; }, setTimeout() { return 0; }, clearInterval() {}, confirm: () => true, alert() {},
  CustomEvent: function (n, o) { this.detail = o && o.detail; }, requestAnimationFrame() {}, Event: function () {} };
vm.createContext(ctx);
const run = c => vm.runInContext(c, ctx);
try { run(fs.readFileSync(path.join(__dirname, '..', 'public', 'common.js'), 'utf8')); run(fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8')); t('common.js and app.js load without errors', true); }
catch (e) { t('common.js and app.js load without errors', false, e.stack.split('\n').slice(0, 3).join(' | ')); process.exit(1); }
const RUN = { id: 'a'.repeat(32), ranked: false };
const show = (s, label) => { // give the browser code the state the server would send
  ctx.__v = JSON.parse(JSON.stringify(E.view(s, RUN))); run('S=__v');
  try { const h = run('stage()'); t(label + ' builds', typeof h === 'string' && h.length > 100); return h; } catch (e) { t(label + ' builds', false, e.message); return ''; }
};
const s = E.fresh(true, '2026-11-02', 'screen1'); s.cash = 1e6;
// stock screen
let h = show(s, 'stock screen');
t('stock screen shows the forecast and selling time', /Weather forecast/.test(h) && /selling time units/.test(h));
t('stock screen lists all 12 goods with usual shopper prices', P.every(p => h.includes(run('P').find(x => x.id === p.id).n)) && (h.match(/Shoppers usually pay about/g) || []).length === 12);
t('stock screen warns which goods spoil', (h.match(/spoils overnight/g) || []).length === 2);
t('stock screen has no leftover "undefined" or "NaN"', !/undefined|NaN/.test(h));
for (const p of P) E.apply(s, { type: 'buy', pid: p.id, dir: 1, qty: 3 });
E.apply(s, { type: 'open' });
// no-stock or haggle
let guard = 0; while (s.phase !== 'haggle' && guard++ < 12) { show(s, 'no-stock screen'); E.apply(s, { type: 'next' }); }
h = show(s, 'haggle screen');
t('haggle screen shows weather, time left, hint and patience', /Selling time left today/.test(h) && /class="tell"/.test(h) && /Patience: \d of \d left/.test(h));
t('haggle screen never shows the hidden limit or personality', !h.includes(String(s.cur.max)) || String(s.cur.offer).includes(String(s.cur.max)), 'max ' + s.cur.max);
t('haggle screen never names a personality', !/Bargain hunter|Market expert|Big spender|Regular customer|Shopper in a hurry/.test(h));
t('haggle screen shows the usual price range', /shoppers usually pay about/i.test(h));
if (s.cur.qty > 1) t('multi-unit shopper is announced', /Wants 2 units/.test(h));
// a counter that is refused, then a sale
s.cur.type = 'sharp'; s.cur.pat = 3; E.apply(s, { type: 'counter', price: Math.round(s.cur.max * 1.2) }); h = show(s, 'haggle screen after a refusal');
t('their reply is shown', /My best is/.test(h));
E.apply(s, { type: 'counter', price: Math.max(1, s.cur.offer) }); h = show(s, 'result screen (sale)');
t('result screen reveals the personality', /This shopper was a/.test(h) && /Compare it with the hint/.test(h));
// walk-out result
E.apply(s, { type: 'next' }); if (s.phase === 'haggle') { s.cur.type = 'proud'; E.apply(s, { type: 'counter', price: Math.ceil(s.cur.max * 1.5) }); h = show(s, 'result screen (insulted)'); t('insulted walk-out explained', /felt insulted/.test(h)); }
// play to the end of day 1 and show day-end and final
let g = 0; while (s.phase !== 'dayend' && s.phase !== 'final' && g++ < 80) { if (s.phase === 'haggle') E.apply(s, { type: 'accept' }); else E.apply(s, { type: 'next' }); }
h = show(s, 'day-end screen'); t('day-end shows weather versus forecast', /Weather today/.test(h) && /forecast was/.test(h));
t('day-end has no undefined or NaN', !/undefined|NaN/.test(h));
// full week, check final and dashboard
let w = 0; while (s.phase !== 'final' && w++ < 400) { if (s.phase === 'stock') { for (const p of P) E.apply(s, { type: 'buy', pid: p.id, dir: 1, qty: 1 }); E.apply(s, { type: 'open' }); } else if (s.phase === 'haggle') E.apply(s, { type: 'accept' }); else if (s.phase === 'dayend') E.apply(s, { type: 'nextday' }); else E.apply(s, { type: 'next' }); }
h = show(s, 'final screen'); t('final screen shows a score', s.phase === 'final' && /1000/.test(h));
try { run('renderDash()'); t('business dashboard builds', !/undefined|NaN/.test(els['#dash'].innerHTML)); } catch (e) { t('business dashboard builds', false, e.message); }
// the weather reaches the page background
try { ctx.__v = JSON.parse(JSON.stringify(E.view(E.fresh(true, '2026-11-02', 'bg'), RUN))); run('S=__v'); run('render()'); t('the page background follows the forecast in the morning', els['body'].dataset.wx === ctx.__v.fc && !!ctx.__v.fc); } catch (e) { t('render() runs', false, e.message); }
run('S=null'); try { run('render()'); t('the weather background clears on the title screen', els['body'].dataset.wx === ''); } catch (e) { t('render() runs on the title screen', false, e.message); }
// setup, landing, account, how-it-works
run('S=null'); for (const [fn, label] of [['setupHtml()', 'setup screen'], ['landing()', 'landing screen'], ['acctHtml()', 'account box']]) { try { const x = run(fn); t(label + ' builds', typeof x === 'string' && x.length > 50); if (fn === 'setupHtml()') t('setup screen has the currency picker', /id="cu"/.test(x) && /US dollar/.test(x)); } catch (e) { t(label + ' builds', false, e.message); } }
try { run('renderHow()'); const hw = els['#how'].innerHTML; t('how-it-works builds and mentions the weather and 7 to 10 shoppers', /7 to 10 shoppers/.test(hw) && !/undefined|NaN/.test(hw)); } catch (e) { t('how-it-works builds', false, e.message); }
// currency: amounts change, scores do not
run('S=null'); run("setCurrency('USD')"); const usd = run('N(15000)'); run("setCurrency('NGN')"); t('currency switch changes how money is shown', usd === '$10.00' && run('N(15000)') === '₦15,000', usd);
t('server sentences with naira are converted too', (run("setCurrency('GHS')"), run("cvt('My best is ₦2,800.')")) === 'My best is GH₵20.00.'); run("setCurrency('NGN')");
console.log(ok + ' passed, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
