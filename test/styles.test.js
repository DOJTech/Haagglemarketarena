// Run: node --test test/styles.test.js. Checks the stylesheet is well-formed, covers every weather, respects reduced motion, and keeps overlays within the contrast limits.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8'), { WX } = require('../engine');
test('braces and quotes are balanced', () => { const c = css.replace(/\/\*[\s\S]*?\*\//g, ''); assert.equal((c.match(/{/g) || []).length, (c.match(/}/g) || []).length); assert.equal((c.match(/\(/g) || []).length, (c.match(/\)/g) || []).length); assert.equal((c.match(/"/g) || []).length % 2, 0); });
test('every weather in the engine has a background rule', () => { for (const k of Object.keys(WX)) assert.ok(css.includes('body[data-wx=' + k + ']::before'), k); });
test('motion stops for people who ask for reduced motion, and nothing flashes', () => {
  assert.match(css, /prefers-reduced-motion:reduce\)\{body::after\{animation:none!important\}\}/);
  assert.ok(!/@keyframes[^{]*\{[^}]*opacity:\s*0[^}]*opacity:\s*1/i.test(css), 'no on/off flashing keyframes');
});
test('weather overlays never exceed the strengths checked for text contrast (6.8:1 or better)', () => {
  const caps = { sun: .24, hot: .30, cloud: .18, rain: .12, storm: .50, harm: .22 };
  for (const [k, cap] of Object.entries(caps)) {
    const rule = css.match(new RegExp('body\\[data-wx=' + k + '\\]::before\\{background:([^}]*)\\}'))[1];
    const first = [...rule.matchAll(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/g)].map(m => +m[1]);
    assert.ok(first.length && Math.max(...first) <= cap + 1e-9, k + ' ' + Math.max(...first) + ' > ' + cap);
  }
});
test('background images are only data: pictures (allowed by the security policy), never outside addresses', () => { for (const m of css.matchAll(/url\(([^)]*)\)/g)) assert.match(m[1].replace(/^["']/, ''), /^data:image\/svg\+xml,/, m[1].slice(0, 40)); });
test('the security policy allows data: pictures', () => assert.match(fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), /img-src 'self' data:/));
