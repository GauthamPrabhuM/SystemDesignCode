"""Starter template — Parking Lot.

Fill in the marked sections. Your program reads JSON commands from stdin
(one per line) and writes JSON responses to stdout (one per line).
"""
from __future__ import annotations

import json
import sys
import threading
from dataclasses import dataclass, field
from typing import Protocol


# --- Domain ---------------------------------------------------------------
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


# --- Pricing strategy -----------------------------------------------------
class PricingStrategy(Protocol):
    def calculate(self, ticket: Ticket, exit_ts: int) -> int: ...


class HourlyPricing:
    """₹50 / hour, billed per started hour."""
    RATES = {"motorcycle": 20, "car": 50, "truck": 100, "ev": 30}

    def calculate(self, ticket: Ticket, exit_ts: int) -> int:
        hours = max(1, -(-(exit_ts - ticket.entry_ts) // 3600))  # ceil div
        return hours * self.RATES.get(ticket.vehicle.type, 50)


# --- Service --------------------------------------------------------------
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


# --- IO loop --------------------------------------------------------------
def main() -> None:
    svc = ParkingLotService(floors=3, spots_per_floor=10, pricing=HourlyPricing())
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        cmd = json.loads(line)
        op = cmd["op"]
        if op == "park":
            tk = svc.park(Vehicle(**cmd["vehicle"]), cmd["ts"])
            print(json.dumps({"ticket": tk.id if tk else None}), flush=True)
        elif op == "unpark":
            bill = svc.unpark(cmd["ticket"], cmd["ts"])
            print(json.dumps({"bill": bill}), flush=True)
        elif op == "free_spots":
            print(json.dumps({"free": svc.free_spots(cmd.get("vehicle_type"))}), flush=True)
        else:
            print(json.dumps({"error": f"unknown op: {op}"}), flush=True)


if __name__ == "__main__":
    main()
