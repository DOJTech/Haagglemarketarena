'use strict';
/* Small in-memory sliding-window limiter. Correct for a single server instance (see docs/PRODUCTION_CHECKLIST.md). */
class RateLimiter {
  constructor(windowMs, maxKeys = 100000) { this.win = windowMs; this.m = new Map(); this.maxKeys = maxKeys; }
  // Records a hit and returns true when the key is now over `max`.
  hit(key, max) {
    const t = Date.now(), a = (this.m.get(key) || []).filter((x) => t - x < this.win);
    a.push(t);
    if (!this.m.has(key) && this.m.size >= this.maxKeys) this.sweep();
    this.m.set(key, a);
    return a.length > max;
  }
  count(key) { const t = Date.now(); return (this.m.get(key) || []).filter((x) => t - x < this.win).length; }
  retryAfter(key) { const a = this.m.get(key) || []; return a.length ? Math.max(1, Math.ceil((this.win - (Date.now() - a[0])) / 1000)) : 1; }
  clear(key) { this.m.delete(key); }
  sweep() { const t = Date.now(); for (const [k, a] of this.m) if (!a.some((x) => t - x < this.win)) this.m.delete(k); }
}
module.exports = { RateLimiter };
