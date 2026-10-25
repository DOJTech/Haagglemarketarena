// Turns a pasted music link into a SAFE player description. Used by the pages and by the server (same rules, one source).
// Only a short list of music services is allowed to be embedded; a link to anything else is accepted only if it is a plain https audio file.
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.MusicLinks = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  const SEG = /^[A-Za-z0-9._-]{1,100}$/;
  function parse(input) {
    let u;
    try { u = new URL(String(input == null ? '' : input).trim().slice(0, 400)); } catch (e) { return null; }
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, ''), seg = u.pathname.split('/').filter(Boolean);

    if (host === 'open.spotify.com') {
      if (seg[0] && /^intl-[a-z]{2}$/.test(seg[0])) seg.shift();
      const type = seg[0], id = seg[1];
      if (['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(type) && /^[A-Za-z0-9]{22}$/.test(id || ''))
        return { kind: 'spotify', embed: 'https://open.spotify.com/embed/' + type + '/' + id, height: (type === 'track' || type === 'episode') ? 152 : 352 };
      return null;
    }
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
      let v = u.searchParams.get('v'); const list = u.searchParams.get('list');
      if (host === 'youtu.be') v = seg[0];
      else if (['embed', 'shorts', 'live'].includes(seg[0]) && seg[1] && seg[1] !== 'videoseries') v = seg[1];
      const okV = /^[A-Za-z0-9_-]{11}$/.test(v || ''), okL = /^[A-Za-z0-9_-]{10,80}$/.test(list || '');
      if (okV) return { kind: 'youtube', embed: 'https://www.youtube-nocookie.com/embed/' + v + (okL ? '?list=' + list : ''), height: 220 };
      if (okL) return { kind: 'youtube', embed: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + list, height: 220 };
      return null;
    }
    if (host === 'music.apple.com' || host === 'embed.music.apple.com') {
      if (seg.length < 3 || !/^[a-z]{2}$/.test(seg[0]) || !['album', 'playlist', 'song', 'artist'].includes(seg[1]) || seg.some((x) => x === '..' || x.length > 150)) return null;
      const i = u.searchParams.get('i');
      return { kind: 'apple', embed: 'https://embed.music.apple.com' + u.pathname + (/^\d{1,20}$/.test(i || '') ? '?i=' + i : ''), height: seg[1] === 'song' ? 175 : 450 };
    }
    if (host === 'audiomack.com') {
      const [artist, type, slug] = seg;
      if (['song', 'album', 'playlist'].includes(type) && SEG.test(artist || '') && SEG.test(slug || ''))
        return { kind: 'audiomack', embed: 'https://audiomack.com/embed/' + type + '/' + artist + '/' + slug, height: type === 'song' ? 252 : 400 };
      return null;
    }
    // A plain audio file on any https site (never an IP address or a local name).
    if (/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba)$/i.test(u.pathname) && host.includes('.') && !/^[\d.]+$/.test(host) && !host.includes(':') && !host.endsWith('.local') && !host.endsWith('.internal'))
      { u.hash = ''; return { kind: 'audio', src: u.href }; }
    return null;
  }
  return { parse };
});
