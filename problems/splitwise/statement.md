# Design Splitwise

## Problem

Build a simplified expense-splitting service. Friends add shared expenses and the system tracks who owes whom.

## Requirements

- **`add_member(name)`** — register a member. Returns `{"ok": true}`.
- **`add_expense(payer, amount, split_among, description?)`** — payer paid `amount`, split equally among `split_among` (list of names including payer). Returns `{"ok": true}`.
- **`add_expense_exact(payer, shares, description?)`** — split with exact amounts. `shares` is `{name: amount}`. Must sum to payer's outlay. Returns `{"ok": true}`.
- **`settle(from_member, to_member, amount)`** — `from_member` pays `to_member`. Returns `{"ok": true}`.
- **`balance(member)`** — returns net balance (positive = owed money, negative = owes money).
- **`balances()`** — returns `{name: balance}` for all members.
- **`simplify()`** — returns minimum list of transactions to settle all debts: `[{"from": A, "to": B, "amount": X}, ...]`.

## IO format

```json
{"commands": [{"op": "add_member", "name": "Alice"}, ...]}
{"responses": [{"ok": true}, ...]}
```

## Example

```
add_member("Alice"), add_member("Bob"), add_member("Carol")

# Alice pays ₹300 for dinner, split equally 3 ways
add_expense("Alice", 300, ["Alice", "Bob", "Carol"], "dinner")

balance("Alice")  → +200   (paid 300, owes 100 herself → net +200)
balance("Bob")    → -100
balance("Carol")  → -100

settle("Bob", "Alice", 100)

balance("Bob")    → 0
balance("Alice")  → +100
```

## Constraints

- Amounts are integers (paise/cents)
- Equal split rounds down; any remainder goes to the payer
- Members must exist before they appear in an expense
- `settle` creates a direct payment (doesn't need to be a "real" debt)

## What interviewers look for

- **Data model**: represent balances as a graph (directed edges = debts) vs flat ledger
- **Simplify algorithm**: greedy creditor-debtor matching, correct and O(n log n)
- **Rounding**: explain your rounding strategy for non-divisible amounts
- **Extensibility**: how to add group management, recurring expenses, multi-currency
