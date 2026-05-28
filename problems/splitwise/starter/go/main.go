package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sort"
)

type ExpenseSplitter struct {
	members map[string]bool
	net     map[string]map[string]int // net[a][b] > 0 means b owes a
}

func NewSplitter() *ExpenseSplitter {
	return &ExpenseSplitter{
		members: make(map[string]bool),
		net:     make(map[string]map[string]int),
	}
}

func (s *ExpenseSplitter) adjust(creditor, debtor string, amount int) {
	if creditor == debtor || amount == 0 {
		return
	}
	if s.net[creditor] == nil {
		s.net[creditor] = make(map[string]int)
	}
	if s.net[debtor] == nil {
		s.net[debtor] = make(map[string]int)
	}
	s.net[creditor][debtor] += amount
	s.net[debtor][creditor] -= amount
}

func (s *ExpenseSplitter) balance(member string) int {
	total := 0
	for _, v := range s.net[member] {
		total += v
	}
	return total
}

func (s *ExpenseSplitter) simplify() []map[string]interface{} {
	type entry struct{ amount int; name string }
	var creditors, debtors []entry
	for m := range s.members {
		b := s.balance(m)
		if b > 0 {
			creditors = append(creditors, entry{b, m})
		} else if b < 0 {
			debtors = append(debtors, entry{-b, m})
		}
	}
	sort.Slice(creditors, func(i, j int) bool { return creditors[i].amount > creditors[j].amount })
	sort.Slice(debtors,   func(i, j int) bool { return debtors[i].amount   > debtors[j].amount })

	var txns []map[string]interface{}
	i, j := 0, 0
	for i < len(creditors) && j < len(debtors) {
		transfer := int(math.Min(float64(creditors[i].amount), float64(debtors[j].amount)))
		txns = append(txns, map[string]interface{}{
			"from": debtors[j].name, "to": creditors[i].name, "amount": transfer,
		})
		creditors[i].amount -= transfer
		debtors[j].amount -= transfer
		if creditors[i].amount == 0 { i++ }
		if debtors[j].amount == 0   { j++ }
	}
	if txns == nil {
		txns = []map[string]interface{}{}
	}
	return txns
}

func main() {
	var input struct {
		Commands []map[string]interface{} `json:"commands"`
	}
	json.NewDecoder(os.Stdin).Decode(&input)

	s := NewSplitter()
	responses := make([]map[string]interface{}, 0)

	for _, cmd := range input.Commands {
		op := cmd["op"].(string)
		switch op {
		case "add_member":
			s.members[cmd["name"].(string)] = true
			responses = append(responses, map[string]interface{}{"ok": true})

		case "add_expense":
			payer := cmd["payer"].(string)
			amount := int(cmd["amount"].(float64))
			rawList := cmd["split_among"].([]interface{})
			members := make([]string, len(rawList))
			for i, m := range rawList { members[i] = m.(string) }
			n := len(members)
			base, extra := amount/n, amount%n
			for i, m := range members {
				each := base; if i < extra { each++ }
				s.adjust(payer, m, each)
			}
			responses = append(responses, map[string]interface{}{"ok": true})

		case "add_expense_exact":
			payer := cmd["payer"].(string)
			shares := cmd["shares"].(map[string]interface{})
			for member, amt := range shares {
				s.adjust(payer, member, int(amt.(float64)))
			}
			responses = append(responses, map[string]interface{}{"ok": true})

		case "settle":
			from := cmd["from_member"].(string)
			to := cmd["to_member"].(string)
			amt := int(cmd["amount"].(float64))
			s.adjust(to, from, amt)
			responses = append(responses, map[string]interface{}{"ok": true})

		case "balance":
			responses = append(responses, map[string]interface{}{"balance": s.balance(cmd["member"].(string))})

		case "balances":
			bals := make(map[string]int)
			for m := range s.members { bals[m] = s.balance(m) }
			responses = append(responses, map[string]interface{}{"balances": bals})

		case "simplify":
			responses = append(responses, map[string]interface{}{"transactions": s.simplify()})

		default:
			responses = append(responses, map[string]interface{}{"error": "unknown op: " + op})
		}
	}

	out, _ := json.Marshal(map[string]interface{}{"responses": responses})
	fmt.Println(string(out))
}
