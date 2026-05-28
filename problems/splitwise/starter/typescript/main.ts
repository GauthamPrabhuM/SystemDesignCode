import * as fs from 'fs';

class ExpenseSplitter {
  private members = new Set<string>();
  private net = new Map<string, Map<string, number>>();

  private adjust(creditor: string, debtor: string, amount: number): void {
    if (creditor === debtor || amount === 0) return;
    if (!this.net.has(creditor)) this.net.set(creditor, new Map());
    if (!this.net.has(debtor))   this.net.set(debtor,   new Map());
    this.net.get(creditor)!.set(debtor,   (this.net.get(creditor)!.get(debtor)   ?? 0) + amount);
    this.net.get(debtor)!.set(creditor,   (this.net.get(debtor)!.get(creditor)   ?? 0) - amount);
  }

  addMember(name: string)                                    { this.members.add(name); return { ok: true }; }
  addExpense(payer: string, amount: number, among: string[]) {
    const base = Math.floor(amount / among.length);
    const extra = amount % among.length;
    among.forEach((m, i) => this.adjust(payer, m, base + (i < extra ? 1 : 0)));
    return { ok: true };
  }
  addExpenseExact(payer: string, shares: Record<string, number>) {
    Object.entries(shares).forEach(([m, a]) => this.adjust(payer, m, a));
    return { ok: true };
  }
  settle(from: string, to: string, amount: number) { this.adjust(to, from, amount); return { ok: true }; }
  balance(member: string) {
    return { balance: [...(this.net.get(member)?.values() ?? [])].reduce((s, v) => s + v, 0) };
  }
  balances() {
    const b: Record<string, number> = {};
    this.members.forEach(m => { b[m] = this.balance(m).balance; });
    return { balances: b };
  }
  simplify() {
    const bal = new Map<string, number>();
    this.members.forEach(m => bal.set(m, this.balance(m).balance));
    const creditors = [...bal.entries()].filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
    const debtors   = [...bal.entries()].filter(([,v]) => v < 0).sort((a,b) => a[1]-b[1]);
    const txns: {from:string;to:string;amount:number}[] = [];
    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const [cName, cAmt] = creditors[i];
      const [dName, dAmt] = debtors[j];
      const t = Math.min(cAmt, -dAmt);
      txns.push({ from: dName, to: cName, amount: t });
      creditors[i] = [cName, cAmt - t];
      debtors[j]   = [dName, dAmt + t];
      if (creditors[i][1] === 0) i++;
      if (debtors[j][1] === 0)   j++;
    }
    return { transactions: txns };
  }
}

const input: { commands: Array<Record<string, any>> } = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
const s = new ExpenseSplitter();
const responses: unknown[] = [];

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
