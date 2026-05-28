# LRU Cache — Examples

## Example 1: Basic eviction

**Cache capacity = 2**

| Step | Operation | Returns | Cache (front = most recent) |
|------|-----------|---------|------------------------------|
| 1 | `init(2)` | ok | `[]` |
| 2 | `put("a", 1)` | ok | `[a:1]` |
| 3 | `put("b", 2)` | ok | `[b:2, a:1]` |
| 4 | `get("a")` | `1` | `[a:1, b:2]` ← a moved to front |
| 5 | `put("c", 3)` | ok | `[c:3, a:1]` ← **b evicted** (least recently used) |
| 6 | `get("b")` | `null` | `[c:3, a:1]` b is gone |

**Why b and not a?** After step 4, `get("a")` made `a` the most recent. `b` became the LRU, so it's evicted when capacity is exceeded.

---

## Example 2: Update promotes to most-recent

**Cache capacity = 2**

| Step | Operation | Returns | Cache |
|------|-----------|---------|-------|
| 1 | `init(2)` | ok | `[]` |
| 2 | `put("x", 10)` | ok | `[x:10]` |
| 3 | `put("y", 20)` | ok | `[y:20, x:10]` |
| 4 | `put("x", 99)` | ok | `[x:99, y:20]` ← x updated AND promoted |
| 5 | `put("z", 30)` | ok | `[z:30, x:99]` ← **y evicted** |
| 6 | `get("x")` | `99` | value was updated correctly |

**Key insight:** Updating an existing key counts as a "use" — it moves to the front just like a get.

---

## Example 3: delete and size

**Cache capacity = 3**

| Step | Operation | Returns | Cache |
|------|-----------|---------|-------|
| 1 | `init(3)` | ok | `[]` |
| 2 | `put("a", 1)` | ok | `[a:1]` |
| 3 | `put("b", 2)` | ok | `[b:2, a:1]` |
| 4 | `size()` | `2` | |
| 5 | `delete("a")` | existed: `true` | `[b:2]` |
| 6 | `delete("a")` | existed: `false` | already gone |
| 7 | `size()` | `1` | |
