"""Rate Limiter — sliding window algorithm.

stdin:  {"commands": [{"op": "init", "rate": 3, "window_ms": 1000}, ...]}
stdout: {"responses": [{"ok": true}, {"allowed": true}, ...]}
"""
from __future__ import annotations
import json, sys
from collections import defaultdict, deque


class SlidingWindowRateLimiter:
    def __init__(self, rate: int, window_ms: int) -> None:
        self.rate = rate
        self.window_ms = window_ms
        # per-user deque of request timestamps (ms)
        self._windows: dict[str, deque[int]] = defaultdict(deque)

    def allow(self, user_id: str, now_ms: int) -> bool:
        dq = self._windows[user_id]
        cutoff = now_ms - self.window_ms
        # evict expired timestamps
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


def main() -> None:
    data = json.load(sys.stdin)
    limiter: SlidingWindowRateLimiter | None = None
    responses = []

    for cmd in data["commands"]:
        op = cmd["op"]
        if op == "init":
            limiter = SlidingWindowRateLimiter(cmd["rate"], cmd["window_ms"])
            responses.append({"ok": True})
        elif op == "allow":
            assert limiter
            responses.append({"allowed": limiter.allow(cmd["user_id"], cmd["now_ms"])})
        elif op == "usage":
            assert limiter
            responses.append({"count": limiter.usage(cmd["user_id"], cmd["now_ms"])})
        else:
            responses.append({"error": f"unknown op: {op}"})

    print(json.dumps({"responses": responses}))


if __name__ == "__main__":
    main()
