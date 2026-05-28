# Splitwise — Examples

## Example 1: Equal 3-way split

**Alice pays ₹300 for dinner, split equally among Alice, Bob, Carol**

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1–3 | `add_member` × 3 | ok × 3 | |
| 4 | `add_expense("Alice", 300, ["Alice","Bob","Carol"])` | ok | Each owes ₹100 |
| 5 | `balance("Alice")` | `200` | Paid 300, owes 100 herself → net +200 |
| 6 | `balance("Bob")` | `-100` | Owes Alice ₹100 |
| 7 | `balance("Carol")` | `-100` | Owes Alice ₹100 |

**Invariant:** All balances always sum to zero. 200 + (-100) + (-100) = 0 ✓

---

## Example 2: Settle a debt

**Continuing from Example 1 — Bob pays Alice back**

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 8 | `settle("Bob", "Alice", 100)` | ok | Bob → Alice |
| 9 | `balance("Bob")` | `0` | Debt cleared |
| 10 | `balance("Alice")` | `100` | Now only Carol owes her |

---

## Example 3: Exact split (unequal shares)

**Alice paid ₹200. Her share: ₹50, Bob: ₹120, Carol: ₹30**

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 4 | `add_expense_exact("Alice", {"Alice":50, "Bob":120, "Carol":30})` | ok | |
| 5 | `balance("Alice")` | `150` | Bob+Carol owe Alice 120+30=150 |
| 6 | `balance("Bob")` | `-120` | |
| 7 | `balance("Carol")` | `-30` | |

---

## Example 4: Simplify — minimum transactions

**Three people, tangled debts → simplify to fewest payments**

After several expenses:
- Alice owes Bob ₹50, Bob owes Carol ₹80, Carol owes Alice ₹30

`simplify()` → `[{from: "Alice", to: "Carol", amount: 50}]`

Instead of 3 transfers, 1 transfer settles everything. The greedy creditor-debtor algorithm finds this.
