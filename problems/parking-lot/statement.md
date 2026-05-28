# Parking Lot System

Design a parking lot service that supports multiple floors, vehicle types, and pricing strategies. Implement a working `ParkingLotService` your tests can exercise.

## Functional requirements

- Park a vehicle, returning a ticket id.
- Unpark by ticket id, returning the bill in paise / cents.
- Query free spots by floor and by vehicle type.
- Support **hourly**, **day-pass**, and **monthly-pass** pricing.
- At least two pricing strategies must be swappable at runtime via dependency injection.

## Non-functional requirements

- Concurrent parking attempts must be safe: assume 100 threads attempt to park simultaneously.
- Adding a new vehicle type (e.g. `BICYCLE`) should require modifying only one file.

## Interface

The starter template gives you a `ParkingLotService` skeleton. Tests communicate with your service by sending JSON commands on stdin:

```json
{ "op": "park", "vehicle": { "license": "KA-01-1234", "type": "car" }, "ts": 1700000000 }
{ "op": "unpark", "ticket": "T-1", "ts": 1700003600 }
{ "op": "free_spots", "vehicle_type": "car" }
```

Your program reads one JSON command per line and writes one JSON response per line to stdout.

## Scoring

- 65% from test pass rate.
- 35% from AI design review (SOLID, patterns, extensibility, concurrency).

You'll see the AI feedback in the **AI Review** tab after submission.

## Hints

1. Start with a clean `Spot`, `Vehicle`, `Ticket` model. Don't conflate billing with parking.
2. Pricing belongs behind an interface — that's the rubric's main signal.
3. The "100 threads parking" requirement is *real*: a shared dict without a lock will fail the concurrency test.
