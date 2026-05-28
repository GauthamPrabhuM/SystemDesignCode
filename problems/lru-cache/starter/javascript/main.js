const fs = require("fs");

class LRUCache {
  constructor(capacity) {
    this.cap = capacity;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return null;
    const val = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, val);
    return val ?? null;
  }
  put(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.cap) this.map.delete(this.map.keys().next().value);
    this.map.set(key, value);
  }
  delete(key) { return this.map.delete(key); }
  size() { return this.map.size; }
}

const input = JSON.parse(fs.readFileSync("/dev/stdin", "utf8"));
let cache = null;
const responses = [];

for (const cmd of input.commands) {
  switch (cmd.op) {
    case "init":   cache = new LRUCache(cmd.capacity); responses.push({ ok: true }); break;
    case "put":    cache.put(cmd.key, cmd.value);       responses.push({ ok: true }); break;
    case "get":    responses.push({ value: cache.get(cmd.key) }); break;
    case "delete": responses.push({ existed: cache.delete(cmd.key) }); break;
    case "size":   responses.push({ size: cache.size() }); break;
    default:       responses.push({ error: `unknown op: ${cmd.op}` });
  }
}

console.log(JSON.stringify({ responses }));
