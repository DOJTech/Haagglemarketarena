'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createModerator, clean } = require('../lib/moderation');
const m = createModerator(['badword']);
test('real names are not blocked', () => {
  for (const n of ['Nazir', 'Nazia', 'Dickson', 'Hancock', 'Cassandra', 'Scunthorpe', 'Tunde', 'Amaka', 'Ngozi 99', 'Chidi_X', 'Kofi', 'Wanjiru', 'Ọlájídé', 'Zainab'])
    assert.equal(m.moderate(n).rejected, false, n);
});
test('common evasions are blocked', () => {
  for (const n of ['f*ck', 'Fuuuck', 'f u c k', 'fuсk', 'Nazi', 'sh1t', 'n1gg3r', 'admin', 'Admin', 'call 08012345678', 'www.x', 'b!tch', 'my badword'])
    assert.equal(m.moderate(n).rejected, true, n);
});
test('clean strips invisible, control and combining characters and caps length', () => {
  assert.equal(clean('a\u202Eb\u200Bc'), 'abc');
  assert.equal(clean('Z̷a̸l̶g̵o̴'), 'Zalgo');
  assert.equal(clean('x'.repeat(50)).length, 20);
  assert.equal(clean('<script>'), 'script');
  assert.equal(clean(null), 'Trader'); assert.equal(clean('   '), 'Trader');
});
