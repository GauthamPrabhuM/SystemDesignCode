# Parking Lot — Examples

## Example 1: Park and unpark with billing

**Lot: 3 floors × 10 spots = 30 spots. Hourly rate: car = ₹50/hr**

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `park({license: "KA-01", type: "car"}, ts=0)` | `{ticket: "T-1"}` | Spot 0 assigned |
| 2 | `free_spots()` | `{free: 29}` | 1 spot taken |
| 3 | `unpark("T-1", ts=3600)` | `{bill: 50}` | 1 hour × ₹50 = ₹50 |
| 4 | `free_spots()` | `{free: 30}` | Spot 0 freed |

---

## Example 2: Multiple vehicles, partial hour billing

**Rate: motorcycle = ₹20/hr, car = ₹50/hr (billed per started hour)**

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `park({type:"motorcycle"}, ts=0)` | `{ticket: "T-1"}` | |
| 2 | `park({type:"car"}, ts=0)` | `{ticket: "T-2"}` | |
| 3 | `unpark("T-1", ts=1800)` | `{bill: 20}` | 30 min → 1 started hr → ₹20 |
| 4 | `unpark("T-2", ts=7200)` | `{bill: 100}` | 2 hours × ₹50 = ₹100 |

---

## Example 3: Full lot

**Lot with only 2 spots**

| Step | Operation | Returns | Notes |
|------|-----------|---------|-------|
| 1 | `park({type:"car"}, ts=0)` | `{ticket: "T-1"}` | Spot 0 |
| 2 | `park({type:"car"}, ts=0)` | `{ticket: "T-2"}` | Spot 1 |
| 3 | `park({type:"car"}, ts=0)` | `{ticket: null}` | **Lot is full** |
| 4 | `unpark("T-1", ts=3600)` | `{bill: 50}` | Spot 0 freed |
| 5 | `park({type:"car"}, ts=3600)` | `{ticket: "T-3"}` | Spot 0 reused |
