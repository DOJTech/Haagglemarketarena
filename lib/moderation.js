'use strict';
/* Display-name moderation. A starter filter: extend it with BLOCKED_WORDS in the environment. */
const COUNTRIES = ['NG','GH','KE','ZA','EG','SN','CI','CM','UG','TZ','RW','GB','US','CA','IN','AE','DE','FR','BR','OTHER'];

// Matched anywhere inside the name (spaces and symbols removed). Keep these long and unambiguous.
const LONG = ['fuck','bitch','asshole','pussy','nigger','nigga','faggot','whore','slut','rapist','porn','hitler','bastard','dickhead','ashawo','oloshi','wanker','retard','motherfuck'];
// Matched only as a whole word, so real names such as Nazir, Nazia, Dickson or Hancock are never blocked.
const SHORT = new Set(['shit','cunt','ass','dick','cock','twat','sex','rape','kill','nazi','mumu','coon','kike','spic','chink','fck','fuk','fuq','btch',
  'admin','owner','haggle','official','support','moderator','mod','staff','claude','anthropic']);

// Look-alike letters from other alphabets that are used to dodge filters.
const CONFUSABLE = { 'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','у':'y','і':'i','ѕ':'s','ј':'j','ԁ':'d','ɡ':'g',
  'ο':'o','α':'a','ε':'e','ρ':'p','ν':'v','τ':'t','ι':'i','κ':'k','μ':'u','υ':'u','β':'b' };

const fold = (t) => String(t).normalize('NFKC').toLowerCase().replace(/./gu, (ch) => CONFUSABLE[ch] || ch);
const leet = (t) => fold(t).replace(/0/g,'o').replace(/[1!|]/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/[5$]/g,'s').replace(/7/g,'t').replace(/@/g,'a');
const dedupe = (t) => t.replace(/(.)\1+/g, '$1');

// Letters, numbers, spaces and . _ - only. This also removes invisible and right-to-left control characters.
const NAME_RE = /[^\p{L}\p{N} ._-]/gu;
const clean = (s) => String(s == null ? 'Trader' : s).normalize('NFKC').replace(NAME_RE, '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'Trader';

function createModerator(extra = []) {
  const long = LONG.concat(extra.map((x) => leet(x).replace(/[^a-z]/g, '')).filter((x) => x.length >= 4));
  function bad(raw) {
    raw = String(raw).slice(0, 100);
    const tokens = leet(raw).split(/[^a-z]+/).filter(Boolean), jl = tokens.join('');
    if (/\d{6,}/.test(raw.replace(/\s/g, '')) || /https?|www|\.com|\.ng\b/i.test(raw)) return true;
    if (tokens.some((t) => SHORT.has(t) || SHORT.has(dedupe(t)))) return true;
    return long.some((w) => jl.includes(w) || dedupe(jl).includes(dedupe(w)));
  }
  // Checks the raw text (catches f*ck style tricks) and the cleaned text.
  function moderate(raw) {
    const name = clean(raw);
    return bad(raw == null ? '' : raw) || bad(name) ? { name: null, rejected: true } : { name, rejected: false };
  }
  return { bad, moderate };
}

// Uniqueness key: look-alike letters and separators are folded, so "Tunde", "tunde" and "T.unde" are the same name.
const nameKey = (s) => fold(clean(s)).replace(/[^\p{L}\p{N}]/gu, '');

module.exports = { createModerator, clean, nameKey, NAME_RE, COUNTRIES };
