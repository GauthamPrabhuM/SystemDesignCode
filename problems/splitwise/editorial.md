# Editorial — Splitwise

## Core data model

Don't store a list of expenses and recompute. Maintain a **net balance graph**:

```python
net: dict[str, dict[str, int]]
# net[a][b] > 0 → b owes a that amount
# net[a][b] and net[b][a] always sum to zero
```

```python
def _adjust(self, creditor, debtor, amount):
    if creditor == debtor or amount == 0:
        return
    self.net[creditor][debtor] += amount
    self.net[debtor][creditor] -= amount
```

Balance of a member = `sum(net[member].values())`.

---

## Add expense (equal split)

```python
def add_expense(self, payer, amount, split_among):
    n = len(split_among)
    base = amount // n
    extra = amount % n
    for i, member in enumerate(split_among):
        each = base + (1 if i < extra else 0)
        self._adjust(payer, member, each)
```

When `member == payer`, `_adjust` returns early (no self-debt). Payer's net balance ends up as `amount - their_share = sum owed by others`.

---

## Simplify debts (minimum transactions)

```python
def simplify(self):
    # Net balance per person
    bal = {m: sum(net[m].values()) for m in members}

    creditors = sorted([(v, k) for k, v in bal.items() if v > 0], reverse=True)
    debtors   = sorted([(abs(v), k) for k, v in bal.items() if v < 0], reverse=True)

    txns = []
    i = j = 0
    while i < len(creditors) and j < len(debtors):
        c_amt, c_name = creditors[i]
        d_amt, d_name = debtors[j]
        transfer = min(c_amt, d_amt)
        txns.append({"from": d_name, "to": c_name, "amount": transfer})
        creditors[i] = (c_amt - transfer, c_name)
        debtors[j]   = (d_amt - transfer, d_name)
        if creditors[i][0] == 0: i += 1
        if debtors[j][0] == 0:   j += 1

    return txns
```

**Why it's optimal**: Each iteration eliminates at least one person from the list. With N people, at most N-1 transactions suffice.

---

## Invariants to maintain

- All balances sum to zero at all times.
- `net[a][b] + net[b][a] == 0` always.
- `net[a][a]` is never set (no self-debt).

---

## Complexity

| Operation | Time |
|-----------|------|
| add_expense() | O(n) where n = split_among.length |
| add_expense_exact() | O(n) |
| settle() | O(1) |
| balance() | O(members) |
| simplify() | O(m log m) where m = members |

---

## Extending

- **Multi-currency**: store amounts with currency tag; apply exchange rate on balance().
- **Groups**: namespace the net graph by group_id.
- **Recurring expenses**: schedule add_expense() on a cron; no model changes.
- **Notifications**: after add_expense(), emit events to affected members (Observer pattern).
