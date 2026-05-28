package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
)

const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

type URLShortener struct {
	codes  map[string]string // code → url
	clicks map[string]int
}

func NewShortener() *URLShortener {
	return &URLShortener{codes: make(map[string]string), clicks: make(map[string]int)}
}

func (u *URLShortener) generate() string {
	for range 100 {
		b := make([]byte, 6)
		for i := range b { b[i] = alphabet[rand.Intn(len(alphabet))] }
		code := string(b)
		if _, exists := u.codes[code]; !exists {
			return code
		}
	}
	return "______"
}

func (u *URLShortener) shorten(url string, alias string) map[string]interface{} {
	code := alias
	if code == "" { code = u.generate() }
	if _, exists := u.codes[code]; exists {
		return map[string]interface{}{"error": "alias taken"}
	}
	u.codes[code] = url
	u.clicks[code] = 0
	return map[string]interface{}{"code": code}
}

func (u *URLShortener) expand(code string) map[string]interface{} {
	url, ok := u.codes[code]
	if !ok { return map[string]interface{}{"url": nil} }
	u.clicks[code]++
	return map[string]interface{}{"url": url}
}

func (u *URLShortener) stats(code string) map[string]interface{} {
	return map[string]interface{}{"clicks": u.clicks[code]}
}

func (u *URLShortener) delete(code string) map[string]interface{} {
	if _, ok := u.codes[code]; !ok {
		return map[string]interface{}{"deleted": false}
	}
	delete(u.codes, code)
	delete(u.clicks, code)
	return map[string]interface{}{"deleted": true}
}

func main() {
	var input struct {
		Commands []map[string]interface{} `json:"commands"`
	}
	json.NewDecoder(os.Stdin).Decode(&input)
	svc := NewShortener()
	responses := make([]map[string]interface{}, 0)

	for _, cmd := range input.Commands {
		op := cmd["op"].(string)
		alias := ""
		if a, ok := cmd["alias"]; ok && a != nil { alias = a.(string) }
		switch op {
		case "shorten": responses = append(responses, svc.shorten(cmd["url"].(string), alias))
		case "expand":  responses = append(responses, svc.expand(cmd["code"].(string)))
		case "stats":   responses = append(responses, svc.stats(cmd["code"].(string)))
		case "delete":  responses = append(responses, svc.delete(cmd["code"].(string)))
		default:        responses = append(responses, map[string]interface{}{"error": "unknown op: " + op})
		}
	}

	out, _ := json.Marshal(map[string]interface{}{"responses": responses})
	fmt.Println(string(out))
}
