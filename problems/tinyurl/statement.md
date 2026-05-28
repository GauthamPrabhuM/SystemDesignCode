# Design a URL Shortener (TinyURL)

## Problem

Build a URL shortening service like bit.ly or TinyURL. Given a long URL, produce a short code that redirects to the original.

## Requirements

- **`shorten(url, alias?)`** — returns a short code (6 chars). If `alias` is provided, use it instead of generating one. Fails if alias already taken.
- **`expand(code)`** — returns the original URL, or `null` if not found.
- **`stats(code)`** — returns `{ clicks: N }` for that short URL.
- **`delete(code)`** — removes the URL; returns `{ deleted: true/false }`.

## IO format

```json
{"commands": [{"op": "shorten", "url": "https://example.com"}, ...]}
{"responses": [{"code": "abc123"}, ...]}
```

## Example

```
shorten("https://google.com")          → {"code": "aB3xYz"}
shorten("https://github.com", "gh")    → {"code": "gh"}
expand("aB3xYz")                       → {"url": "https://google.com"}
expand("missing")                      → {"url": null}
stats("aB3xYz")                        → {"clicks": 1}   (expand counts as click)
delete("aB3xYz")                       → {"deleted": true}
expand("aB3xYz")                       → {"url": null}
```

## Constraints

- Short codes are 6 alphanumeric characters (a-z, A-Z, 0-9) unless a custom alias is given
- `expand()` increments the click counter
- Deleting a code frees it for reuse
- URLs can be up to 2048 characters

## What interviewers look for

- **ID generation**: random vs counter vs base62 encoding — explain collision probability
- **Storage**: hash map is fine; in production, discuss sharding by code prefix
- **Analytics**: discuss write-heavy counters and how to approximate at scale (HyperLogLog, approximate counting)
- **Cache**: most expansions are for hot URLs — discuss caching strategy
