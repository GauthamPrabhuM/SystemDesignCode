# Design an In-Memory Key-Value Store

## Problem

Build a Redis-like in-memory key-value store that supports optional TTL (time-to-live) expiry. Time is controlled via command arguments so tests are deterministic.

## Requirements

- **`set(key, value, ttl_ms?, now_ms)`** — store `key → value`. If `ttl_ms` is given, the key expires after `ttl_ms` milliseconds from `now_ms`.
- **`get(key, now_ms)`** — return value or `null` if missing or expired.
- **`delete(key)`** — remove key; return `{"deleted": true/false}`.
- **`exists(key, now_ms)`** — return `{"exists": true/false}`.
- **`ttl(key, now_ms)`** — return milliseconds until expiry, `-1` if no TTL, `-2` if key doesn't exist/expired.
- **`keys(now_ms)`** — return sorted list of all non-expired keys.
- **`flush()`** — delete all keys.

## IO format

```json
{"commands": [{"op": "set", "key": "x", "value": 42, "now_ms": 0}, ...]}
{"responses": [{"ok": true}, ...]}
```

## Example

```
set("x", 1, now_ms=0)              → {"ok": true}
set("y", 2, ttl_ms=500, now_ms=0)  → {"ok": true}
get("x", now_ms=100)               → {"value": 1}
get("y", now_ms=400)               → {"value": 2}   (not yet expired)
get("y", now_ms=501)               → {"value": null} (expired)
ttl("x", now_ms=0)                 → {"ttl_ms": -1}  (no TTL)
ttl("y", now_ms=200)               → {"ttl_ms": 300} (300ms left)
exists("y", now_ms=600)            → {"exists": false}
keys(now_ms=100)                   → {"keys": ["x", "y"]}
keys(now_ms=600)                   → {"keys": ["x"]}
```

## Constraints

- Keys and values are JSON-serialisable (strings, numbers, booleans, arrays, objects)
- `now_ms` is a non-negative integer (logical clock — not real wall time)
- TTL precision is 1ms
- Up to 10,000 active keys

## What interviewers look for

- **Lazy vs eager expiry**: expired keys deleted on access vs background sweep
- **Memory management**: how you'd cap memory in production (eviction policies)
- **Persistence**: how would you add AOF (append-only file) logging?
- **Atomicity**: how `set` with TTL is atomic (both value and expiry set together)
