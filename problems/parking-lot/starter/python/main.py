"""Parking Lot — starter solution.

The runner sends one JSON object to stdin:
  {"commands": [{"op": "park", "vehicle": {...}, "ts": ...}, ...]}

Your program must write one JSON object to stdout:
  {"responses": [{"ticket": "T-1"}, ...]}

One response per command, in the same order.
"""
from __future__ import annotations

import json
import sys
import threading
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class Vehicle:
    license: str
    type: str  # motorcycle | car | truck | ev


@dataclass
class Ticket:
    id: str
    vehicle: Vehicle
    spot_id: int
    entry_ts: int


class PricingStrategy(Protocol):
    def calculate(self, ticket: Ticket, exit_ts: int) -> int: ...


class HourlyPricing:
    """₹50 / hour, billed per started hour."""
    RATES = {"motorcycle": 20, "car": 50, "truck": 100, "ev": 30}

    def calculate(self, ticket: Ticket, exit_ts: int) -> int:
        hours = max(1, -(-(exit_ts - ticket.entry_ts) // 3600))  # ceil div
        return hours * self.RATES.get(ticket.vehicle.type, 50)


class ParkingLotService:
    def __init__(self, floors: int, spots_per_floor: int, pricing: PricingStrategy) -> None:
        self._lock = threading.Lock()
        self._pricing = pricing
        self._spots = [True] * (floors * spots_per_floor)  # True = free
        self._tickets: dict[str, Ticket] = {}
        self._next_ticket = 0

    def park(self, vehicle: Vehicle, ts: int) -> Ticket | None:
        with self._lock:
            for i, free in enumerate(self._spots):
                if free:
                    self._spots[i] = False
                    self._next_ticket += 1
                    tk = Ticket(id=f"T-{self._next_ticket}", vehicle=vehicle, spot_id=i, entry_ts=ts)
                    self._tickets[tk.id] = tk
                    return tk
            return None

    def unpark(self, ticket_id: str, ts: int) -> int | None:
        with self._lock:
            tk = self._tickets.pop(ticket_id, None)
            if not tk:
                return None
            self._spots[tk.spot_id] = True
        return self._pricing.calculate(tk, ts)

    def free_spots(self, vehicle_type: str | None = None) -> int:
        return sum(1 for s in self._spots if s)


def main() -> None:
    data = json.load(sys.stdin)
    commands = data.get("commands", [])
    svc = ParkingLotService(floors=3, spots_per_floor=10, pricing=HourlyPricing())
    responses: list[Any] = []

    for cmd in commands:
        op = cmd["op"]
        if op == "park":
            tk = svc.park(Vehicle(**cmd["vehicle"]), cmd["ts"])
            responses.append({"ticket": tk.id if tk else None})
        elif op == "unpark":
            bill = svc.unpark(cmd["ticket"], cmd["ts"])
            responses.append({"bill": bill})
        elif op == "free_spots":
            responses.append({"free": svc.free_spots(cmd.get("vehicle_type"))})
        else:
            responses.append({"error": f"unknown op: {op}"})

    print(json.dumps({"responses": responses}))


if __name__ == "__main__":
    main()
