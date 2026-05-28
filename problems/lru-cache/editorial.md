# Editorial — LRU Cache

## Core insight

Two requirements conflict:
- **O(1) lookup** → needs a hash map
- **O(1) "least recently used" eviction + promotion** → needs an ordered structure with O(1) remove-from-anywhere

The solution: **HashMap + Doubly-Linked List**

```
HashMap:        key → node (O(1) access to any node)
LinkedList:     head = MRU ... tail = LRU (O(1) move-to-front, O(1) evict-tail)
```

---

## Data structures

```python
class Node:
    key, value, prev, next

class LRUCache:
    _map: dict[key, Node]
    _head: Node  # sentinel, never holds data
    _tail: Node  # sentinel, never holds data
```

Sentinel nodes: `_head.next = first real node`, `_tail.prev = last real node`.
Invariant: MRU is always `_head.next`, LRU is always `_tail.prev`.

---

## Operations

**get(key):**
1. Look up node in `_map` — O(1)
2. `_remove(node)` from its current position — O(1)  
3. `_push_front(node)` — O(1)
4. Return `node.value`

**put(key, value):**
1. If key exists: update value, `_remove`, `_push_front`
2. Else: create node, `_push_front`, add to `_map`
3. If `len(_map) > capacity`: `evict = _tail.prev`, `_remove(evict)`, `del _map[evict.key]`

---

## Key helpers

```python
def _remove(self, n):
    n.prev.next = n.next
    n.next.prev = n.prev

def _push_front(self, n):
    n.next = self._head.next
    n.prev = self._head
    self._head.next.prev = n
    self._head.next = n
```

---

## Complexity

| Operation | Time | Space |
|-----------|------|-------|
| get() | O(1) | — |
| put() | O(1) | — |
| Total space | — | O(capacity) |

---

## Common mistakes

- **Forgetting to update HashMap on eviction**: deleting the tail node from the list but not `del _map[evict.key]` causes memory leak and stale lookups.
- **get() returning without promoting**: the order must be updated on every access.
- **Single-node edge case**: sentinel nodes completely eliminate this — no special-casing needed.

---

## Extending this design

- **Thread safety**: wrap the whole cache in a `threading.Lock` — or use a read-write lock (`threading.RLock`) to allow concurrent gets.
- **TTL**: store an expiry timestamp alongside each node; evict expired nodes lazily on access.
- **LFU cache**: replace the linked list with a frequency-bucketed list of lists (significantly harder).
