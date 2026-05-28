# Editorial — Rate Limiter

## Algorithm comparison

| Algorithm | Accuracy | Memory | Burst | Complexity |
|-----------|----------|--------|-------|------------|
| Fixed Window | Low (burst at boundary) | O(1) | Allows double-burst | Trivial |
| Sliding Window Log | Exact | O(rate) per user | None | Simple |
| Sliding Window Counter | ~Exact | O(1) | None | Simple |
| Token Bucket | Exact | O(1) | Configurable | Simple |
| Leaky Bucket | Exact | O(rate) | None | Medium |

**This problem uses Sliding Window Log** — store the actual timestamps.

---

## Implementation

```python
from collections import defaultdict, deque

class SlidingWindowLimiter:
    def __init__(self, rate: int, window_ms: int):
        self.rate = rate
        self.window_ms = window_ms
        self._windows: dict[str, deque[int]] = defaultdict(deque)

    def allow(self, user_id: str, now_ms: int) -> bool:
        dq = self._windows[user_id]
        cutoff = now_ms - self.window_ms

        # Evict timestamps outside the window (slide it)
        while dq and dq[0] <= cutoff:
            dq.popleft()

        if len(dq) < self.rate:
            dq.append(now_ms)
            return True
        return False

    def usage(self, user_id: str, now_ms: int) -> int:
        dq = self._windows[user_id]
        cutoff = now_ms - self.window_ms
        while dq and dq[0] <= cutoff:
            dq.popleft()
        return len(dq)
```

---

## Thread safety

```python
import threading

class ThreadSafeLimiter(SlidingWindowLimiter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._locks: dict[str, threading.Lock] = defaultdict(threading.Lock)

    def allow(self, user_id: str, now_ms: int) -> bool:
        with self._locks[user_id]:  # per-user lock, not global
            return super().allow(user_id, now_ms)
```

Per-user locks allow concurrent requests from different users without contention.

---

## Complexity

| Operation | Time | Space |
|-----------|------|-------|
| allow() | O(evicted timestamps) amortised O(1) | O(rate) per user |
| usage() | O(evicted timestamps) | O(1) |

---

## Production considerations

- **Redis backend**: Store each user's window as a Redis `ZSET` scored by timestamp. `ZREMRANGEBYSCORE` evicts expired entries. Atomic with Lua scripts.
- **Distributed**: Multiple API servers share one Redis — all reads/writes go to the same store.
- **Memory cap**: Set a max number of tracked users; evict least-active when memory is full.
- **Observability**: Track `requests_allowed`, `requests_denied`, `p99_latency` per user tier.
