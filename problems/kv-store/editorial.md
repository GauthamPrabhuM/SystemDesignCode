# Editorial — In-Memory KV Store with TTL

## Core model

```python
@dataclass
class Entry:
    value: Any
    expiry: int | None  # absolute timestamp ms; None = no expiry

class KVStore:
    _data: dict[str, Entry]
```

---

## The alive() predicate

Every operation routes through a single check:

```python
def _alive(self, key: str, now_ms: int) -> bool:
    entry = self._data.get(key)
    if entry is None:
        return False
    return entry.expiry is None or now_ms < entry.expiry
```

**Boundary**: `now_ms >= expiry` → expired. The test cases use `now_ms == expiry` as expired.

---

## set() — the only write path

```python
def set(self, key, value, now_ms, ttl_ms=None):
    expiry = (now_ms + ttl_ms) if ttl_ms is not None else None
    self._data[key] = Entry(value=value, expiry=expiry)
    return {"ok": True}
```

Overwriting a key with no TTL clears any existing TTL — the new entry has `expiry=None`.

---

## ttl() — three return values

```python
def ttl(self, key, now_ms):
    if not self._alive(key, now_ms):
        return {"ttl_ms": -2}  # key doesn't exist or expired
    entry = self._data[key]
    if entry.expiry is None:
        return {"ttl_ms": -1}  # persistent, no TTL
    return {"ttl_ms": entry.expiry - now_ms}
```

Convention (mirrors Redis): -1 = no TTL, -2 = key doesn't exist.

---

## keys() — filter and sort

```python
def keys(self, now_ms):
    live = sorted(k for k in self._data if self._alive(k, now_ms))
    return {"keys": live}
```

O(N) scan — acceptable. In production: maintain a sorted index (skip list or B-tree) for O(log N) range scans.

---

## Complexity

| Operation | Time | Space |
|-----------|------|-------|
| set() | O(1) | O(1) |
| get() | O(1) | O(1) |
| delete() | O(1) | O(1) |
| ttl() | O(1) | O(1) |
| keys() | O(N log N) | O(N) |
| flush() | O(1) amortised | O(1) |

---

## Lazy vs eager expiry

**Lazy** (what we implement here): check on access. Simple, no background threads.

**Eager**: background goroutine/thread scans and deletes expired keys on a schedule. Prevents memory accumulation from keys that are set but never accessed. Redis uses both:
- Lazy: check on get/exists.
- Periodic: scan 20 random keys every 100ms; if >25% are expired, repeat.

---

## Extending to Redis-like system

- **Persistence**: Append-only file (AOF) — log every write command to disk.
- **Replication**: Replicate AOF to replicas; replicas replay the log.
- **Pub/Sub**: `SUBSCRIBE channel`, `PUBLISH channel message` — separate from the KV store.
- **Transactions**: `MULTI`/`EXEC` — queue commands, execute atomically.
- **Distributed**: Consistent hashing to shard keys across N nodes (Redis Cluster).
