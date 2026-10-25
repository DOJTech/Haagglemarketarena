// Run: node --test test/music.unit.test.js (no browser, no speakers, no network)
const test = require('node:test'), assert = require('node:assert/strict');
const M = require('../public/music.js'), { WX } = require('../engine');
test('every weather in the game has a music mood, and nothing extra', () => assert.deepEqual(Object.keys(M.MOODS).sort(), Object.keys(WX).sort()));
test('beats: deterministic, every event inside the bar, notes in a sane range, all instruments present', () => {
  for (const mood of Object.keys(M.MOODS)) for (let n = 0; n < 40; n++) {
    const a = M.bar(mood, n), b = M.bar(mood, n); assert.deepEqual(a, b);
    for (const e of a) { assert.ok(Number.isInteger(e.step) && e.step >= 0 && e.step < 16); if (e.note !== undefined) assert.ok(e.note >= 28 && e.note <= 96, mood + ' ' + e.note); }
    const kinds = new Set(a.map(e => e.kind)); for (const k of ['kick', 'clap', 'hat', 'bass']) assert.ok(kinds.has(k), k);
  }
  assert.notDeepEqual(M.bar('sun', 1), M.bar('sun', 2), 'bars vary');
  assert.ok(Math.abs(M.midiHz(69) - 440) < 1e-9 && Math.abs(M.midiHz(57) - 220) < 1e-9);
});
test('slower and softer when it rains', () => { assert.ok(M.MOODS.storm.bpm < M.MOODS.sun.bpm); assert.ok(M.MOODS.storm.rain > 0 && M.MOODS.sun.rain === 0); });
test('links: Spotify and YouTube become official embeds only', () => {
  const sp = M.parseLink('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc');
  assert.deepEqual([sp.kind, sp.service, sp.src], ['embed', 'Spotify', 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC']);
  assert.equal(M.parseLink('https://open.spotify.com/intl-fr/playlist/37i9dQZF1DXcBWIGoYBM5M').src, 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M');
  assert.equal(M.parseLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3').src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(M.parseLink('https://youtu.be/dQw4w9WgXcQ').src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(M.parseLink('https://www.youtube.com/playlist?list=PLabcdefghij123').src, 'https://www.youtube-nocookie.com/embed/videoseries?list=PLabcdefghij123');
});
test('links: a direct https audio link or radio stream is allowed', () => {
  assert.deepEqual(M.parseLink('https://stream.example.com/live.mp3'), { kind: 'audio', src: 'https://stream.example.com/live.mp3' });
  assert.equal(M.parseLink('  https://radio.example.ng/stream  ').kind, 'audio');
});
test('links: hostile or wrong input is refused', () => {
  for (const bad of ['', 'not a url', 'javascript:alert(1)', 'http://example.com/a.mp3', 'ftp://example.com/a.mp3', 'data:audio/mp3;base64,AAAA', 'file:///etc/passwd', 'blob:https://x/1',
    'https://user:pass@example.com/a.mp3', 'https://open.spotify.com.evil.com/track/4uLU6hMCjMI75M1A2tKUQC', 
    'https://open.spotify.com/track/short', 'https://open.spotify.com/user/someone', 'https://www.youtube.com/watch?v=<script>', 'https://www.youtube.com/', 'https://youtu.be/tooshort',
    'https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ', null, undefined, 42, {}]) {
    const r = M.parseLink(bad); assert.ok(r.error && !r.src, JSON.stringify(bad));
  }
  for (const svc of ['https://audiomack.com/song/x/y', 'https://www.boomplay.com/songs/1', 'https://music.apple.com/ng/album/x/1', 'https://soundcloud.com/a/b', 'https://www.deezer.com/track/1'])
    assert.match(M.parseLink(svc).error, /cannot be played inside the game/, svc);
});
test('a look-alike path on another website is only ever a plain audio link, never an embedded player', () => {
  for (const u of ['https://evil.com/open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'https://evil.com/watch?v=dQw4w9WgXcQ&u=youtube.com']) assert.equal(M.parseLink(u).kind, 'audio');
});
test('embedded hosts are exactly the two the security policy allows', () => {
  const csp = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8').match(/frame-src ([^;]+);/)[1].split(' ').sort();
  const hosts = new Set(); for (const u of ['https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'https://youtu.be/dQw4w9WgXcQ']) hosts.add(new URL(M.parseLink(u).src).origin);
  assert.deepEqual([...hosts].sort(), csp);
});
