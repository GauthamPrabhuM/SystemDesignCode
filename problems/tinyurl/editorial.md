# Editorial — URL Shortener

## Storage model

```python
class URLShortener:
    codes:  dict[str, str]  # code → url
    clicks: dict[str, int]  # code → click_count
```

Simple in-memory maps. In production: a key-value store (Redis for hot cache) backed by a DB (Postgres/Cassandra for durability).

---

## ID generation: random vs base62

### Option A: Random 6-char code (simpler, use this first)
```python
ALPHABET = string.ascii_letters + string.digits  # 62 chars

def _generate(self) -> str:
    for _ in range(100):
        code = "".join(random.choices(ALPHABET, k=6))
        if code not in self.codes:
            return code
    raise RuntimeError("namespace exhausted")
```

Collision probability with N URLs: `N / 62^6 ≈ N / 56B`. At 1M URLs: 0.002%. Fine.

### Option B: Base62 encoding (deterministic, no collision)
```python
def _encode(self, n: int) -> str:
    result = []
    while n:
        result.append(ALPHABET[n % 62])
        n //= 62
    return "".join(reversed(result)).zfill(6)
```

Auto-incrementing counter → encode → always unique. But sequential codes are guessable (security concern for private URLs).

---

## Core operations

```python
def shorten(self, url: str, alias: str | None = None) -> dict:
    code = alias if alias else self._generate()
    if code in self.codes:
        return {"error": "alias taken"}
    self.codes[code] = url
    self.clicks[code] = 0
    return {"code": code}

def expand(self, code: str) -> dict:
    url = self.codes.get(code)
    if url:
        self.clicks[code] += 1  # track the click
    return {"url": url}          # None if not found
```

---

## Complexity

| Operation | Time | Space |
|-----------|------|-------|
| shorten() | O(1) avg | O(1) |
| expand() | O(1) | O(1) |
| delete() | O(1) | O(1) |
| Total | — | O(N) for N URLs |

---

## Production scale

**At 100M URLs, single machine won't cut it:**

- **Storage**: Shard by the first 2 chars of the code (62^2 = 3844 shards).
- **Cache**: Cache the top 20% of URLs (hot URLs) in Redis — they'll serve 80% of expand() requests.
- **Write path**: Accept via API → enqueue → batch write to DB. No synchronous DB write on shorten().
- **Custom domains**: `goo.gl/abc` vs `bit.ly/abc` — store `{domain, code}` as composite key.
- **Analytics**: Don't block expand() on analytics write. Emit a Kafka event; analytics consumer processes asynchronously.
