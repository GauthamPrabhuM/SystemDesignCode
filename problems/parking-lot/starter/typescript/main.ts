import * as fs from "fs";

interface Vehicle { license: string; type: string; }
interface Ticket  { id: string; vehicle: Vehicle; spotId: number; entryTs: number; }

const RATES: Record<string, number> = { motorcycle: 20, car: 50, truck: 100, ev: 30 };

class ParkingLot {
  private spots: boolean[];
  private tickets = new Map<string, Ticket>();
  private nextId = 0;

  constructor(floors: number, spotsPerFloor: number) {
    this.spots = Array(floors * spotsPerFloor).fill(true);
  }

  park(vehicle: Vehicle, ts: number): Ticket | null {
    const idx = this.spots.findIndex(Boolean);
    if (idx === -1) return null;
    this.spots[idx] = false;
    this.nextId++;
    const ticket: Ticket = { id: `T-${this.nextId}`, vehicle, spotId: idx, entryTs: ts };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  unpark(ticketId: string, ts: number): number | null {
    const t = this.tickets.get(ticketId);
    if (!t) return null;
    this.spots[t.spotId] = true;
    this.tickets.delete(ticketId);
    const hours = Math.max(1, Math.ceil((ts - t.entryTs) / 3600));
    return hours * (RATES[t.vehicle.type] ?? 50);
  }

  freeSpots(): number {
    return this.spots.filter(Boolean).length;
  }
}

const input: { commands: Array<Record<string, unknown>> } = JSON.parse(
  fs.readFileSync("/dev/stdin", "utf8")
);

const lot = new ParkingLot(3, 10);
const responses: unknown[] = [];

for (const cmd of input.commands) {
  const op = cmd.op as string;
  switch (op) {
    case "park": {
      const vm = cmd.vehicle as Vehicle;
      const t = lot.park(vm, cmd.ts as number);
      responses.push({ ticket: t?.id ?? null });
      break;
    }
    case "unpark": {
      const bill = lot.unpark(cmd.ticket as string, cmd.ts as number);
      responses.push({ bill });
      break;
    }
    case "free_spots":
      responses.push({ free: lot.freeSpots() });
      break;
    default:
      responses.push({ error: `unknown op: ${op}` });
  }
}

console.log(JSON.stringify({ responses }));
