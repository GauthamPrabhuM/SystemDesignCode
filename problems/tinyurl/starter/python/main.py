"""URL Shortener (TinyURL) — starter solution.

stdin:  {"commands": [{"op": "shorten", "url": "https://...", "alias": "opt"}, ...]}
stdout: {"responses": [{"code": "abc123"}, ...]}
"""
from __future__ import annotations
import json, random, string, sys


class URLShortener:
    CODE_LEN = 6
    ALPHABET = string.ascii_letters + string.digits

    def __init__(self) -> None:
        self._codes: dict[str, str] = {}   # code → url
        self._clicks: dict[str, int] = {}  # code → click count

    def _generate(self) -> str:
        for _ in range(100):
            code = "".join(random.choices(self.ALPHABET, k=self.CODE_LEN))
            if code not in self._codes:
                return code
        raise RuntimeError("could not generate unique code")

    def shorten(self, url: str, alias: str | None = None) -> dict:
        code = alias if alias else self._generate()
        if code in self._codes:
            return {"error": "alias taken"}
        self._codes[code] = url
        self._clicks[code] = 0
        return {"code": code}

    def expand(self, code: str) -> dict:
        url = self._codes.get(code)
        if url:
            self._clicks[code] += 1
        return {"url": url}

    def stats(self, code: str) -> dict:
        return {"clicks": self._clicks.get(code, 0)}

    def delete(self, code: str) -> dict:
        if code not in self._codes:
            return {"deleted": False}
        del self._codes[code]
        del self._clicks[code]
        return {"deleted": True}


def main() -> None:
    data = json.load(sys.stdin)
    svc = URLShortener()
    responses = []

    for cmd in data["commands"]:
        op = cmd["op"]
        if op == "shorten":
            responses.append(svc.shorten(cmd["url"], cmd.get("alias")))
        elif op == "expand":
            responses.append(svc.expand(cmd["code"]))
        elif op == "stats":
            responses.append(svc.stats(cmd["code"]))
        elif op == "delete":
            responses.append(svc.delete(cmd["code"]))
        else:
            responses.append({"error": f"unknown op: {op}"})

    print(json.dumps({"responses": responses}))


if __name__ == "__main__":
    main()
