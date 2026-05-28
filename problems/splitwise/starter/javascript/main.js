const fs = require('fs');

class ExpenseSplitter {
  constructor() {
    this.members = new Set();
    this.net = new Map(); // Map<string, Map<string, number>>
  }
  _adjust(creditor, debtor, amount) {
    if (creditor === debtor || amount === 0) return;
    if (!this.net.has(creditor)) this.net.set(creditor, new Map());
    if (!this.net.has(debtor))   this.net.set(debtor,   new Map());
    this.net.get(creditor).set(debtor,   (this.net.get(creditor).get(debtor)   ?? 0) + amount);
    this.net.get(debtor).set(creditor,   (this.net.get(debtor).get(creditor)   ?? 0) - amount);
  }
  _balance(m) { return [...(this.net.get(m)?.values() ?? [])].reduce((s, v) => s + v, 0); }
  addMember(name)                        { this.members.add(name); return { ok: true }; }
  addExpense(payer, amount, among) {
    const base = Math.floor(amount / among.length), extra = amount % among.length;
    among.forEach((m, i) => this._adjust(payer, m, base + (i < extra ? 1 : 0)));
    return { ok: true };
  }
  addExpenseExact(payer, shares) {
    Object.entries(shares).forEach(([m, a]) => this._adjust(payer, m, a)); return { ok: true };
  }
  settle(from, to, amount)               { this._adjust(to, from, amount); return { ok: true }; }
  balance(member)                        { return { balance: this._balance(member) }; }
  balances() {
    const b = {}; this.members.forEach(m => { b[m] = this._balance(m); }); return { balances: b };
  }
  simplify() {
    const bal = new Map([...this.members].map(m => [m, this._balance(m)]));
    const cred = [...bal.entries()].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const debt = [...bal.entries()].filter(([,v])=>v<0).sort((a,b)=>a[1]-b[1]);
    const txns = []; let i=0, j=0;
    while (i<cred.length && j<debt.length) {
      const t = Math.min(cred[i][1], -debt[j][1]);
      txns.push({ from: debt[j][0], to: cred[i][0], amount: t });
      cred[i][1] -= t; debt[j][1] += t;
      if (cred[i][1]===0) i++; if (debt[j][1]===0) j++;
    }
    return { transactions: txns };
  }
}

const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
const s = new ExpenseSplitter();
const responses = [];

for (const cmd of input.commands) {
  switch (cmd.op) {
    case 'add_member':        responses.push(s.addMember(cmd.name)); break;
    case 'add_expense':       responses.push(s.addExpense(cmd.payer, cmd.amount, cmd.split_among)); break;
    case 'add_expense_exact': responses.push(s.addExpenseExact(cmd.payer, cmd.shares)); break;
    case 'settle':            responses.push(s.settle(cmd.from_member, cmd.to_member, cmd.amount)); break;
    case 'balance':           responses.push(s.balance(cmd.member)); break;
    case 'balances':          responses.push(s.balances()); break;
    case 'simplify':          responses.push(s.simplify()); break;
    default:                  responses.push({ error: `unknown op: ${cmd.op}` });
  }
}

console.log(JSON.stringify({ responses }));
