# LRU Cache

Design a Least-Recently-Used (LRU) cache that supports `get`, `put`, `delete`, and `size` in **O(1)** average time.

## Functional requirements

- `get(key)` — return the value if present (and mark as most-recently-used), else `null`.
- `put(key, value)` — insert or update. When at capacity, evict the least-recently-used entry.
- `delete(key)` — remove an entry. Returns whether the key existed.
- `size()` — current number of entries.

## Non-functional

- Both `get` and `put` must be O(1) amortized.
- Capacity is a constructor parameter; the cache must never exceed it.
- Thread-safety is **not** required for this problem (single-threaded test harness).

## Protocol

Your program reads one JSON command per line on stdin and writes one JSON response per line.

```json
{ "op": "init", "capacity": 2 }
{ "op": "put", "key": "a", "value": 1 }
{ "op": "put", "key": "b", "value": 2 }
{ "op": "get", "key": "a" }
{ "op": "put", "key": "c", "value": 3 }   // evicts "b"
{ "op": "get", "key": "b" }                // null
```

## Scoring

- 70% correctness
- 30% AI design review (HashMap + doubly-linked-list pattern, clean abstraction)

Don't reach for `OrderedDict` (Python) or `LinkedHashMap` (Java) — the rubric specifically checks that you've built the two-data-structure pattern yourself.
