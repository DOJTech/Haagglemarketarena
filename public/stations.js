// Original music patterns for the in-game radio. Data only: music.js turns them into sound with the Web Audio API.
// Each pattern has 16 steps per bar. k=kick s=clap h=hi-hat x=shaker c=cowbell g=conga (0..1 = loudness).
// bass = semitones above `root` (null = rest). chords = 4 bars of semitone offsets above `root`+`up`; chordSteps = where they are hit.
// arp = (optional) plucked notes picked from the bar's chord by index. voice = 'keys' | 'pluck' | 'soft'.
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.HaggleStations = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  const _ = null;
  return {
    lagos: { name: 'Lagos Nights', bpm: 102, swing: 0.1, root: 45, up: 24, voice: 'keys',
      k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,1,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0.5],
      h: [0.6,0,0.4,0, 0.6,0,0.4,0.3, 0.6,0,0.4,0, 0.6,0,0.4,0.3], x: [0.3,0.2,0.3,0.2, 0.3,0.2,0.3,0.2, 0.3,0.2,0.3,0.2, 0.3,0.2,0.3,0.2],
      c: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], g: [0,0,0,0.5, 0,0,0,0, 0,0.5,0,0, 0,0,0.4,0],
      bass: [0,_,_,0, _,_,3,_, 5,_,_,3, _,0,_,_],
      chords: [[0,3,7,10], [-4,0,3,7], [-2,2,5,9], [-5,-2,2,5]], chordSteps: [0,6,10] },
    market: { name: 'Market Hustle', bpm: 118, swing: 0.06, root: 38, up: 24, voice: 'keys',
      k: [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      h: [0.5,0.3,0.5,0.3, 0.5,0.3,0.5,0.3, 0.5,0.3,0.5,0.3, 0.5,0.3,0.5,0.3], x: [0,0.3,0,0.3, 0,0.3,0,0.3, 0,0.3,0,0.3, 0,0.3,0,0.3],
      c: [0,0,0.6,0, 0,0.6,0,0, 0.6,0,0,0.6, 0,0,0.6,0], g: [0,0.5,0,0, 0.5,0,0.4,0, 0,0.5,0,0, 0.5,0,0.4,0.4],
      bass: [0,_,0,_, _,7,_,5, 0,_,0,_, _,3,_,5],
      chords: [[0,4,7,11], [-5,-1,2], [-3,0,4], [-7,-3,0]], chordSteps: [0,3,8,11] },
    highlife: { name: 'Highlife Gold', bpm: 92, swing: 0.14, root: 43, up: 24, voice: 'pluck',
      k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0], s: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      h: [0.4,0,0.3,0, 0.4,0,0.3,0, 0.4,0,0.3,0, 0.4,0,0.3,0], x: [0.25,0,0.25,0, 0.25,0,0.25,0, 0.25,0,0.25,0, 0.25,0,0.25,0],
      c: [0.5,0,0,0.5, 0,0,0.5,0, 0,0,0.5,0, 0.5,0,0,0], g: [0,0,0.4,0, 0,0.4,0,0, 0,0,0.4,0, 0,0.4,0,0.4],
      bass: [0,_,_,_, 7,_,_,_, 0,_,_,_, 5,_,7,_],
      chords: [[0,4,7,12], [5,9,12,16], [-5,-1,2,7], [5,9,12,16]], chordSteps: [0], arp: [0,_,2,_, 1,_,2,_, 0,_,2,_, 3,_,2,_] },
    rain: { name: 'Rainy Day', bpm: 78, swing: 0.08, root: 40, up: 24, voice: 'soft',
      k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0], s: [0,0,0,0, 0.5,0,0,0, 0,0,0,0, 0.5,0,0,0],
      h: [0.3,0,0.2,0, 0.3,0,0.2,0, 0.3,0,0.2,0, 0.3,0,0.2,0], x: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      c: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], g: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      bass: [0,_,_,_, _,_,_,_, -4,_,_,_, _,_,_,_],
      chords: [[0,3,7,10,14], [-4,0,3,7], [5,8,12,15,19], [7,12,14,17]], chordSteps: [0,8] },
  };
});
