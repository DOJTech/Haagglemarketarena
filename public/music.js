/* Music for Haggle Market Arena.
   1. Built-in beats: original, generated in the browser (no recordings, so no copyright issues). The mood follows the weather.
   2. My music: audio files chosen from the phone. They are played from the device and never uploaded.
   3. From the internet: a direct audio or radio link, or a Spotify or YouTube link shown in that service's own player.
   We do not store or supply commercial songs. Nothing plays until the player presses Play. */
(function (root) {
  'use strict';
  /* ---------- pure parts (tested in test/music.unit.test.js) ---------- */
  const MOODS = {
    sun: { bpm: 104, root: 57, scale: [0, 2, 4, 7, 9], pluck: .55, rain: 0 },
    hot: { bpm: 110, root: 55, scale: [0, 2, 4, 7, 9], pluck: .6, rain: 0 },
    cloud: { bpm: 98, root: 57, scale: [0, 2, 3, 7, 9], pluck: .4, rain: 0 },
    rain: { bpm: 88, root: 54, scale: [0, 3, 5, 7, 10], pluck: .35, rain: .5 },
    storm: { bpm: 84, root: 52, scale: [0, 3, 5, 7, 10], pluck: .25, rain: .9 },
    harm: { bpm: 94, root: 50, scale: [0, 2, 5, 7, 9], pluck: .35, rain: 0 },
  };
  const mulberry = a => () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  // One bar of 16 steps: a laid-back, danceable pattern. Deterministic for a given mood and bar number.
  function bar(mood, n) {
    const M = MOODS[mood] || MOODS.cloud, R = mulberry(n * 2654435761 + mood.length * 97), ev = [];
    [0, 6, 10].forEach(s => ev.push({ step: s, kind: 'kick' }));
    [4, 12].forEach(s => ev.push({ step: s, kind: 'clap' }));
    for (let s = 0; s < 16; s += 2) ev.push({ step: s, kind: 'hat', accent: s % 4 === 0 });
    for (let s = 1; s < 16; s += 2) if (R() < .6) ev.push({ step: s, kind: 'shk' });
    [0, 3, 6, 10, 12].forEach((s, i) => ev.push({ step: s, kind: 'bass', note: M.root - 12 + M.scale[(i * 2 + (n % 2)) % M.scale.length] }));
    for (let s = 0; s < 16; s++) if (s % 2 === 1 && R() < M.pluck * .6) ev.push({ step: s, kind: 'pluck', note: M.root + 12 + M.scale[Math.floor(R() * M.scale.length)] });
    return ev;
  }
  // Only these hosts are shown in an embedded player. Everything else must be a plain https audio link.
  function parseLink(raw) {
    let u; try { u = new URL(String(raw).trim()); } catch (e) { return { error: 'That does not look like a web address.' }; }
    if (u.protocol !== 'https:') return { error: 'Only secure (https) links are allowed.' };
    if (u.username || u.password) return { error: 'That link contains a login, so it was refused.' };
    const h = u.hostname.toLowerCase(), p = u.pathname.replace(/\/+$/, '');
    if (h === 'open.spotify.com') {
      const m = p.match(/^(?:\/intl-[a-z-]+)?\/(track|album|playlist|episode|show)\/([A-Za-z0-9]{10,40})$/);
      return m ? { kind: 'embed', service: 'Spotify', src: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2] } : { error: 'Please paste a Spotify track, album or playlist link.' };
    }
    if (h === 'www.youtube.com' || h === 'youtube.com' || h === 'm.youtube.com' || h === 'youtu.be') {
      const id = h === 'youtu.be' ? p.slice(1) : (u.searchParams.get('v') || '');
      const list = u.searchParams.get('list') || '';
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return { kind: 'embed', service: 'YouTube', src: 'https://www.youtube-nocookie.com/embed/' + id };
      if (/^[A-Za-z0-9_-]{10,60}$/.test(list)) return { kind: 'embed', service: 'YouTube', src: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + list };
      return { error: 'Please paste a YouTube video or playlist link.' };
    }
    if (/(^|\.)(spotify|youtube|youtu|audiomack|boomplay|apple|music\.apple|deezer|soundcloud|tidal)\.[a-z.]+$/.test(h)) return { error: 'That service cannot be played inside the game. Open its own app and let it play in the background, or paste a Spotify or YouTube link.' };
    return { kind: 'audio', src: u.href };
  }
  const api = { MOODS, bar, parseLink, midiHz, mulberry };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---------- browser parts ---------- */
  const $ = s => document.querySelector(s), get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, put = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
  let ctx, master, noiseBuf, rainG, timer, nextT = 0, stepN = 0, barN = 0, mood = 'cloud', on = false, audio = null, files = [], fi = 0, embed = null, src = get('haggle.msrc') || 'synth';
  const vol = () => (+(get('haggle.mvol') || 50)) / 100;
  const say = t => { const e = $('#mmsg'); if (e) e.textContent = t || ''; };
  function setup() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { say('This browser cannot play the built-in beats.'); return false; }
    if (ctx) return true;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = vol() * .6; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function tone(t, f, dur, type, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05); }
  function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); o.connect(g); g.connect(master); o.start(t); o.stop(t + .22); }
  function hiss(t, dur, hp, v) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .02); }
  function play(e, t) {
    if (e.kind === 'kick') kick(t); else if (e.kind === 'clap') hiss(t, .12, 1500, .35); else if (e.kind === 'hat') hiss(t, .04, 7000, e.accent ? .22 : .12);
    else if (e.kind === 'shk') hiss(t, .03, 5000, .08); else if (e.kind === 'bass') tone(t, midiHz(e.note), .22, 'triangle', .5); else if (e.kind === 'pluck') tone(t, midiHz(e.note), .35, 'sine', .22);
  }
  function tick() {
    const M = MOODS[mood], sd = 60 / M.bpm / 4; let cur = bar(mood, barN);
    while (nextT < ctx.currentTime + .25) {
      const t = nextT + (stepN % 2 ? sd * .12 : 0); cur.filter(e => e.step === stepN).forEach(e => play(e, t));
      nextT += sd; if (++stepN === 16) { stepN = 0; barN++; cur = bar(mood, barN); }
    }
  }
  function rainLayer() {
    if (rainG) { try { rainG.src.stop(); } catch (e) {} rainG = null; }
    const M = MOODS[mood]; if (!M.rain || !ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = .4;
    const g = ctx.createGain(); g.gain.value = M.rain * .14; s.connect(f); f.connect(g); g.connect(master); s.start(); rainG = { src: s };
  }
  function startSynth() { if (!setup()) return; ctx.resume(); nextT = ctx.currentTime + .1; stepN = 0; rainLayer(); clearInterval(timer); timer = setInterval(tick, 60); }
  function stopAll() { clearInterval(timer); if (rainG) { try { rainG.src.stop(); } catch (e) {} rainG = null; } if (ctx && ctx.state === 'running') ctx.suspend(); if (audio) audio.pause(); const f = $('#membed'); if (f) f.innerHTML = ''; embed = null; }
  function loadTrack() {
    if (!files.length) return say('Choose some audio files from your phone first.');
    if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); }
    audio = new Audio(URL.createObjectURL(files[fi])); audio.volume = vol(); audio.onended = () => { fi = (fi + 1) % files.length; loadTrack(); };
    audio.play().catch(() => say('Could not play that file. Try another one.')); say('Now playing: ' + files[fi].name);
  }
  function go() {
    stopAll(); on = true; $('#mplay').textContent = 'Pause'; $('#mplay').setAttribute('aria-pressed', 'true');
    if (src === 'synth') { startSynth(); say('Playing built-in beats. They match the weather: ' + mood + '.'); }
    else if (src === 'phone') loadTrack();
    else if (src === 'web') webGo();
  }
  function halt() { stopAll(); on = false; $('#mplay').textContent = 'Play'; $('#mplay').setAttribute('aria-pressed', 'false'); say('Music paused.'); }
  function webGo() {
    const r = parseLink(($('#murl') || {}).value || ''); if (r.error) { say(r.error); return halt(); }
    if (r.kind === 'embed') {
      if (!confirm('This will show ' + r.service + "'s own player. It is run by " + r.service + ', which may use cookies and see that you are using it. Continue?')) return halt();
      const f = document.createElement('iframe'); f.src = r.src; f.title = r.service + ' player'; f.width = '100%'; f.height = '152'; f.setAttribute('allow', 'autoplay; encrypted-media'); f.referrerPolicy = 'no-referrer'; f.style.border = '0';
      $('#membed').innerHTML = ''; $('#membed').appendChild(f); embed = f; say('Use the ' + r.service + ' player below to start the music.');
    } else {
      audio = new Audio(); audio.src = r.src; audio.volume = vol();
      audio.onerror = () => { say('That link did not play as audio. It must be a direct link to a song file or a radio stream.'); halt(); };
      audio.play().then(() => say('Playing your link.')).catch(() => say('Your browser blocked it or the link is not playable audio.'));
    }
  }
  function setVol(v) { put('haggle.mvol', v); if (master) master.gain.value = v / 100 * .6; if (audio) audio.volume = v / 100; }
  function setSrc(v) { src = v; put('haggle.msrc', v); document.querySelectorAll('[data-msrc]').forEach(e => e.hidden = e.dataset.msrc !== v); if (on) go(); }
  function init() {
    const btn = $('#musicb'), pan = $('#musicp'); if (!btn || !pan) return;
    const close = () => { pan.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); };
    btn.onclick = () => { const open = pan.hidden; pan.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) { const f = pan.querySelector('input,select,button'); if (f) f.focus(); } };
    pan.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }); $('#mclose').onclick = close;
    $('#mplay').onclick = () => on ? halt() : go();
    $('#mnext').onclick = () => { if (src === 'phone' && files.length) { fi = (fi + 1) % files.length; if (on) loadTrack(); } };
    $('#mvol').value = String(+(get('haggle.mvol') || 50)); $('#mvol').oninput = e => setVol(+e.target.value);
    document.querySelectorAll('input[name=msrc]').forEach(r => { r.checked = r.value === src; r.onchange = () => setSrc(r.value); });
    $('#mfile').onchange = e => { files = Array.from(e.target.files).filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name)); fi = 0; say(files.length ? files.length + ' file(s) ready. Press Play.' : 'No audio files found in that choice.'); };
    $('#murl').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    const cu = $('#mcur'); if (cu) { cu.innerHTML = Object.entries(CUR).map(([k, v]) => '<option value="' + k + '"' + (CURRENCY === k ? ' selected' : '') + '>' + v.n + ' (' + v.s.trim() + ')</option>').join(''); cu.onchange = () => { setCurrency(cu.value); if (typeof render === 'function') render(); }; }
    setSrc(src);
    // The game tells the music about the weather so the mood follows it.
    window.addEventListener('haggle:wx', e => { const m = e.detail; if (MOODS[m] && m !== mood) { mood = m; if (on && src === 'synth') { rainLayer(); say('Music mood changed with the weather: ' + m + '.'); } } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
