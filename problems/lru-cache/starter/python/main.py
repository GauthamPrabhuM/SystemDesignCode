"""Starter — LRU Cache. Build a HashMap + doubly-linked-list yourself."""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Node:
    key: Any
    value: Any
    prev: "Node | None" = None
    next: "Node | None" = None


class LRUCache:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self._map: dict[Any, Node] = {}
        # Sentinel head and tail to avoid edge cases
        self._head = Node(None, None)
        self._tail = Node(None, None)
        self._head.next = self._tail
        self._tail.prev = self._head

    def _remove(self, n: Node) -> None:
        n.prev.next = n.next        # type: ignore[union-attr]
        n.next.prev = n.prev        # type: ignore[union-attr]

    def _push_front(self, n: Node) -> None:
        n.next = self._head.next
        n.prev = self._head
        self._head.next.prev = n    # type: ignore[union-attr]
        self._head.next = n

    def get(self, key: Any) -> Any:
        n = self._map.get(key)
        if not n:
            return None
        self._remove(n)
        self._push_front(n)
        return n.value

    def put(self, key: Any, value: Any) -> None:
        if key in self._map:
            n = self._map[key]
            n.value = value
            self._remove(n)
            self._push_front(n)
            return
        if len(self._map) >= self.capacity:
            lru = self._tail.prev
            assert lru is not None and lru is not self._head
            self._remove(lru)
            del self._map[lru.key]
        n = Node(key, value)
        self._push_front(n)
        self._map[key] = n

    def delete(self, key: Any) -> bool:
        n = self._map.pop(key, None)
        if not n:
            return False
        self._remove(n)
        return True

    def size(self) -> int:
        return len(self._map)


def main() -> None:
    cache: LRUCache | None = None
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        cmd = json.loads(line)
        op = cmd["op"]
        if op == "init":
            cache = LRUCache(cmd["capacity"])
            print(json.dumps({"ok": True}), flush=True)
        elif op == "put":
            assert cache
            cache.put(cmd["key"], cmd["value"])
            print(json.dumps({"ok": True}), flush=True)
        elif op == "get":
            assert cache
            print(json.dumps({"value": cache.get(cmd["key"])}), flush=True)
        elif op == "delete":
            assert cache
            print(json.dumps({"existed": cache.delete(cmd["key"])}), flush=True)
        elif op == "size":
            assert cache
            print(json.dumps({"size": cache.size()}), flush=True)
        else:
            print(json.dumps({"error": f"unknown op: {op}"}), flush=True)


if __name__ == "__main__":
    main()
