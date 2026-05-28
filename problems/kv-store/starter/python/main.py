"""In-Memory KV Store with TTL — starter solution.

stdin:  {"commands": [{"op": "set", "key": "x", "value": 1, "now_ms": 0}, ...]}
stdout: {"responses": [{"ok": true}, ...]}
"""
from __future__ import annotations
import json, sys
from typing import Any


class KVStore:
    def __init__(self) -> None:
        self._data: dict[str, Any] = {}
        self._expiry: dict[str, int] = {}  # key → expiry timestamp ms

    def _is_expired(self, key: str, now_ms: int) -> bool:
        exp = self._expiry.get(key)
        return exp is not None and now_ms >= exp

    def _alive(self, key: str, now_ms: int) -> bool:
        return key in self._data and not self._is_expired(key, now_ms)

    def set(self, key: str, value: Any, now_ms: int, ttl_ms: int | None = None) -> dict:
        self._data[key] = value
        if ttl_ms is not None:
            self._expiry[key] = now_ms + ttl_ms
        else:
            self._expiry.pop(key, None)
        return {"ok": True}

    def get(self, key: str, now_ms: int) -> dict:
        if not self._alive(key, now_ms):
            return {"value": None}
        return {"value": self._data[key]}

    def delete(self, key: str) -> dict:
        if key not in self._data:
            return {"deleted": False}
        del self._data[key]
        self._expiry.pop(key, None)
        return {"deleted": True}

    def exists(self, key: str, now_ms: int) -> dict:
        return {"exists": self._alive(key, now_ms)}

    def ttl(self, key: str, now_ms: int) -> dict:
        if not self._alive(key, now_ms):
            return {"ttl_ms": -2}
        exp = self._expiry.get(key)
        if exp is None:
            return {"ttl_ms": -1}
        return {"ttl_ms": exp - now_ms}

    def keys(self, now_ms: int) -> dict:
        live = sorted(k for k in self._data if self._alive(k, now_ms))
        return {"keys": live}

    def flush(self) -> dict:
        self._data.clear()
        self._expiry.clear()
        return {"ok": True}


def main() -> None:
    data = json.load(sys.stdin)
    store = KVStore()
    responses: list[Any] = []

    for cmd in data["commands"]:
        op = cmd["op"]
        if op == "set":
            responses.append(store.set(cmd["key"], cmd["value"], cmd["now_ms"], cmd.get("ttl_ms")))
        elif op == "get":
            responses.append(store.get(cmd["key"], cmd["now_ms"]))
        elif op == "delete":
            responses.append(store.delete(cmd["key"]))
        elif op == "exists":
            responses.append(store.exists(cmd["key"], cmd["now_ms"]))
        elif op == "ttl":
            responses.append(store.ttl(cmd["key"], cmd["now_ms"]))
        elif op == "keys":
            responses.append(store.keys(cmd["now_ms"]))
        elif op == "flush":
            responses.append(store.flush())
        else:
            responses.append({"error": f"unknown op: {op}"})

    print(json.dumps({"responses": responses}))


if __name__ == "__main__":
    main()
