"""Splitwise expense splitter — starter solution.

stdin:  {"commands": [{"op": "add_member", "name": "Alice"}, ...]}
stdout: {"responses": [{"ok": true}, ...]}
"""
from __future__ import annotations
import json, sys
from collections import defaultdict
from typing import Any


class ExpenseSplitter:
    def __init__(self) -> None:
        self._members: set[str] = set()
        # _net[a][b] > 0 means b owes a that amount
        self._net: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    def _adjust(self, creditor: str, debtor: str, amount: int) -> None:
        """Record that debtor owes creditor `amount` more."""
        if creditor == debtor or amount == 0:
            return
        self._net[creditor][debtor] += amount
        self._net[debtor][creditor] -= amount

    def add_member(self, name: str) -> dict:
        self._members.add(name)
        return {"ok": True}

    def add_expense(self, payer: str, amount: int, split_among: list[str]) -> dict:
        n = len(split_among)
        base = amount // n
        extra = amount % n
        # Distribute remainder (1 each) to first `extra` people who are not the payer,
        # otherwise just to the first `extra` members.
        for i, member in enumerate(split_among):
            each = base + (1 if i < extra else 0)
            self._adjust(payer, member, each)
        return {"ok": True}

    def add_expense_exact(self, payer: str, shares: dict[str, int]) -> dict:
        for member, amount in shares.items():
            self._adjust(payer, member, amount)
        return {"ok": True}

    def settle(self, from_member: str, to_member: str, amount: int) -> dict:
        self._adjust(to_member, from_member, amount)
        return {"ok": True}

    def balance(self, member: str) -> dict:
        return {"balance": sum(self._net[member].values())}

    def balances(self) -> dict:
        return {"balances": {m: sum(self._net[m].values()) for m in self._members}}

    def simplify(self) -> dict:
        """Greedy minimum-transactions settlement."""
        bal = {m: sum(self._net[m].values()) for m in self._members}
        creditors = sorted([(v, k) for k, v in bal.items() if v > 0], reverse=True)
        debtors   = sorted([(abs(v), k) for k, v in bal.items() if v < 0], reverse=True)
        txns = []
        i = j = 0
        while i < len(creditors) and j < len(debtors):
            c_amt, creditor = creditors[i]
            d_amt, debtor   = debtors[j]
            transfer = min(c_amt, d_amt)
            txns.append({"from": debtor, "to": creditor, "amount": transfer})
            creditors[i] = (c_amt - transfer, creditor)
            debtors[j]   = (d_amt - transfer, debtor)
            if creditors[i][0] == 0: i += 1
            if debtors[j][0] == 0:   j += 1
        return {"transactions": txns}


def main() -> None:
    data = json.load(sys.stdin)
    svc = ExpenseSplitter()
    responses: list[Any] = []

    for cmd in data["commands"]:
        op = cmd["op"]
        if op == "add_member":
            responses.append(svc.add_member(cmd["name"]))
        elif op == "add_expense":
            responses.append(svc.add_expense(cmd["payer"], cmd["amount"], cmd["split_among"]))
        elif op == "add_expense_exact":
            responses.append(svc.add_expense_exact(cmd["payer"], cmd["shares"]))
        elif op == "settle":
            responses.append(svc.settle(cmd["from_member"], cmd["to_member"], cmd["amount"]))
        elif op == "balance":
            responses.append(svc.balance(cmd["member"]))
        elif op == "balances":
            responses.append(svc.balances())
        elif op == "simplify":
            responses.append(svc.simplify())
        else:
            responses.append({"error": f"unknown op: {op}"})

    print(json.dumps({"responses": responses}))


if __name__ == "__main__":
    main()
