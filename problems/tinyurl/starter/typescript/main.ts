import * as fs from 'fs';

const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

class URLShortener {
  private codes = new Map<string, string>();
  private clicks = new Map<string, number>();

  private generate(): string {
    for (let i = 0; i < 100; i++) {
      const code = Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
      if (!this.codes.has(code)) return code;
    }
    return '______';
  }

  shorten(url: string, alias?: string): Record<string, unknown> {
    const code = alias ?? this.generate();
    if (this.codes.has(code)) return { error: 'alias taken' };
    this.codes.set(code, url);
    this.clicks.set(code, 0);
    return { code };
  }
  expand(code: string): Record<string, unknown> {
    if (!this.codes.has(code)) return { url: null };
    this.clicks.set(code, (this.clicks.get(code) ?? 0) + 1);
    return { url: this.codes.get(code) };
  }
  stats(code: string): Record<string, unknown> { return { clicks: this.clicks.get(code) ?? 0 }; }
  delete(code: string): Record<string, unknown> {
    if (!this.codes.has(code)) return { deleted: false };
    this.codes.delete(code); this.clicks.delete(code);
    return { deleted: true };
  }
}

const input: { commands: Array<Record<string, any>> } = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
const svc = new URLShortener();
const responses: unknown[] = [];

for (const cmd of input.commands) {
  switch (cmd.op) {
    case 'shorten': responses.push(svc.shorten(cmd.url, cmd.alias)); break;
    case 'expand':  responses.push(svc.expand(cmd.code)); break;
    case 'stats':   responses.push(svc.stats(cmd.code)); break;
    case 'delete':  responses.push(svc.delete(cmd.code)); break;
    default:        responses.push({ error: `unknown op: ${cmd.op}` });
  }
}

console.log(JSON.stringify({ responses }));
