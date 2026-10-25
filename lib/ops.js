// Counts server errors and sends ONE alert to a chat webhook (Slack, Discord, ntfy-style) when they pile up. No dependencies.
function createOps({ webhook, threshold = 10, windowMs = 300000, cooldownMs = 900000, fetchFn = globalThis.fetch, now = Date.now, log = console.error } = {}) {
  const events = []; let lastAlert = 0;
  const hook = webhook && /^https:\/\//.test(webhook) ? webhook : '';
  async function alert(text) {
    if (!hook) return false;
    try { const r = await fetchFn(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) }); return r.ok; }
    catch (e) { log('alert failed:', e.message); return false; }
  }
  return {
    enabled: !!hook,
    recent() { const t = now(); while (events.length && t - events[0].t > windowMs) events.shift(); return events.length; },
    // kind is a short label such as "5xx", "mail" or "crash". Never pass user data.
    async record(kind) {
      events.push({ t: now(), kind });
      if (this.recent() >= threshold && now() - lastAlert > cooldownMs) { lastAlert = now(); return alert('Haggle: ' + events.length + ' server problems in the last ' + Math.round(windowMs / 60000) + ' minutes (latest: ' + kind + '). Check the Render logs.'); }
      return false;
    },
    alert,
  };
}
module.exports = { createOps };
