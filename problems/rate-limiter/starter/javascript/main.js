const fs = require('fs');

class SlidingWindowLimiter {
  constructor(rate, windowMs) {
    this.rate = rate;
    this.windowMs = windowMs;
    this.windows = new Map(); // userId → number[]
  }

  _evict(userId, cutoff) {
    const dq = this.windows.get(userId) ?? [];
    const i = dq.findIndex(t => t > cutoff);
    this.windows.set(userId, i === -1 ? [] : dq.slice(i));
  }

  allow(userId, nowMs) {
    this._evict(userId, nowMs - this.windowMs);
    const dq = this.windows.get(userId) ?? [];
    if (dq.length < this.rate) {
      dq.push(nowMs);
      this.windows.set(userId, dq);
      return true;
    }
    return false;
  }

  usage(userId, nowMs) {
    this._evict(userId, nowMs - this.windowMs);
    return (this.windows.get(userId) ?? []).length;
  }
}

const input = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
let limiter = null;
const responses = [];

for (const cmd of input.commands) {
  switch (cmd.op) {
    case 'init':
      limiter = new SlidingWindowLimiter(cmd.rate, cmd.window_ms);
      responses.push({ ok: true });
      break;
    case 'allow':
      responses.push({ allowed: limiter.allow(cmd.user_id, cmd.now_ms) });
      break;
    case 'usage':
      responses.push({ count: limiter.usage(cmd.user_id, cmd.now_ms) });
      break;
    default:
      responses.push({ error: `unknown op: ${cmd.op}` });
  }
}

console.log(JSON.stringify({ responses }));
