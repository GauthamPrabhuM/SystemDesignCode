# Rate Limiter — Examples

## Example 1: Basic allow / deny

**Config: rate=3, window_ms=1000 (3 requests per second)**

| Step | Operation | Returns | Window contents at that moment |
|------|-----------|---------|-------------------------------|
| 1 | `init(rate=3, window_ms=1000)` | ok | `[]` |
| 2 | `allow("alice", 0)` | `true` | `[0]` |
| 3 | `allow("alice", 200)` | `true` | `[0, 200]` |
| 4 | `allow("alice", 400)` | `true` | `[0, 200, 400]` — at capacity |
| 5 | `allow("alice", 500)` | **`false`** | `[0, 200, 400]` — 4th request blocked |
| 6 | `allow("alice", 1001)` | `true` | `[200, 400, 1001]` — ts=0 expired, window slid |

---

## Example 2: Sliding window vs fixed window

**Why sliding window is fairer than fixed window:**

```
Fixed window (1s buckets):
  Bucket [0–1000ms]:  3 requests ✓
  Bucket [1000–2000ms]: 3 requests ✓
  → But: 3 at t=900ms + 3 at t=1100ms = 6 requests in 200ms! Burst allowed.

Sliding window (last 1000ms):
  At t=1100ms, window = [900, 1000, 1100] — 3 requests already, next is denied.
  → No burst at window boundaries.
```

---

## Example 3: Independent users

**rate=1, window_ms=1000**

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `allow("alice", 0)` | `true` | Alice's window: `[0]` |
| 2 | `allow("bob", 0)` | `true` | Bob's window: `[0]` — independent |
| 3 | `allow("alice", 100)` | `false` | Alice blocked |
| 4 | `allow("bob", 100)` | `false` | Bob blocked |
| 5 | `allow("alice", 1001)` | `true` | Alice's ts=0 expired |

Each user has their own sliding window. One user's requests don't affect others.
