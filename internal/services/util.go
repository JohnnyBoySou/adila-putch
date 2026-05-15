package services

import "sort"

// paginate aplica page/limit (1-based) preservando o contrato dos bindings
// que antes vinha do LIMIT/OFFSET do SQLite.
func paginate[T any](items []T, page, limit int) []T {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	start := (page - 1) * limit
	if start >= len(items) {
		return []T{}
	}
	end := start + limit
	if end > len(items) {
		end = len(items)
	}
	return items[start:end]
}

// byCreatedDesc ordena por created_at decrescente (RFC3339 ordena
// lexicograficamente igual à ordem temporal), substituindo o ORDER BY.
func byCreatedDesc[T any](items []T, createdAt func(T) string) {
	sort.SliceStable(items, func(i, j int) bool {
		return createdAt(items[i]) > createdAt(items[j])
	})
}
