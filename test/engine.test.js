'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createEngine, PRODUCTS, DAYS, START } = require('../lib/engine');
const eng = createEngine('t'.repeat(40));
const roundtrip = (s) => JSON.parse(JSON.stringify(s));   // the database stores state as JSON

test('prototype-style product ids are rejected and cash is untouched', () => {
  const s = eng.fresh(true, '2026-10-23', 'a'.repeat(32));
  for (const pid of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', '', null, 5, {}, ['rice']])
    assert.equal(eng.apply(s, { type: 'buy', pid, dir: 1 }), 'bad');
  assert.equal(s.cash, START);
});
test('same day gives the same ranked week; different runs give different practice weeks', () => {
  assert.deepEqual(eng.build(true, '2026-10-23', 'x').map((d) => d.cost), eng.build(true, '2026-10-23', 'y').map((d) => d.cost));
  assert.notDeepEqual(eng.build(false, '2026-10-23', 'x').map((d) => d.cost), eng.build(false, '2026-10-23', 'y').map((d) => d.cost));
  assert.notDeepEqual(createEngine('a'.repeat(40)).build(true, 'd', 'x'), createEngine('b'.repeat(40)).build(true, 'd', 'x'));
});
test('view never leaks the current customer hidden maximum or the schedule', () => {
  const s = eng.fresh(true, '2026-10-23', 'b'.repeat(32));
  eng.apply(s, { type: 'buy', pid: 'rice', dir: 1 }); eng.apply(s, { type: 'buy', pid: 'tom', dir: 1 }); eng.apply(s, { type: 'buy', pid: 'fab', dir: 1 }); eng.apply(s, { type: 'buy', pid: 'chg', dir: 1 }); eng.apply(s, { type: 'buy', pid: 'noo', dir: 1 });
  eng.apply(s, { type: 'open' });
  const v = eng.view(s, { id: 'r', ranked: true });
  assert.equal(JSON.stringify(v).includes('"max"') && s.phase === 'haggle' && v.cur.max !== undefined, false);
  assert.equal('sched' in v, false);
});
test('invalid actions never change state', () => {
  const s = eng.fresh(true, '2026-10-23', 'c'.repeat(32));
  const before = JSON.stringify(s);
  for (const b of [null, {}, { type: 5 }, { type: 'accept' }, { type: 'counter', price: 100 }, { type: 'next' }, { type: 'nextday' }, { type: 'buy', pid: 'rice', dir: 2 }, { type: 'buy', pid: 'rice', dir: -1 }, { type: 'nope' }])
    assert.notEqual(eng.apply(s, b), null);
  assert.equal(JSON.stringify(s), before);
});
test('cannot overspend and counter prices must be safe integers', () => {
  const s = eng.fresh(true, '2026-10-23', 'd'.repeat(32));
  let bought = 0; while (eng.apply(s, { type: 'buy', pid: 'rice', dir: 1 }) === null) bought++;
  assert.ok(s.cash >= 0 && bought > 0);
  eng.apply(s, { type: 'open' });
  if (s.phase === 'haggle') for (const price of [0, -5, 1.5, '300', NaN, Infinity, 1e7, 2 ** 60]) assert.equal(eng.apply(s, { type: 'counter', price }), 'bad');
});
test('fuzz: 300 random games keep every number finite, stock non-negative, score an integer', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const junk = [undefined, null, NaN, -1, 0, 1, 2, 1e9, '__proto__', 'rice', '', {}, [], true];
  for (let g = 0; g < 300; g++) {
    let s = eng.fresh(g % 2 === 0, '2026-10-23', g.toString(16).padStart(32, '0'));
    for (let i = 0; i < 1500 && s.phase !== 'final'; i++) {
      const types = ['buy', 'buy', 'open', 'accept', 'counter', 'counter', 'leave', 'next', 'nextday', 'x'];
      const b = { type: types[Math.floor(rnd() * types.length)], pid: rnd() < 0.7 ? PRODUCTS[Math.floor(rnd() * PRODUCTS.length)] : junk[Math.floor(rnd() * junk.length)], dir: rnd() < 0.8 ? 1 : junk[Math.floor(rnd() * junk.length)], price: rnd() < 0.7 ? Math.floor(rnd() * 8000) : junk[Math.floor(rnd() * junk.length)] };
      eng.apply(s, b); s = roundtrip(s);
      assert.ok(Number.isFinite(s.cash), 'cash finite');
      for (const p of PRODUCTS) { assert.ok(Number.isInteger(s.stock[p]) && s.stock[p] >= 0, 'stock ' + p); assert.ok(Number.isFinite(s.basis[p])); }
    }
    if (s.phase === 'final') { assert.ok(Number.isInteger(s.score)); assert.ok(s.d === DAYS - 1); }
  }
});
test('compact keeps what view needs and drops the hidden week', () => {
  let s = eng.fresh(true, '2026-10-23', 'e'.repeat(32));
  while (s.phase !== 'final') {
    const e = (b) => { eng.apply(s, b); s = roundtrip(s); };
    if (s.phase === 'stock') e({ type: 'open' }); else if (s.phase === 'haggle') e({ type: 'accept' }); else if (s.phase === 'dayend') e({ type: 'nextday' }); else e({ type: 'next' });
  }
  const before = JSON.stringify(eng.view(s, { id: 'r', ranked: true }));
  eng.compact(s);
  assert.equal(JSON.stringify(eng.view(s, { id: 'r', ranked: true })), before);
  assert.ok(JSON.stringify(s).length < 16000);
});

const { SCORE, rules } = require('../lib/engine');
test('score: doing nothing earns 0, every score is a whole number 0..1000, parts add up', () => {
  let s = eng.fresh(true, '2026-10-23', 'f'.repeat(32));
  while (s.phase !== 'final') { const e = (b) => { eng.apply(s, b); s = roundtrip(s); }; if (s.phase === 'stock') e({ type: 'open' }); else if (s.phase === 'nostock') e({ type: 'next' }); else if (s.phase === 'dayend') e({ type: 'nextday' }); }
  assert.equal(s.score, 0);
  for (let g = 0; g < 40; g++) {
    let t = eng.fresh(g % 2 === 0, '2026-10-23', g.toString(16).padStart(32, '0'));
    while (t.phase !== 'final') {
      const e = (b) => { eng.apply(t, b); t = roundtrip(t); };
      if (t.phase === 'stock') { e({ type: 'buy', pid: PRODUCTS[g % PRODUCTS.length], dir: 1 }); e({ type: 'buy', pid: 'rice', dir: 1 }); e({ type: 'open' }); }
      else if (t.phase === 'haggle') e(g % 3 ? { type: 'accept' } : { type: 'counter', price: Math.round(t.cur.offer * 1.3) });
      else if (t.phase === 'dayend') e({ type: 'nextday' }); else e({ type: 'next' });
    }
    const p = t.breakdown.parts, sum = Object.values(p).reduce((a, b) => a + b, 0);
    assert.equal(t.score, sum); assert.ok(Number.isInteger(t.score) && t.score >= 0 && t.score <= SCORE.TOTAL_MAX);
    assert.ok(p.profit <= SCORE.PROFIT_MAX && p.margin <= SCORE.MARGIN_MAX && p.satisfaction <= SCORE.SAT_MAX && p.inventory <= SCORE.INV_MAX && p.consistency <= SCORE.CONS_MAX);
  }
  assert.equal(SCORE.PROFIT_MAX + SCORE.MARGIN_MAX + SCORE.SAT_MAX + SCORE.INV_MAX + SCORE.CONS_MAX, SCORE.TOTAL_MAX);
});
test('campaign is a fixed seven-day sequence shown by rules()', () => {
  const R = rules(); assert.equal(R.campaign.length, 7); assert.ok(R.campaign.every((c) => c.t && c.d && c.obj));
  const w = eng.build(true, '2026-10-23', 'x', 1); assert.deepEqual(w.map((d) => d.ev.t), R.campaign.map((c) => c.t));
});
test('sponsor price test changes only the sponsored cost, and never in ranked runs', () => {
  const sp = { brand: 'B', product: 'P', tagline: '' };
  const a = eng.fresh(false, 'd', 'a'.repeat(32), { mult: 1 }), b = eng.fresh(false, 'd', 'a'.repeat(32), { mult: 1.1, sponsor: sp, variant: 2, cid: 7 });
  for (let d = 0; d < 7; d++) { for (const p of PRODUCTS) if (p !== 'noo') assert.equal(a.sched[d].cost[p], b.sched[d].cost[p]); assert.ok(b.sched[d].cost.noo > a.sched[d].cost.noo); assert.deepEqual(a.sched[d].cs, b.sched[d].cs); }
  const r1 = eng.fresh(true, 'd', 'a'.repeat(32), { mult: 1.4, sponsor: sp, variant: -1 }), r2 = eng.fresh(true, 'd', 'b'.repeat(32));
  assert.deepEqual(r1.sched.map((x) => x.cost), r2.sched.map((x) => x.cost));
  assert.equal(eng.view(b, { id: 'r' }).sponsor.brand, 'B');
});
test('satisfaction and the dashboard add up', () => {
  let s = eng.fresh(true, '2026-10-23', '9'.repeat(32));
  for (const p of ['rice', 'fab', 'chg']) eng.apply(s, { type: 'buy', pid: p, dir: 1 });
  eng.apply(s, { type: 'open' }); let guard = 0;
  while (s.phase !== 'dayend' && guard++ < 50) { if (s.phase === 'haggle') eng.apply(s, { type: 'accept' }); else eng.apply(s, { type: 'next' }); if (s.res && s.res.ok) assert.ok(s.res.sat >= 50 && s.res.sat <= 100); }
  const v = eng.view(s, { id: 'r' });
  assert.equal(v.fin.rev - v.fin.cogs, v.fin.gross); assert.equal(v.dayLog.length, 1); assert.equal(v.dayLog[0].sold, v.fin.unitsSold);
  assert.equal(v.fin.unitsBought - v.fin.unitsSold - v.spoiled, v.fin.invUnits); assert.ok(v.fin.satisfaction >= 0 && v.fin.satisfaction <= 100);
});

const { WEATHER, PER } = require('../lib/engine');
test('15 goods, 5 kinds of weather, 8 shoppers a day, and a forecast on every day', () => {
  assert.equal(PRODUCTS.length, 15); assert.equal(PER, 8); assert.deepEqual(WEATHER.slice().sort(), ['cloud', 'harm', 'hot', 'rain', 'sun']);
  const w = eng.build(true, '2026-10-23', 'x', 1);
  w.forEach((d) => { assert.ok(WEATHER.includes(d.wx)); assert.equal(d.cs.length, PER); assert.ok(d.fav.every((p) => PRODUCTS.includes(p))); PRODUCTS.forEach((p) => assert.ok(d.cost[p] > 0)); });
  assert.deepEqual(rules().campaign.map((c) => c.wx), w.map((d) => d.wx));
  const v = eng.view(eng.fresh(true, '2026-10-23', 'y'.repeat(32)), { id: 'r' }); assert.ok(WEATHER.includes(v.wx.k)); assert.ok(Array.isArray(v.wx.fav));
});
test('the weather really moves demand: umbrellas on the rain day, shea butter in harmattan, fans in the heat', () => {
  const count = (day, pid) => { let n = 0; for (let g = 0; g < 300; g++) n += eng.build(false, 'd', g.toString(16).padStart(32, '0'), 1)[day].cs.filter((c) => c.p === pid).length; return n / 300; };
  const rain = rules().campaign.findIndex((c) => c.wx === 'rain'), sunny = rules().campaign.findIndex((c) => c.wx === 'sun'), harm = rules().campaign.findIndex((c) => c.wx === 'harm'), hot = rules().campaign.findIndex((c) => c.wx === 'hot');
  assert.ok(count(rain, 'umb') > 3 * count(sunny, 'umb'), 'umbrellas');
  assert.ok(count(harm, 'shea') > 3 * count(sunny, 'shea'), 'shea');
  assert.ok(count(hot, 'fan') > 3 * count(rain, 'fan'), 'fans');
  const f = eng.build(true, 'd', 'x', 1); assert.ok(f[rain].fav.includes('umb')); assert.ok(f[harm].fav.includes('shea')); assert.ok(f[hot].fav.includes('fan'));
});
test('fresh goods spoil overnight and everything else carries over', () => {
  let s = eng.fresh(true, '2026-10-23', '7'.repeat(32));
  for (const p of ['tom', 'pla', 'pep', 'zob', 'rice', 'yam', 'fab', 'umb']) assert.equal(eng.apply(s, { type: 'buy', pid: p, dir: 1 }), null);
  eng.apply(s, { type: 'open' }); let guard = 0;
  while (s.phase !== 'dayend' && guard++ < 60) { if (s.phase === 'haggle') eng.apply(s, { type: 'leave' }); else eng.apply(s, { type: 'next' }); }
  for (const p of ['tom', 'pla', 'pep', 'zob']) assert.equal(s.stock[p], 0, p + ' spoils');
  for (const p of ['rice', 'yam', 'fab', 'umb']) assert.equal(s.stock[p], 1, p + ' carries over');
  assert.equal(s.spoiled, 4); assert.ok(s.tot.writeOff > 0);
});
