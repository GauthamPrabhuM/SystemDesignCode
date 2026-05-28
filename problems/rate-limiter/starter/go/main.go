package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

type SlidingWindowLimiter struct {
	rate      int
	windowMs  int64
	mu        sync.Mutex
	windows   map[string][]int64
}

func NewLimiter(rate int, windowMs int64) *SlidingWindowLimiter {
	return &SlidingWindowLimiter{rate: rate, windowMs: windowMs, windows: make(map[string][]int64)}
}

func (l *SlidingWindowLimiter) evict(userID string, cutoff int64) {
	dq := l.windows[userID]
	i := 0
	for i < len(dq) && dq[i] <= cutoff {
		i++
	}
	l.windows[userID] = dq[i:]
}

func (l *SlidingWindowLimiter) Allow(userID string, nowMs int64) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.evict(userID, nowMs-l.windowMs)
	if len(l.windows[userID]) < l.rate {
		l.windows[userID] = append(l.windows[userID], nowMs)
		return true
	}
	return false
}

func (l *SlidingWindowLimiter) Usage(userID string, nowMs int64) int {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.evict(userID, nowMs-l.windowMs)
	return len(l.windows[userID])
}

func main() {
	var input struct {
		Commands []map[string]interface{} `json:"commands"`
	}
	json.NewDecoder(os.Stdin).Decode(&input)

	var limiter *SlidingWindowLimiter
	responses := make([]map[string]interface{}, 0)

	for _, cmd := range input.Commands {
		op := cmd["op"].(string)
		switch op {
		case "init":
			limiter = NewLimiter(int(cmd["rate"].(float64)), int64(cmd["window_ms"].(float64)))
			responses = append(responses, map[string]interface{}{"ok": true})
		case "allow":
			allowed := limiter.Allow(cmd["user_id"].(string), int64(cmd["now_ms"].(float64)))
			responses = append(responses, map[string]interface{}{"allowed": allowed})
		case "usage":
			count := limiter.Usage(cmd["user_id"].(string), int64(cmd["now_ms"].(float64)))
			responses = append(responses, map[string]interface{}{"count": count})
		default:
			responses = append(responses, map[string]interface{}{"error": "unknown op: " + op})
		}
	}

	out, _ := json.Marshal(map[string]interface{}{"responses": responses})
	fmt.Println(string(out))
}
