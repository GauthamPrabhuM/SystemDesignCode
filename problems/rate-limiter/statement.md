# Design a Rate Limiter

## Problem

Design a rate limiter that restricts how many requests a user can make within a sliding time window.

## Requirements

Implement a `RateLimiter` that supports:

- **`init(rate, window_ms)`** — initialise with `rate` requests allowed per `window_ms` milliseconds.
- **`allow(user_id, now_ms)`** — returns `true` if the request is allowed, `false` if rate-limited. Uses a **sliding window** algorithm: counts requests in the last `window_ms` milliseconds relative to `now_ms`.
- **`usage(user_id, now_ms)`** — returns how many requests this user has made in the current window.

## IO format

```json
// stdin
{"commands": [{"op": "init", "rate": 3, "window_ms": 1000}, ...]}

// stdout
{"responses": [{"ok": true}, ...]}
```

## Example

```
init(rate=3, window_ms=1000)

allow("alice", 0)     → true   (1st request)
allow("alice", 200)   → true   (2nd request)
allow("alice", 400)   → true   (3rd request)
allow("alice", 500)   → false  (4th in window — rate limited)
allow("alice", 1001)  → true   (window slid — first request expired)
usage("alice", 1001)  → 2      (requests at 200ms and 400ms still in window)
```

## Constraints

- `rate` between 1 and 10,000
- `window_ms` between 100 and 60,000
- `user_id` is any string
- `now_ms` is monotonically increasing per user (but users are independent)
- Up to 10,000 unique users

## What interviewers look for

- **Algorithm choice**: Token Bucket is simpler but Sliding Window is more accurate — explain the trade-off.
- **Memory management**: expired entries should not grow forever.
- **Thread safety**: `allow()` must be atomic under concurrent load.
- **Extensibility**: can you add per-endpoint limits without changing the core?
