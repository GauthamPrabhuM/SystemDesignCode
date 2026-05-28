import * as fs from "fs";

class SlidingWindowLimiter {
  private rate: number;
  private windowMs: number;
  private windows = new Map<string, number[]>();

  constructor(rate: number, windowMs: number) {
    this.rate = rate;
    this.windowMs = windowMs;
  }

  private evict(userId: string, cutoff: number): void {
    const dq = this.windows.get(userId) ?? [];
    const i = dq.findIndex(t => t > cutoff);
    this.windows.set(userId, i === -1 ? [] : dq.slice(i));
  }

  allow(userId: string, nowMs: number): boolean {
    this.evict(userId, nowMs - this.windowMs);
    const dq = this.windows.get(userId) ?? [];
    if (dq.length < this.rate) {
      dq.push(nowMs);
      this.windows.set(userId, dq);
      return true;
    }
    return false;
  }

  usage(userId: string, nowMs: number): number {
    this.evict(userId, nowMs - this.windowMs);
    return (this.windows.get(userId) ?? []).length;
  }
}

const input: { commands: Array<Record<string, unknown>> } = JSON.parse(
  fs.readFileSync("/dev/stdin", "utf8")
);

let limiter: SlidingWindowLimiter | null = null;
const responses: unknown[] = [];

for (const cmd of input.commands) {
  const op = cmd.op as string;
  switch (op) {
    case "init":
      limiter = new SlidingWindowLimiter(cmd.rate as number, cmd.window_ms as number);
      responses.push({ ok: true });
      break;
    case "allow":
      responses.push({ allowed: limiter!.allow(cmd.user_id as string, cmd.now_ms as number) });
      break;
    case "usage":
      responses.push({ count: limiter!.usage(cmd.user_id as string, cmd.now_ms as number) });
      break;
    default:
      responses.push({ error: `unknown op: ${op}` });
  }
}

console.log(JSON.stringify({ responses }));
