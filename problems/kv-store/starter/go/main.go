package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
)

type entry struct {
	value  interface{}
	expiry int64 // 0 = no TTL
}

type KVStore struct {
	data map[string]*entry
}

func NewStore() *KVStore { return &KVStore{data: make(map[string]*entry)} }

func (s *KVStore) alive(key string, nowMs int64) bool {
	e, ok := s.data[key]
	if !ok { return false }
	return e.expiry == 0 || nowMs < e.expiry
}

func (s *KVStore) set(key string, value interface{}, ttlMs int64, nowMs int64) map[string]interface{} {
	e := &entry{value: value}
	if ttlMs > 0 { e.expiry = nowMs + ttlMs }
	s.data[key] = e
	return map[string]interface{}{"ok": true}
}

func (s *KVStore) get(key string, nowMs int64) map[string]interface{} {
	if !s.alive(key, nowMs) { return map[string]interface{}{"value": nil} }
	return map[string]interface{}{"value": s.data[key].value}
}

func (s *KVStore) del(key string) map[string]interface{} {
	if _, ok := s.data[key]; !ok { return map[string]interface{}{"deleted": false} }
	delete(s.data, key)
	return map[string]interface{}{"deleted": true}
}

func (s *KVStore) exists(key string, nowMs int64) map[string]interface{} {
	return map[string]interface{}{"exists": s.alive(key, nowMs)}
}

func (s *KVStore) ttl(key string, nowMs int64) map[string]interface{} {
	if !s.alive(key, nowMs) { return map[string]interface{}{"ttl_ms": -2} }
	if s.data[key].expiry == 0 { return map[string]interface{}{"ttl_ms": -1} }
	return map[string]interface{}{"ttl_ms": s.data[key].expiry - nowMs}
}

func (s *KVStore) keys(nowMs int64) map[string]interface{} {
	var live []string
	for k := range s.data {
		if s.alive(k, nowMs) { live = append(live, k) }
	}
	sort.Strings(live)
	if live == nil { live = []string{} }
	return map[string]interface{}{"keys": live}
}

func (s *KVStore) flush() map[string]interface{} {
	s.data = make(map[string]*entry)
	return map[string]interface{}{"ok": true}
}

func main() {
	var input struct {
		Commands []map[string]interface{} `json:"commands"`
	}
	json.NewDecoder(os.Stdin).Decode(&input)
	store := NewStore()
	responses := make([]map[string]interface{}, 0)

	for _, cmd := range input.Commands {
		op := cmd["op"].(string)
		var nowMs int64
		if v, ok := cmd["now_ms"]; ok { nowMs = int64(v.(float64)) }
		var ttlMs int64
		if v, ok := cmd["ttl_ms"]; ok && v != nil { ttlMs = int64(v.(float64)) }

		switch op {
		case "set":    responses = append(responses, store.set(cmd["key"].(string), cmd["value"], ttlMs, nowMs))
		case "get":    responses = append(responses, store.get(cmd["key"].(string), nowMs))
		case "delete": responses = append(responses, store.del(cmd["key"].(string)))
		case "exists": responses = append(responses, store.exists(cmd["key"].(string), nowMs))
		case "ttl":    responses = append(responses, store.ttl(cmd["key"].(string), nowMs))
		case "keys":   responses = append(responses, store.keys(nowMs))
		case "flush":  responses = append(responses, store.flush())
		default:       responses = append(responses, map[string]interface{}{"error": "unknown op: " + op})
		}
	}

	out, _ := json.Marshal(map[string]interface{}{"responses": responses})
	fmt.Println(string(out))
}
