const fs = require('fs');

class KVStore {
  constructor() { this.data = new Map(); } // key → { value, expiry: ms|null }

  _alive(key, nowMs) {
    const e = this.data.get(key);
    return e && (e.expiry === null || nowMs < e.expiry);
  }
  set(key, value, nowMs, ttlMs) {
    this.data.set(key, { value, expiry: ttlMs != null ? nowMs + ttlMs : null });
    return { ok: true };
  }
  get(key, nowMs)    { return { value: this._alive(key, nowMs) ? this.data.get(key).value : null }; }
  delete(key)        {
    if (!this.data.has(key)) return { deleted: false };
    this.data.delete(key); return { deleted: true };
  }
  exists(key, nowMs) { return { exists: this._alive(key, nowMs) }; }
  ttl(key, nowMs)    {
    if (!this._alive(key, nowMs)) return { ttl_ms: -2 };
    const e = this.data.get(key);
    return { ttl_ms: e.expiry === null ? -1 : e.expiry - nowMs };
  }
  keys(nowMs)        { return { keys: [...this.data.keys()].filter(k => this._alive(k, nowMs)).sort() }; }
  flush()            { this.data.clear(); return { ok: true }; }
}

const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
const store = new KVStore();
const responses = [];

for (const { op, key, value, now_ms, ttl_ms } of input.commands) {
  switch (op) {
    case 'set':    responses.push(store.set(key, value, now_ms, ttl_ms)); break;
    case 'get':    responses.push(store.get(key, now_ms)); break;
    case 'delete': responses.push(store.delete(key)); break;
    case 'exists': responses.push(store.exists(key, now_ms)); break;
    case 'ttl':    responses.push(store.ttl(key, now_ms)); break;
    case 'keys':   responses.push(store.keys(now_ms)); break;
    case 'flush':  responses.push(store.flush()); break;
    default:       responses.push({ error: `unknown op: ${op}` });
  }
}

console.log(JSON.stringify({ responses }));
