# URL Shortener — Examples

## Example 1: Basic shorten and expand

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `shorten("https://google.com", alias="goog")` | `{code: "goog"}` | Custom alias used |
| 2 | `expand("goog")` | `{url: "https://google.com"}` | Click count: 1 |
| 3 | `expand("goog")` | `{url: "https://google.com"}` | Click count: 2 |
| 4 | `stats("goog")` | `{clicks: 2}` | Tracks total expands |
| 5 | `expand("missing")` | `{url: null}` | Not found → null |

---

## Example 2: Auto-generated code

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `shorten("https://verylongurl.com/a/b/c?q=1")` | `{code: "aB3xYz"}` | 6-char random code |
| 2 | `shorten("https://another.com")` | `{code: "mK9pQr"}` | Different code |
| 3 | `expand("aB3xYz")` | `{url: "https://verylongurl..."}` | Resolves correctly |

Auto-generated codes are 6 alphanumeric characters (62^6 ≈ 56 billion combinations).

---

## Example 3: Alias collision

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `shorten("https://first.com", alias="abc")` | `{code: "abc"}` | |
| 2 | `shorten("https://second.com", alias="abc")` | `{error: "alias taken"}` | Alias already used |

---

## Example 4: Delete and reuse

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `shorten("https://temp.com", alias="tmp")` | `{code: "tmp"}` | |
| 2 | `delete("tmp")` | `{deleted: true}` | |
| 3 | `expand("tmp")` | `{url: null}` | Gone |
| 4 | `delete("tmp")` | `{deleted: false}` | Already gone |
| 5 | `shorten("https://new.com", alias="tmp")` | `{code: "tmp"}` | Alias is now free to reuse |
