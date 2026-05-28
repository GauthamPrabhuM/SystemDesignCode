# Editorial — Parking Lot System

## Domain model

```
ParkingLot
├── floors: int
├── spots: bool[]          # True = free (flat array: floor*spotsPerFloor + spot)
├── tickets: Map<id, Ticket>
└── pricing: PricingStrategy

Ticket
├── id: str                # "T-1", "T-2", ...
├── vehicle: Vehicle
├── spot_id: int
└── entry_ts: int

PricingStrategy (interface)
└── calculate(ticket, exit_ts) → int
    └── HourlyPricing: ceil((exit_ts - entry_ts) / 3600) × rate[vehicle.type]
```

---

## Key design decisions

### 1. Flat array for spots

```python
# floors=3, spots_per_floor=10 → 30 bool slots
spots = [True] * (floors * spots_per_floor)

def park():
    for i, free in enumerate(spots):
        if free:
            spots[i] = False
            ...
```

Simpler than a 2D array. The spot ID encodes floor + position implicitly (`id // 10 = floor, id % 10 = position`). Extend later if you need floor-aware routing.

### 2. Strategy pattern for pricing

```python
class PricingStrategy(Protocol):
    def calculate(self, ticket: Ticket, exit_ts: int) -> int: ...

class HourlyPricing:
    RATES = {"car": 50, "motorcycle": 20, "truck": 100, "ev": 30}
    def calculate(self, ticket, exit_ts):
        hours = max(1, ceil((exit_ts - ticket.entry_ts) / 3600))
        return hours * self.RATES.get(ticket.vehicle.type, 50)
```

Adding weekend surcharges or dynamic pricing = new class, no changes to ParkingLotService.

### 3. Thread safety

```python
def park(self, vehicle, ts):
    with self._lock:
        spot = next free spot
        create ticket
        self._tickets[ticket.id] = ticket
        return ticket

def unpark(self, ticket_id, ts):
    with self._lock:
        ticket = self._tickets.pop(ticket_id)
        self._spots[ticket.spot_id] = True
    # billing outside the lock (pure computation, no shared state)
    return self._pricing.calculate(ticket, ts)
```

---

## Complexity

| Operation | Time | Space |
|-----------|------|-------|
| park() | O(spots) worst case | O(1) |
| unpark() | O(1) | O(1) |

For a real system: add a free-spot min-heap or linked-list to make `park()` O(log n). At Uber scale, you'd also partition by floor and vehicle type.

---

## Extending the design

- **EV charging spots**: subtype `EVSpot extends Spot` with a charger field; EV pricing adds charging fee.
- **Reserved spots**: priority queue or separate reserved list.
- **Multi-level reporting**: `report_by_floor()` traverses `spots[floor*n : (floor+1)*n]`.
- **Real-time availability API**: publish spot events to a message queue; downstream services subscribe.
