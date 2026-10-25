// Naija Radio: original in-game music (made live in the browser), your own songs from your phone, and links from the internet.
// Nothing here uploads your files. Embedded players (Spotify, YouTube, Apple Music, Audiomack) run in their own sandboxed frames.
(function () {
  const ST = window.HaggleStations, ML = window.MusicLinks, AC = window.AudioContext || window.webkitAudioContext;
  const WX_ST = { sun: 'market', hot: 'lagos', cloud: 'highlife', rain: 'rain', harm: 'highlife' };   // what Auto plays on each kind of day
  const R = { ac: null, master: null, nbuf: null, playing: false, timer: null, step: 0, base: 0, pend: null, wx: 'sun',
    station: get('haggle.st') || 'auto', vol: get('haggle.vol') === null ? 60 : +get('haggle.vol'), sfxOn: get('haggle.sfx') === '1', ambOn: get('haggle.amb') === '1',
    amb: null, src: 'radio', tracks: [], ti: -1, aud: null, frame: null, shelf: null, msg: '', open: false, err: '' };

  /* ---------- sound ---------- */
  function ctx() {
    if (!AC) return null;
    if (!R.ac) {
      R.ac = new AC(); const comp = R.ac.createDynamicsCompressor(); R.master = R.ac.createGain(); R.master.connect(comp); comp.connect(R.ac.destination);
      const n = R.ac.sampleRate * 2, b = R.ac.createBuffer(1, n, R.ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; R.nbuf = b;
    }
    R.master.gain.value = Math.pow(R.vol / 100, 2) * 0.7;
    if (R.ac.state === 'suspended' && R.ac.resume) R.ac.resume();
    return R.ac;
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(type, f, t, dur, peak, dest, f2) {
    const a = R.ac, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.5);
    env(g, t, 0.005, peak, dur); o.connect(g); g.connect(dest || R.master); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(t, dur, peak, type, freq, q, dest) {
    const a = R.ac, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = R.nbuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    env(g, t, 0.002, peak, dur); s.connect(f); f.connect(g); g.connect(dest || R.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  const V = {
    k: (t, v) => tone('sine', 150, t, 0.3, 0.9 * v, null, 42),
    s: (t, v) => { hiss(t, 0.16, 0.5 * v, 'bandpass', 1900, 0.8); tone('triangle', 200, t, 0.1, 0.25 * v); },
    h: (t, v) => hiss(t, 0.045, 0.22 * v, 'highpass', 7000),
    x: (t, v) => hiss(t, 0.07, 0.16 * v, 'bandpass', 5200, 1.2),
    c: (t, v) => { tone('square', 540, t, 0.16, 0.07 * v); tone('square', 810, t, 0.16, 0.06 * v); },
    g: (t, v) => tone('sine', 330, t, 0.14, 0.4 * v, null, 230),
  };
  function chord(st, bar, t, dur) {
    const a = R.ac, lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = st.voice === 'soft' ? 900 : 1600; lp.connect(R.master);
    const type = st.voice === 'soft' ? 'sine' : 'triangle', peak = st.voice === 'soft' ? 0.06 : 0.05;
    st.chords[bar % st.chords.length].forEach((n) => tone(type, mtof(st.root + st.up + n), t, dur, peak, lp));
  }
  function playStep(st, step, t) {
    const i = step % 16, bar = Math.floor(step / 16), sd = 60 / st.bpm / 4;
    for (const key of ['k', 's', 'h', 'x', 'c', 'g']) if (st[key][i]) V[key](t, st[key][i]);
    if (st.bass[i] != null) tone('triangle', mtof(st.root + st.bass[i]), t, sd * 3, 0.55);
    if (st.chordSteps.includes(i)) chord(st, bar, t, st.voice === 'soft' ? sd * 7 : sd * 2.5);
    if (st.arp && st.arp[i] != null) { const ch = st.chords[bar % st.chords.length]; tone('triangle', mtof(st.root + st.up + 12 + ch[st.arp[i] % ch.length]), t, sd * 2, 0.12); }
  }
  const stId = () => (R.station === 'auto' ? WX_ST[R.wx] || 'market' : R.station);
  function pump() {
    if (!R.playing) return;
    let st = ST[stId()];
    while (R.base + (R.step * 60 / st.bpm / 4) + (R.step % 2 ? st.swing * 60 / st.bpm / 4 : 0) < R.ac.currentTime + 0.15) {
      if (R.step % 16 === 0 && R.pend !== null) { R.pend = null; st = ST[stId()]; }
      const sd = 60 / st.bpm / 4; playStep(st, R.step, R.base + R.step * sd + (R.step % 2 ? st.swing * sd : 0)); R.step++;
    }
  }
  function startSynth() { if (!ctx()) return false; stopSynth(); R.playing = true; R.step = 0; R.base = R.ac.currentTime + 0.08; R.timer = setInterval(pump, 25); pump(); return true; }
  function stopSynth() { R.playing = false; if (R.timer) clearInterval(R.timer); R.timer = null; }
  function setAmb() {
    if (R.amb) { try { R.amb.stop(); } catch (e) {} R.amb = null; }
    if (!R.ambOn || !ctx() || (R.wx !== 'rain' && R.wx !== 'harm')) return;
    const a = R.ac, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = R.nbuf; s.loop = true;
    f.type = R.wx === 'rain' ? 'bandpass' : 'lowpass'; f.frequency.value = R.wx === 'rain' ? 1100 : 380; g.gain.value = R.wx === 'rain' ? 0.1 : 0.05; s.connect(f); f.connect(g); g.connect(R.master); s.start(); R.amb = s;
  }
  function sfx(kind) {
    if (!R.sfxOn || !R.ac || R.ac.state !== 'running') return; const t = R.ac.currentTime + 0.01;
    if (kind === 'sale') { tone('sine', 880, t, 0.18, 0.3); tone('sine', 1320, t + 0.09, 0.3, 0.3); }
    else if (kind === 'walk') tone('sawtooth', 240, t, 0.28, 0.12, null, 150);
    else if (kind === 'day') { tone('triangle', 523, t, 0.25, 0.25); tone('triangle', 659, t + 0.12, 0.25, 0.25); tone('triangle', 784, t + 0.24, 0.4, 0.25); }
  }

  /* ---------- phone files, internet links ---------- */
  function audio() { if (!R.aud) { R.aud = new Audio(); R.aud.preload = 'none'; R.aud.onended = () => { if (R.src === 'phone') playTrack(R.ti + 1); }; R.aud.onerror = () => say(T('That track could not be played.')); } return R.aud; }
  function say(m) { R.msg = m; const e = document.getElementById('mnow'); if (e) e.textContent = m; }
  function stopOthers(keep) {
    if (keep !== 'radio') stopSynth();
    if (keep !== 'phone' && keep !== 'net' && R.aud) R.aud.pause();
    if (keep !== 'net-frame' && R.frame) { R.frame.remove(); R.frame = null; }
    if (keep === 'net-frame' && R.aud) R.aud.pause();
    if (keep === 'net' || keep === 'net-frame') stopSynth();
    if (keep === 'phone' && R.frame) { R.frame.remove(); R.frame = null; }
  }
  function playTrack(i) {
    if (!R.tracks.length) return; if (i < 0) i = R.tracks.length - 1; if (i >= R.tracks.length) i = 0;
    stopOthers('phone'); R.ti = i; const a = audio(); a.src = R.tracks[i].url; a.volume = R.vol / 100;
    const p = a.play(); if (p && p.catch) p.catch(() => say(T('Tap play to start the music.')));
    say(T('Now playing: {t}', { t: R.tracks[i].name })); draw();
  }
  function addFiles(files) {
    for (const f of Array.from(files || []).slice(0, 50)) {
      if (R.tracks.length >= 50) break;
      if (f.type.indexOf('audio') === 0 || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba)$/i.test(f.name)) R.tracks.push({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 80), url: URL.createObjectURL(f) });
    }
    if (R.ti < 0 && R.tracks.length) playTrack(0); else draw();
  }
  function clearTracks() { if (R.aud) { R.aud.pause(); R.aud.removeAttribute('src'); } R.tracks.forEach((t) => URL.revokeObjectURL(t.url)); R.tracks = []; R.ti = -1; say(''); draw(); }
  function playLink(url, title) {
    R.err = ''; const p = ML.parse(url);
    if (!p) { R.err = T('That link is not supported. Paste a Spotify, YouTube, Apple Music or Audiomack link, or a direct https link to an audio file.'); draw(); return; }
    if (p.kind === 'audio') { stopOthers('net'); const a = audio(); a.src = p.src; a.volume = R.vol / 100; const pr = a.play(); if (pr && pr.catch) pr.catch(() => say(T('Tap play to start the music.'))); say(T('Now playing: {t}', { t: title || p.src })); R.src = 'net'; draw(); return; }
    stopOthers('net-frame'); R.src = 'net';
    const f = document.createElement('iframe');
    f.src = p.embed; f.height = String(p.height); f.setAttribute('width', '100%'); f.title = T('Music player'); f.loading = 'lazy'; f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.setAttribute('allow', 'autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture'); f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation');
    f.style.border = '0'; f.style.borderRadius = '12px'; R.frame = f; say(T('Now playing: {t}', { t: title || p.kind })); draw();
  }
  async function loadShelf() { if (R.shelf) return; try { R.shelf = (await api('music')).rows; } catch (e) { R.shelf = []; } draw(); }

  /* ---------- panel ---------- */
  const NAMES = () => ({ auto: T('Auto (follows the weather)'), lagos: T(ST.lagos.name), market: T(ST.market.name), highlife: T(ST.highlife.name), rain: T(ST.rain.name) });
  const chip = (id, label, on, extra) => `<button class="chip" type="button" data-${extra}="${id}" aria-pressed="${on}">${esc(label)}</button>`;
  function draw() {
    const el = document.getElementById('music'); if (!el) return;
    const btn = document.getElementById('musicbtn'); if (btn) { btn.setAttribute('aria-expanded', String(R.open)); btn.classList.toggle('on', R.playing || (R.aud && !R.aud.paused) || !!R.frame); }
    el.hidden = !R.open; if (!R.open) return;
    const nm = NAMES(), playingNow = R.src === 'radio' ? R.playing : (R.aud && !R.aud.paused);
    const radio = AC ? `<div class="ctl" role="group" aria-label="${esc(T('Station'))}">${Object.keys(nm).map((k) => chip(k, nm[k], R.station === k, 'st')).join('')}</div>
<button class="btn" id="mplay" type="button">${R.playing ? T('Pause music') : T('Play music')}</button>
<label for="mvol">${T('Volume')}</label><input id="mvol" type="range" min="0" max="100" value="${R.vol}">
<label class="chk"><input type="checkbox" id="msfx"${R.sfxOn ? ' checked' : ''}> ${T('Sound effects (cha-ching on a sale)')}</label>
<label class="chk"><input type="checkbox" id="mamb"${R.ambOn ? ' checked' : ''}> ${T('Weather sounds (rain, harmattan wind)')}</label>
<p class="hint">${T('Original music made live on your phone by the game. No download and no data.')}</p>` : `<p class="err">${T('This browser cannot play the game radio.')}</p>`;
    const phone = `<label for="mfile">${T('Choose songs from your phone')}</label><input id="mfile" type="file" accept="audio/*" multiple>
<p class="hint">${T('Songs play on your phone only. Nothing is uploaded.')}</p>
${R.tracks.length ? `<ol class="tracks">${R.tracks.map((t, i) => `<li><button class="rep" type="button" data-tr="${i}" aria-pressed="${i === R.ti}">${i === R.ti ? '\u25b6 ' : ''}${esc(t.name)}</button></li>`).join('')}</ol>
<div class="ctl"><button class="chip" type="button" id="mprev">${T('Previous')}</button><button class="chip" type="button" id="mpp">${playingNow && R.src === 'phone' ? T('Pause') : T('Play')}</button><button class="chip" type="button" id="mnext">${T('Next')}</button><button class="chip" type="button" id="mclr">${T('Clear list')}</button></div>` : ''}`;
    const net = `<h3>${T('Naija hits')}</h3>${R.shelf === null ? `<p class="hint">${T('Loading...')}</p>` : R.shelf.length ? `<ul class="shelf">${R.shelf.map((x, i) => `<li><button class="btn alt" type="button" data-sh="${i}">\u25b6 ${esc(x.title)}</button></li>`).join('')}</ul>` : `<p class="hint">${T('No picks yet. Paste a link below.')}</p>`}
<label for="murl">${T('Paste a music link')}</label><input id="murl" type="url" inputmode="url" autocomplete="off" placeholder="https://" maxlength="400"><button class="btn" id="mgo" type="button">${T('Play link')}</button>
${R.err ? `<p class="err" role="alert">${esc(R.err)}</p>` : ''}<div id="mframe"></div>
<p class="hint">${T('Works with Spotify, YouTube, Apple Music, Audiomack or a direct https audio link. Streaming songs play inside the service\u2019s own player under its own licence and rules (you may need to sign in for full songs). Direct links use your mobile data.')}</p>`;
    el.innerHTML = `<div class="mhead"><h2>${T('Naija Radio')}</h2><button class="rep" type="button" id="mclose">${T('Close')}</button></div>
<div class="ctl" role="group" aria-label="${esc(T('Music source'))}">${chip('radio', T('Game radio'), R.tab === 'radio', 'tab')}${chip('phone', T('My phone'), R.tab === 'phone', 'tab')}${chip('net', T('From the internet'), R.tab === 'net', 'tab')}</div>
<div>${R.tab === 'radio' ? radio : R.tab === 'phone' ? phone : net}</div><p id="mnow" class="hint" role="status" aria-live="polite">${esc(R.msg)}</p>`;
    if (R.tab === 'net' && R.frame) document.getElementById('mframe').appendChild(R.frame);
    wire(el);
  }
  function wire(el) {
    const $$ = (s) => el.querySelectorAll(s), by = (id) => el.querySelector('#' + id);
    by('mclose').onclick = () => { R.open = false; draw(); const b = document.getElementById('musicbtn'); if (b) b.focus(); };
    $$('[data-tab]').forEach((b) => b.onclick = () => { R.tab = b.dataset.tab; if (R.tab === 'net') loadShelf(); draw(); });
    $$('[data-st]').forEach((b) => b.onclick = () => { R.station = b.dataset.st; put('haggle.st', R.station); R.pend = true; if (!R.playing) { stopOthers('radio'); R.src = 'radio'; startSynth(); say(T('Now playing: {t}', { t: NAMES()[R.station] })); } draw(); });
    const pl = by('mplay'); if (pl) pl.onclick = () => { if (R.playing) { stopSynth(); say(''); } else { stopOthers('radio'); R.src = 'radio'; if (startSynth()) say(T('Now playing: {t}', { t: NAMES()[R.station] })); } draw(); };
    const vol = by('mvol'); if (vol) vol.oninput = () => { R.vol = +vol.value; put('haggle.vol', R.vol); if (R.master) R.master.gain.value = Math.pow(R.vol / 100, 2) * 0.7; if (R.aud) R.aud.volume = R.vol / 100; };
    const sf = by('msfx'); if (sf) sf.onchange = () => { R.sfxOn = sf.checked; put('haggle.sfx', R.sfxOn ? 1 : 0); if (R.sfxOn) { ctx(); sfx('sale'); } };
    const am = by('mamb'); if (am) am.onchange = () => { R.ambOn = am.checked; put('haggle.amb', R.ambOn ? 1 : 0); setAmb(); };
    const f = by('mfile'); if (f) f.onchange = () => { R.src = 'phone'; addFiles(f.files); };
    $$('[data-tr]').forEach((b) => b.onclick = () => { R.src = 'phone'; playTrack(+b.dataset.tr); });
    const pv = by('mprev'), nx = by('mnext'), pp = by('mpp'), cl = by('mclr');
    if (pv) pv.onclick = () => playTrack(R.ti - 1); if (nx) nx.onclick = () => playTrack(R.ti + 1); if (cl) cl.onclick = clearTracks;
    if (pp) pp.onclick = () => { const a = audio(); if (a.paused) { if (R.ti < 0) playTrack(0); else { stopOthers('phone'); R.src = 'phone'; const p = a.play(); if (p && p.catch) p.catch(() => {}); } } else a.pause(); draw(); };
    $$('[data-sh]').forEach((b) => b.onclick = () => { const x = R.shelf[+b.dataset.sh]; if (x) playLink(x.url, x.title); });
    const go = by('mgo'), url = by('murl'); if (go) { go.onclick = () => playLink(url.value, ''); url.onkeydown = (e) => { if (e.key === 'Enter') go.click(); }; }
  }
  R.tab = 'radio';
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && R.open) { R.open = false; draw(); } });
  const btn = document.getElementById('musicbtn'); if (btn) btn.onclick = () => { R.open = !R.open; if (R.open && R.tab === 'net') loadShelf(); draw(); if (R.open) { const h = document.querySelector('#music h2'); if (h) { h.tabIndex = -1; h.focus(); } } };

  window.Radio = {
    draw,
    // The game tells the radio what the weather is today. Auto changes station at the next bar; weather sounds follow.
    weather(k) { if (!WX_ST[k] || k === R.wx) return; R.wx = k; if (R.station === 'auto') R.pend = true; setAmb(); },
    sfx,
    _state: R,
  };
})();
