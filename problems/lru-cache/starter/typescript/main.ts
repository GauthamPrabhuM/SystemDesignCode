import * as fs from "fs";

// --- LRU Cache ---
class LRUCache {
  private cap: number;
  private map: Map<unknown, unknown>;

  constructor(capacity: number) {
    this.cap = capacity;
    // Map preserves insertion order; move-to-front = delete + re-insert
    this.map = new Map();
  }

  get(key: unknown): unknown {
    if (!this.map.has(key)) return null;
    const val = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, val);
    return val ?? null;
  }

  put(key: unknown, value: unknown): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.cap) {
      // Delete LRU (first key in Map)
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(key, value);
  }

  delete(key: unknown): boolean {
    return this.map.delete(key);
  }

  size(): number {
    return this.map.size;
  }
}

// --- main ---
const raw = fs.readFileSync("/dev/stdin", "utf8");
const input: { commands: Array<Record<string, unknown>> } = JSON.parse(raw);

let cache: LRUCache | null = null;
const responses: unknown[] = [];

for (const cmd of input.commands) {
  const op = cmd.op as string;
  switch (op) {
    case "init":
      cache = new LRUCache(cmd.capacity as number);
      responses.push({ ok: true });
      break;
    case "put":
      cache!.put(cmd.key, cmd.value);
      responses.push({ ok: true });
      break;
    case "get":
      responses.push({ value: cache!.get(cmd.key) });
      break;
    case "delete":
      responses.push({ existed: cache!.delete(cmd.key) });
      break;
    case "size":
      responses.push({ size: cache!.size() });
      break;
    default:
      responses.push({ error: `unknown op: ${op}` });
  }
}

console.log(JSON.stringify({ responses }));
