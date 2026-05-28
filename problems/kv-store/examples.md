# In-Memory KV Store — Examples

## Example 1: Basic set and get

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `set("x", 42, now_ms=0)` | ok | No TTL |
| 2 | `get("x", now_ms=100)` | `{value: 42}` | Still alive |
| 3 | `get("missing", now_ms=0)` | `{value: null}` | Not found |
| 4 | `ttl("x", now_ms=0)` | `{ttl_ms: -1}` | -1 = no expiry |

---

## Example 2: TTL expiry

**Key "y" expires after 500ms**

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `set("y", "hello", ttl_ms=500, now_ms=0)` | ok | Expires at t=500 |
| 2 | `get("y", now_ms=499)` | `{value: "hello"}` | Not yet expired |
| 3 | `get("y", now_ms=500)` | `{value: null}` | **Expired** (>= expiry) |
| 4 | `ttl("y", now_ms=200)` | `{ttl_ms: 300}` | 300ms remaining |
| 5 | `ttl("y", now_ms=600)` | `{ttl_ms: -2}` | -2 = key gone/expired |

---

## Example 3: keys() filters expired entries

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `set("a", 1, now_ms=0)` | ok | No TTL |
| 2 | `set("b", 2, ttl_ms=100, now_ms=0)` | ok | Expires at 100 |
| 3 | `set("c", 3, now_ms=0)` | ok | No TTL |
| 4 | `keys(now_ms=50)` | `{keys: ["a","b","c"]}` | b still alive |
| 5 | `keys(now_ms=200)` | `{keys: ["a","c"]}` | b expired, sorted |

---

## Example 4: Overwrite resets TTL

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `set("x", 1, ttl_ms=100, now_ms=0)` | ok | Expires at t=100 |
| 2 | `set("x", 2, now_ms=50)` | ok | **Overwrites — no TTL now** |
| 3 | `get("x", now_ms=200)` | `{value: 2}` | Still alive (TTL cleared) |
| 4 | `ttl("x", now_ms=200)` | `{ttl_ms: -1}` | -1 = persistent |
