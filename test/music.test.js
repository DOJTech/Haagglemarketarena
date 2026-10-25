'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { parse } = require('../public/musiclinks.js');
const stations = require('../public/stations.js');

test('good links become safe embeds or plain audio', () => {
  const k = (u) => (parse(u) || {}).kind;
  assert.equal(k('https://open.spotify.com/playlist/0VRrsChND56p77FczOUBbp?si=abc'), 'spotify');
  assert.equal(parse('https://open.spotify.com/intl-fr/track/5xwoFsaLjSMeiW9tdYPrWy').embed, 'https://open.spotify.com/embed/track/5xwoFsaLjSMeiW9tdYPrWy');
  assert.equal(parse('https://youtu.be/dQw4w9WgXcQ?t=5').embed, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(parse('https://music.youtube.com/playlist?list=PLabcdefghij123').embed, 'https://www.youtube-nocookie.com/embed/videoseries?list=PLabcdefghij123');
  assert.equal(k('https://music.apple.com/ng/album/some-album/1234567890?i=999'), 'apple');
  assert.equal(parse('https://audiomack.com/some-artist/song/some-song').embed, 'https://audiomack.com/embed/song/some-artist/some-song');
  assert.equal(parse('https://cdn.example.com/a/track.MP3?x=1#frag').src, 'https://cdn.example.com/a/track.MP3?x=1');
});
test('hostile or unsupported links are rejected', () => {
  for (const u of ['javascript:alert(1)', 'data:audio/mp3;base64,AAAA', 'http://open.spotify.com/track/5xwoFsaLjSMeiW9tdYPrWy', 'https://open.spotify.com.evil.com/track/5xwoFsaLjSMeiW9tdYPrWy', 'https://evil.com/open.spotify.com/track/5xwoFsaLjSMeiW9tdYPrWy',
    'https://user:pw@open.spotify.com/track/5xwoFsaLjSMeiW9tdYPrWy', 'https://open.spotify.com/track/short', 'https://youtube.com/watch?v=<script>', 'https://youtube.com.evil.co/watch?v=dQw4w9WgXcQ',
    'https://192.168.1.5/x.mp3', 'https://localhost/x.mp3', 'https://printer.local/x.mp3', 'https://example.com/page.html', 'https://audiomack.com/a/song/../../x', '', null, undefined, 'not a url', 'https://x.co/' + 'a'.repeat(500) + '.mp3'])
    assert.equal(parse(u), null, String(u).slice(0, 50));
});
test('every radio station is a well-formed pattern', () => {
  assert.equal(Object.keys(stations).length, 4);
  for (const [id, s] of Object.entries(stations)) {
    for (const k of ['k', 's', 'h', 'x', 'c', 'g', 'bass']) assert.equal(s[k].length, 16, id + '.' + k);
    for (const k of ['k', 's', 'h', 'x', 'c', 'g']) assert.ok(s[k].every((v) => v >= 0 && v <= 1), id + ' loudness ' + k);
    assert.ok(s.bpm >= 70 && s.bpm <= 130); assert.ok(s.chords.length === 4 && s.chords.every((c) => c.length >= 3)); assert.ok(s.chordSteps.every((i) => i >= 0 && i < 16));
    assert.ok(s.k.some(Boolean), id + ' has a kick'); if (s.arp) assert.equal(s.arp.length, 16);
  }
});
