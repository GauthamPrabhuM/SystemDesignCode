const fs = require("fs");

const RATES = { motorcycle: 20, car: 50, truck: 100, ev: 30 };

class ParkingLot {
  constructor(floors, spotsPerFloor) {
    this.spots = Array(floors * spotsPerFloor).fill(true);
    this.tickets = new Map();
    this.nextId = 0;
  }
  park(vehicle, ts) {
    const idx = this.spots.findIndex(Boolean);
    if (idx === -1) return null;
    this.spots[idx] = false;
    const ticket = { id: `T-${++this.nextId}`, vehicle, spotId: idx, entryTs: ts };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }
  unpark(ticketId, ts) {
    const t = this.tickets.get(ticketId);
    if (!t) return null;
    this.spots[t.spotId] = true;
    this.tickets.delete(ticketId);
    const hours = Math.max(1, Math.ceil((ts - t.entryTs) / 3600));
    return hours * (RATES[t.vehicle.type] ?? 50);
  }
  freeSpots() { return this.spots.filter(Boolean).length; }
}

const input = JSON.parse(fs.readFileSync("/dev/stdin", "utf8"));
const lot = new ParkingLot(3, 10);
const responses = [];

for (const cmd of input.commands) {
  switch (cmd.op) {
    case "park":   { const t = lot.park(cmd.vehicle, cmd.ts); responses.push({ ticket: t?.id ?? null }); break; }
    case "unpark": responses.push({ bill: lot.unpark(cmd.ticket, cmd.ts) }); break;
    case "free_spots": responses.push({ free: lot.freeSpots() }); break;
    default: responses.push({ error: `unknown op: ${cmd.op}` });
  }
}

console.log(JSON.stringify({ responses }));
