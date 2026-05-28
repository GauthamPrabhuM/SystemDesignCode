package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sync"
)

type Vehicle struct {
	License string `json:"license"`
	Type    string `json:"type"`
}

type Ticket struct {
	ID      string
	Vehicle Vehicle
	SpotID  int
	EntryTS int64
}

var rates = map[string]float64{"motorcycle": 20, "car": 50, "truck": 100, "ev": 30}

type ParkingLot struct {
	mu      sync.Mutex
	spots   []bool // true = free
	tickets map[string]*Ticket
	nextID  int
}

func NewParkingLot(floors, spotsPerFloor int) *ParkingLot {
	return &ParkingLot{
		spots:   make([]bool, floors*spotsPerFloor),
		tickets: make(map[string]*Ticket),
	}
}

func init() {
	// All spots free at start
}

func (pl *ParkingLot) Park(v Vehicle, ts int64) *Ticket {
	pl.mu.Lock()
	defer pl.mu.Unlock()
	for i, free := range pl.spots {
		if free {
			pl.spots[i] = false
			pl.nextID++
			t := &Ticket{ID: fmt.Sprintf("T-%d", pl.nextID), Vehicle: v, SpotID: i, EntryTS: ts}
			pl.tickets[t.ID] = t
			return t
		}
	}
	return nil
}

func (pl *ParkingLot) Unpark(ticketID string, ts int64) *int {
	pl.mu.Lock()
	defer pl.mu.Unlock()
	t, ok := pl.tickets[ticketID]
	if !ok {
		return nil
	}
	pl.spots[t.SpotID] = true
	delete(pl.tickets, ticketID)
	hours := math.Ceil(float64(ts-t.EntryTS) / 3600)
	if hours < 1 {
		hours = 1
	}
	rate := rates[t.Vehicle.Type]
	if rate == 0 {
		rate = 50
	}
	bill := int(hours * rate)
	return &bill
}

func (pl *ParkingLot) FreeSpots() int {
	pl.mu.Lock()
	defer pl.mu.Unlock()
	n := 0
	for _, free := range pl.spots {
		if free {
			n++
		}
	}
	return n
}

func main() {
	var input struct {
		Commands []map[string]interface{} `json:"commands"`
	}
	if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	pl := NewParkingLot(3, 10)
	for i := range pl.spots {
		pl.spots[i] = true
	}
	responses := make([]map[string]interface{}, 0)

	for _, cmd := range input.Commands {
		op := cmd["op"].(string)
		switch op {
		case "park":
			vm := cmd["vehicle"].(map[string]interface{})
			v := Vehicle{License: vm["license"].(string), Type: vm["type"].(string)}
			ts := int64(cmd["ts"].(float64))
			t := pl.Park(v, ts)
			if t != nil {
				responses = append(responses, map[string]interface{}{"ticket": t.ID})
			} else {
				responses = append(responses, map[string]interface{}{"ticket": nil})
			}
		case "unpark":
			ts := int64(cmd["ts"].(float64))
			bill := pl.Unpark(cmd["ticket"].(string), ts)
			if bill != nil {
				responses = append(responses, map[string]interface{}{"bill": *bill})
			} else {
				responses = append(responses, map[string]interface{}{"bill": nil})
			}
		case "free_spots":
			responses = append(responses, map[string]interface{}{"free": pl.FreeSpots()})
		default:
			responses = append(responses, map[string]interface{}{"error": "unknown op: " + op})
		}
	}

	out, _ := json.Marshal(map[string]interface{}{"responses": responses})
	fmt.Println(string(out))
}
