package main

import (
	"container/list"
	"encoding/json"
	"fmt"
	"os"
)

// --- Node ---
type entry struct {
	key   interface{}
	value interface{}
}

// --- LRUCache ---
type LRUCache struct {
	cap   int
	items map[interface{}]*list.Element
	order *list.List
}

func NewLRUCache(cap int) *LRUCache {
	return &LRUCache{cap: cap, items: make(map[interface{}]*list.Element), order: list.New()}
}

func (c *LRUCache) Get(key interface{}) interface{} {
	el, ok := c.items[key]
	if !ok {
		return nil
	}
	c.order.MoveToFront(el)
	return el.Value.(*entry).value
}

func (c *LRUCache) Put(key, value interface{}) {
	if el, ok := c.items[key]; ok {
		el.Value.(*entry).value = value
		c.order.MoveToFront(el)
		return
	}
	if c.order.Len() >= c.cap {
		back := c.order.Back()
		c.order.Remove(back)
		delete(c.items, back.Value.(*entry).key)
	}
	el := c.order.PushFront(&entry{key, value})
	c.items[key] = el
}

func (c *LRUCache) Delete(key interface{}) bool {
	el, ok := c.items[key]
	if !ok {
		return false
	}
	c.order.Remove(el)
	delete(c.items, key)
	return true
}

func (c *LRUCache) Size() int { return c.order.Len() }

// --- main ---
func main() {
	var input struct {
		Commands []map[string]interface{} `json:"commands"`
	}
	if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
		fmt.Fprintln(os.Stderr, "decode error:", err)
		os.Exit(1)
	}

	var cache *LRUCache
	responses := make([]map[string]interface{}, 0, len(input.Commands))

	for _, cmd := range input.Commands {
		op := cmd["op"].(string)
		switch op {
		case "init":
			cap := int(cmd["capacity"].(float64))
			cache = NewLRUCache(cap)
			responses = append(responses, map[string]interface{}{"ok": true})
		case "put":
			cache.Put(cmd["key"], cmd["value"])
			responses = append(responses, map[string]interface{}{"ok": true})
		case "get":
			responses = append(responses, map[string]interface{}{"value": cache.Get(cmd["key"])})
		case "delete":
			responses = append(responses, map[string]interface{}{"existed": cache.Delete(cmd["key"])})
		case "size":
			responses = append(responses, map[string]interface{}{"size": cache.Size()})
		default:
			responses = append(responses, map[string]interface{}{"error": "unknown op: " + op})
		}
	}

	out, _ := json.Marshal(map[string]interface{}{"responses": responses})
	fmt.Println(string(out))
}
