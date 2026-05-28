import * as fs from 'fs';

interface Entry { value: unknown; expiry: number | null; } // expiry = ms timestamp or null

class KVStore {
  private data = new Map<string, Entry>();

  private alive(key: string, nowMs: number): boolean {
    const e = this.data.get(key);
    if (!e) return false;
    return e.expiry === null || nowMs < e.expiry;
  }

  set(key: string, value: unknown, nowMs: number, ttlMs?: number) {
    this.data.set(key, { value, expiry: ttlMs != null ? nowMs + ttlMs : null });
    return { ok: true };
  }
  get(key: string, nowMs: number) { return { value: this.alive(key, nowMs) ? this.data.get(key)!.value : null }; }
  delete(key: string) {
    if (!this.data.has(key)) return { deleted: false };
    this.data.delete(key); return { deleted: true };
  }
  exists(key: string, nowMs: number) { return { exists: this.alive(key, nowMs) }; }
  ttl(key: string, nowMs: number) {
    if (!this.alive(key, nowMs)) return { ttl_ms: -2 };
    const e = this.data.get(key)!;
    return { ttl_ms: e.expiry === null ? -1 : e.expiry - nowMs };
  }
  keys(nowMs: number) {
    return { keys: [...this.data.keys()].filter(k => this.alive(k, nowMs)).sort() };
  }
  flush() { this.data.clear(); return { ok: true }; }
}

const input: { commands: Array<Record<string, any>> } = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
const store = new KVStore();
const responses: unknown[] = [];

for (const cmd of input.commands) {
  const { op, key, value, now_ms, ttl_ms } = cmd;
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
