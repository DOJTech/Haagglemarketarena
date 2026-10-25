'use strict';
/*
 * Haggle game engine v2. Pure logic: no network, no database.
 * The whole week is generated on the server from a secret-keyed seed, so hidden shopper limits
 * never leave the server, and every player action is validated here.
 */
const crypto = require('crypto');

const ENGINE_V = 3;
const START = 20000, PER = 8, DAYS = 7, PATIENCE = 3, LIQ = 0.7, HIST_MAX = 60;
const SCORE = {
  PROFIT_MAX: 500, MARGIN_MAX: 150, SAT_MAX: 150, INV_MAX: 100, CONS_MAX: 100, TOTAL_MAX: 1000,
  PROFIT_FULL: 30000,           // a result of this many naira earns full profit points
  MARGIN_LOW: 5, MARGIN_FULL: 40, // gross margin % that earns 0 and full points
  INV_LOSS_FULL: 30,            // losses of this % of purchases earn 0 stock points
  INV_MIN_SALES: 24,            // stock points scale up to this many sales (so doing nothing scores nothing)
};
// w = how often shoppers ask for it on an ordinary day. The weather and the day's event then raise or lower it.
const P = [
  { id: 'tom', base: 900, w: 1.5, spoil: 1, cat: 'fresh' },
  { id: 'pla', base: 700, w: 0.9, spoil: 1, cat: 'fresh' },
  { id: 'pep', base: 600, w: 0.8, spoil: 1, cat: 'fresh' },
  { id: 'rice', base: 2400, w: 1.3, cat: 'staple' },
  { id: 'yam', base: 1600, w: 1.0, cat: 'staple' },
  { id: 'noo', base: 600, w: 1.1, cat: 'staple' },   // the sponsored slot
  { id: 'wat', base: 500, w: 0.9, cat: 'drinks' },
  { id: 'zob', base: 800, w: 0.5, spoil: 1, cat: 'drinks' },
  { id: 'fab', base: 1800, w: 0.9, cat: 'style' },
  { id: 'cap', base: 1200, w: 0.25, cat: 'style' },
  { id: 'shea', base: 1400, w: 0.3, cat: 'style' },
  { id: 'chg', base: 700, w: 0.9, cat: 'gear' },
  { id: 'umb', base: 1500, w: 0.35, cat: 'gear' },
  { id: 'fan', base: 5000, w: 0.15, cat: 'gear' },
  { id: 'tor', base: 2200, w: 0.2, cat: 'gear' },
];
// Weather changes what people want and what stock costs. `all` scales how many people come out.
const WX = {
  sun:   { dem: { wat: 1.6, zob: 2.4, cap: 3.5, fan: 1.6 }, cost: {}, all: 1 },
  hot:   { dem: { wat: 2.2, zob: 3.5, cap: 3, fan: 5 }, cost: { wat: 1.1, zob: 1.1 }, all: 0.95 },
  cloud: { dem: { umb: 1.6 }, cost: {}, all: 1 },
  rain:  { dem: { umb: 7, wat: 0.6, zob: 0.4, cap: 0.2, fan: 0.3 }, cost: { tom: 1.2, pep: 1.25, pla: 1.1, umb: 1.15 }, all: 0.85 },
  harm:  { dem: { shea: 6, cap: 0.7, zob: 0.5 }, cost: {}, all: 0.9 },
};
// A Map, not a plain object: a plain object would accept keys such as "__proto__" or "constructor".
const PM = new Map(P.map((p) => [p.id, p]));
const isPid = (x) => typeof x === 'string' && PM.has(x);

// The seven-day campaign. Same order for everyone. `wx` is the day's weather.
const CAMPAIGN = [
  { t: 'Fuel price rises', d: 'Transport costs more. Tomatoes, rice and yam cost more to stock.', obj: 'Keep your margin healthy even though stock costs more.', wx: 'sun', cost: { tom: 1.25, rice: 1.2, yam: 1.15 }, dem: {} },
  { t: 'Owambe wedding season', d: 'Everyone is sewing aso ebi. Fabric buyers will pay more.', obj: 'Stock fabric and sell it close to what buyers will pay.', wx: 'sun', cost: {}, dem: { fab: 1.5 } },
  { t: 'Naira slips', d: 'Imported goods cost more to restock.', obj: 'Do not overbuy imported goods at the new, higher cost.', wx: 'cloud', cost: { chg: 1.3, fab: 1.15, fan: 1.2, umb: 1.15 }, dem: {} },
  { t: 'Heavy rain', d: 'Tomato supply is short. Fewer people are out shopping.', obj: 'Fresh goods spoil overnight, so buy only what you can sell, and think umbrellas.', wx: 'rain', cost: { tom: 1.1 }, dem: {} },
  { t: 'Salary week', d: 'Alert has landed. Buyers pay a little more everywhere.', obj: 'Test higher counter-offers while pockets are full.', wx: 'sun', cost: {}, dem: { all: 1.2 } },
  { t: 'Power outage', d: 'NEPA took light and it is very hot. Chargers, torches and fans are in demand.', obj: 'Stock torches, fans and chargers, and price them well.', wx: 'hot', cost: {}, dem: { chg: 1.6, tor: 4, fan: 2 } },
  { t: 'Quiet Tuesday', d: 'A dusty harmattan day. Buyers are stingy.', obj: 'Finish strong: sell stock without selling below cost.', wx: 'harm', cost: {}, dem: { all: 0.85 } },
];
const NAMES = ['Aunty Ngozi', 'Mr Tunde', 'Madam Zainab', 'Chidi', 'Bisi', 'Oga Musa', 'Amaka', 'Kofi', 'Fatima', 'Mama Eniola', 'Segun', 'Wanjiru',
  'Alhaji Bello', 'Mama Put', 'Emeka', 'Hauwa', 'Ifeoma', 'Mallam Sani', 'Folake', 'Chinedu', 'Ebere', 'Tari', 'Efe', 'Nkechi'];
const FACES = ['👩🏾', '👨🏿', '🧕🏽', '👨🏾', '👩🏿', '👴🏾', '👩🏽', '👨🏽'];

const mul = (a) => () => {   // mulberry32
  a = (a + 0x6D2B79F5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const zero = () => Object.fromEntries(P.map((p) => [p.id, 0]));
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const money = (n) => '₦' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function rules() {
  return { start: START, liqPct: Math.round(LIQ * 100), days: DAYS, perDay: PER, score: SCORE, campaign: CAMPAIGN.map((c) => ({ t: c.t, d: c.d, obj: c.obj, wx: c.wx })) };
}

function createEngine(secret) {
  const seedOf = (s) => parseInt(crypto.createHmac('sha256', secret).update(s).digest('hex').slice(0, 8), 16);

  function build(daily, day, runId, mult) {
    const R = mul(daily ? seedOf('haggle' + day) : seedOf('p' + runId));
    const J = mul(seedOf('j' + runId));
    const rnd = (a, b) => a + R() * (b - a);
    const pick = (a) => a[Math.floor(R() * a.length)];
    const out = [];
    for (let d = 0; d < DAYS; d++) {
      const ev = CAMPAIGN[d], wx = WX[ev.wx], cost = {}, dm = {};
      P.forEach((p) => {
        // R() is always drawn so a sponsor price test never changes anything else in the week.
        let c = Math.round(p.base * rnd(0.92, 1.08) * (ev.cost[p.id] || 1) * (wx.cost[p.id] || 1));
        if (p.id === 'noo' && mult && mult !== 1) c = Math.round(c * mult);
        cost[p.id] = c;
        dm[p.id] = (ev.dem[p.id] || 1) * (ev.dem.all || 1) * (wx.dem[p.id] || 1) * wx.all;
      });
      const wt = P.map((p) => p.w * dm[p.id]), cs = [];
      for (let i = 0; i < PER; i++) {
        let r = R() * wt.reduce((a, b) => a + b, 0), k = 0;
        while (k < wt.length - 1 && r > wt[k]) { r -= wt[k]; k++; }
        const p = P[k], base = Math.round(p.base * 1.6 * rnd(0.75, 1.45) * clamp(dm[p.id], 0.75, 1.6));
        const max = Math.round(base * (0.94 + J() * 0.12)), offer = Math.round(max * rnd(0.55, 0.7));
        cs.push({ name: pick(NAMES), face: pick(FACES), p: p.id, max, offer, first: offer });
      }
      // The forecast: goods that today's weather and news make clearly more popular.
      const fav = P.filter((p) => dm[p.id] >= 1.3).sort((x, y) => y.w * dm[y.id] - x.w * dm[x.id]).slice(0, 4).map((p) => p.id);
      out.push({ ev: { t: ev.t, d: ev.d, obj: ev.obj }, wx: ev.wx, fav, cost, cs });
    }
    return out;
  }

  // opts: { mult, sponsor:{brand,product,tagline}, variant, cid }. Ranked runs never get a price change.
  function fresh(daily, day, id, opts) {
    const o = opts || {}, mult = daily ? 1 : (o.mult || 1);
    return {
      v: ENGINE_V, sched: build(daily, day, id, mult), d: 0, phase: 'stock', cash: START,
      stock: zero(), spent: zero(), basis: zero(), bought: zero(),
      ci: 0, cur: null, res: null, log: [], hist: [], days: [], dayCur: { rev: 0, cogs: 0, sold: 0, walked: 0, miss: 0 },
      tot: { rev: 0, cogs: 0, boughtUnits: 0, boughtAmt: 0, soldUnits: 0, writeOff: 0, tx: 0, satSum: 0, satN: 0, bought: zero() },
      spoiled: 0, score: 0, liq: 0, result: 0, breakdown: null,
      sponsor: o.sponsor ? { brand: o.sponsor.brand, product: o.sponsor.product, tagline: o.sponsor.tagline || '' } : null,
      variant: o.variant == null ? null : o.variant, cid: o.cid == null ? null : o.cid,
      note: '', t0: Date.now(), last: 0,
    };
  }

  const hist = (s, e) => {
    const h = s.hist, l = h[h.length - 1];
    if (l && (e.k === 'buy' || e.k === 'return') && l.k === e.k && l.p === e.p && l.d === e.d) { l.q += e.q; l.amt += e.amt; }
    else { h.push(e); if (h.length > HIST_MAX) h.shift(); }
  };
  const sat = (s, n) => { s.tot.satSum += n; s.tot.satN++; };

  function nextC(s) {
    if (s.ci >= PER) return endDay(s);
    const c = s.sched[s.d].cs[s.ci++];
    s.cur = Object.assign({}, c, { pat: PATIENCE, said: '' });
    s.res = null;
    if (s.stock[c.p] > 0) s.phase = 'haggle';
    else {
      s.phase = 'nostock'; s.dayCur.miss++; sat(s, 0);
      s.log.push({ p: c.p, miss: 1 }); hist(s, { d: s.d + 1, k: 'nostock', p: c.p });
    }
    return null;
  }
  function sell(s, price) {
    const c = s.cur, basis = s.basis[c.p], gain = r2(price - basis);
    const sc = Math.round(50 + 50 * clamp((c.max - price) / (0.5 * c.max), 0, 1));
    s.cash += price; s.dayCur.rev += price; s.dayCur.cogs += basis; s.dayCur.sold++;
    s.tot.rev += price; s.tot.cogs += basis; s.tot.soldUnits++; s.tot.tx++; sat(s, sc);
    s.spent[c.p] -= basis; s.stock[c.p]--;
    if (!s.stock[c.p]) { s.spent[c.p] = 0; s.basis[c.p] = 0; }
    s.log.push({ p: c.p, price, first: c.first, max: c.max, gain });
    hist(s, { d: s.d + 1, k: 'sale', p: c.p, amt: price, cogs: r2(basis) });
    s.res = { ok: 1, price, gain, left: c.max - price, sat: sc };
    s.phase = 'result';
    return null;
  }
  function walk(s) {
    const c = s.cur;
    s.dayCur.walked++; sat(s, 20);
    s.log.push({ p: c.p, walk: 1, first: c.first, max: c.max });
    hist(s, { d: s.d + 1, k: 'walk', p: c.p });
    s.res = { ok: 0, max: c.max };
    s.phase = 'result';
    return null;
  }
  function closeDay(s) {
    const d = s.dayCur;
    s.days.push({ rev: r2(d.rev), cogs: r2(d.cogs), gross: r2(d.rev - d.cogs), sold: d.sold, walked: d.walked, miss: d.miss });
    s.dayCur = { rev: 0, cogs: 0, sold: 0, walked: 0, miss: 0 };
  }
  function endDay(s) {
    s.spoiled = 0;
    P.forEach((p) => {
      if (p.spoil && s.stock[p.id] > 0) {
        const q = s.stock[p.id], amt = r2(q * s.basis[p.id]);
        s.spoiled += q; s.tot.writeOff += amt;
        hist(s, { d: s.d + 1, k: 'spoil', p: p.id, q, amt });
        s.stock[p.id] = 0; s.spent[p.id] = 0; s.basis[p.id] = 0;
      }
    });
    closeDay(s);
    s.cur = null; s.res = null;
    s.phase = s.d >= DAYS - 1 ? 'final' : 'dayend';
    if (s.phase === 'final') finalize(s);
    return null;
  }

  function finalize(s) {
    let liq = 0, leftCost = 0;
    P.forEach((p) => { leftCost += s.stock[p.id] * s.basis[p.id]; });
    liq = Math.round(leftCost * LIQ);
    const t = s.tot, result = Math.round(s.cash + liq - START), gross = t.rev - t.cogs, K = SCORE;
    const margin = t.rev > 0 ? 100 * gross / t.rev : null;
    const lossPct = 100 * (t.writeOff + leftCost * (1 - LIQ)) / Math.max(1, t.boughtAmt);
    const good = s.days.filter((d) => d.sold > 0 && d.gross >= 0).length;
    const parts = {
      profit: Math.round(K.PROFIT_MAX * clamp(result / K.PROFIT_FULL, 0, 1)),
      margin: margin == null ? 0 : Math.round(K.MARGIN_MAX * clamp((margin - K.MARGIN_LOW) / (K.MARGIN_FULL - K.MARGIN_LOW), 0, 1)),
      satisfaction: t.satN ? Math.round(K.SAT_MAX * (t.satSum / t.satN) / 100) : 0,
      inventory: Math.round(K.INV_MAX * (1 - clamp(lossPct / K.INV_LOSS_FULL, 0, 1)) * clamp(t.soldUnits / K.INV_MIN_SALES, 0, 1)),
      consistency: Math.round(K.CONS_MAX * good / DAYS),
    };
    s.liq = liq; s.result = result; s.breakdown = { parts };
    s.score = parts.profit + parts.margin + parts.satisfaction + parts.inventory + parts.consistency;
  }

  // Returns null on success, or a short error string. Never trusts the shape of `b`.
  function apply(s, b) {
    if (!b || typeof b.type !== 'string') return 'bad';
    const t = b.type, p = s.phase, c = s.cur;
    if (t === 'buy') {
      if (p !== 'stock' || !isPid(b.pid) || (b.dir !== 1 && b.dir !== -1)) return 'bad';
      const cost = s.sched[s.d].cost[b.pid];
      if (b.dir === 1) {
        if (!(s.cash >= cost)) return 'cash';
        s.spent[b.pid] += cost; s.stock[b.pid]++; s.cash -= cost; s.bought[b.pid]++;
        s.tot.boughtUnits++; s.tot.boughtAmt += cost; s.tot.bought[b.pid]++; s.tot.tx++;
        hist(s, { d: s.d + 1, k: 'buy', p: b.pid, q: 1, amt: cost });
      } else {
        if (!s.bought[b.pid]) return 'none';
        s.spent[b.pid] -= cost; s.stock[b.pid]--; s.cash += cost; s.bought[b.pid]--;
        s.tot.boughtUnits--; s.tot.boughtAmt -= cost; s.tot.bought[b.pid]--; s.tot.tx++;
        hist(s, { d: s.d + 1, k: 'return', p: b.pid, q: 1, amt: cost });
      }
      s.basis[b.pid] = s.stock[b.pid] ? s.spent[b.pid] / s.stock[b.pid] : 0;
      return null;
    }
    if (t === 'open') { if (p !== 'stock') return 'bad'; s.ci = 0; return nextC(s); }
    if (t === 'accept') { if (p !== 'haggle') return 'bad'; return sell(s, c.offer); }
    if (t === 'counter') {
      if (p !== 'haggle' || !Number.isSafeInteger(b.price) || b.price < 1 || b.price > 1e6) return 'bad';
      if (b.price <= c.max) return sell(s, Math.max(b.price, c.offer));
      c.pat--;
      if (c.pat <= 0) return walk(s);
      c.offer = Math.round(c.offer + (c.max - c.offer) * 0.45);
      c.said = 'high';
      return null;
    }
    if (t === 'leave') { if (p !== 'haggle') return 'bad'; return walk(s); }
    if (t === 'next') { if (p !== 'result' && p !== 'nostock') return 'bad'; return nextC(s); }
    if (t === 'nextday') {
      if (p !== 'dayend') return 'bad';
      s.d++; s.phase = 'stock'; s.bought = zero(); s.cur = null; s.res = null;
      return null;
    }
    return 'bad';
  }

  // What the player is allowed to see. The hidden limit of the CURRENT shopper is never included.
  function view(s, run) {
    let units = 0, cost = 0;
    P.forEach((p) => { units += s.stock[p.id]; cost += s.stock[p.id] * s.basis[p.id]; });
    const t = s.tot, gross = t.rev - t.cogs;
    return {
      runId: run.id, day: s.d + 1, cash: s.cash, phase: s.phase, ev: s.sched[s.d].ev, wx: { k: s.sched[s.d].wx, fav: s.sched[s.d].fav }, cost: s.sched[s.d].cost,
      stock: s.stock, basis: s.basis, bought: s.bought, idx: s.ci,
      cur: s.cur && { name: s.cur.name, face: s.cur.face, p: s.cur.p, offer: s.cur.offer, pat: s.cur.pat, said: s.cur.said },
      res: s.res, dayLog: s.days, hist: s.hist, spoiled: s.spoiled,
      fin: {
        start: START, cash: s.cash, rev: Math.round(t.rev), cogs: Math.round(t.cogs), gross: Math.round(gross),
        margin: t.rev > 0 ? Math.round(1000 * gross / t.rev) / 10 : null,
        unitsBought: t.boughtUnits, unitsSold: t.soldUnits, invUnits: units, invCost: Math.round(cost),
        writeOff: Math.round(t.writeOff), tx: t.tx, satisfaction: t.satN ? Math.round(t.satSum / t.satN) : null,
      },
      score: s.score, liq: s.liq, result: s.result, breakdown: s.breakdown,
      sponsor: s.sponsor ? { brand: s.sponsor.brand, product: s.sponsor.product, tagline: s.sponsor.tagline } : null,
      ranked: !!run.ranked, note: s.note,
    };
  }

  // A finished run no longer needs the hidden week. Keep only what view() and analytics read.
  function compact(s) {
    const keep = s.sched[s.d];
    s.sched = Array(DAYS).fill(null);
    s.sched[s.d] = { ev: keep.ev, wx: keep.wx, fav: keep.fav, cost: keep.cost };
    return s;
  }

  return { fresh, apply, view, compact, build };
}

module.exports = { createEngine, rules, ENGINE_V, START, PER, DAYS, PATIENCE, LIQ, SCORE, PRODUCTS: P.map((p) => p.id), WEATHER: Object.keys(WX), money };
