'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('vm'), fs = require('fs'), path = require('path');
const keys = require('./_keys');
const src = fs.readFileSync(path.join(__dirname, '../public/i18n.js'), 'utf8');
const ctx = vm.createContext({ document: { documentElement: {}, querySelectorAll: () => [], getElementById: () => null }, navigator: { language: 'en' }, localStorage: { getItem: () => null, setItem() {} }, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), NF: null });
vm.runInContext(src + ';this.__x={DICT,T,TH,setLang,LANGS}', ctx);
const { DICT, T, TH, setLang } = ctx.__x;
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(), tags = (s) => (s.match(/<\/?b>/g) || []).join();
// Strings that are genuinely identical in French.
const SAME_IN_FR = new Set(['Points', 'Transactions', 'Situation', 'Sections', 'Ghana', 'Kenya', 'Rwanda', 'Canada', 'France', 'Station', 'Volume', 'Pause', 'Plantain']);

test('every string the pages show is translated into French', () => {
  const missing = keys.filter((k) => !DICT.fr[k] && !SAME_IN_FR.has(k));
  assert.deepEqual(missing, []);
});
test('no stale translations, and placeholders and bold tags always match the English', () => {
  for (const l of ['pcm', 'fr']) for (const [k, v] of Object.entries(DICT[l])) {
    assert.ok(keys.includes(k), l + ': stale key ' + k.slice(0, 40));
    assert.equal(ph(v), ph(k), l + ': placeholders ' + k.slice(0, 40)); assert.equal(tags(v), tags(k), l + ': tags ' + k.slice(0, 40));
  }
});
test('T falls back to English, fills values, and TH escapes values', () => {
  setLang('en'); assert.equal(T('Not a known string {x}', { x: 1 }), 'Not a known string 1');
  setLang('fr'); assert.equal(T('Day {d} of {n}', { d: 2, n: 7 }), 'Jour 2 sur 7');
  setLang('pcm'); assert.equal(TH('{name} wants {item}', { name: '<img>', item: 'rice' }), '&lt;img> wan buy rice');
  setLang('en'); assert.equal(TH('{name} wants {item}', { name: '<img>', item: 'x' }), '&lt;img> wants x');
});
