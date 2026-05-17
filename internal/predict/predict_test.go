package predict

import (
	"testing"
	"time"
)

func newEngineWith(t *testing.T, now time.Time, recs ...Record) *Engine {
	t.Helper()
	e := NewEngine()
	e.Rebuild(recs, now)
	return e
}

func texts(ss []Suggestion) []string {
	out := make([]string, len(ss))
	for i, s := range ss {
		out[i] = s.Text
	}
	return out
}

// Sem histórico, digitar "ht" sugere os schemes (cold start), https antes.
func TestSchemeColdStart(t *testing.T) {
	e := newEngineWith(t, time.Now())
	got := texts(e.Suggest(Request{Field: FieldURL, Prefix: "ht", Limit: 8}))
	if len(got) != 2 || got[0] != "https://" || got[1] != "http://" {
		t.Fatalf("esperava [https:// http://], veio %v", got)
	}
}

// Prefixo já igual ao scheme completo não sugere nada (nada a completar).
func TestNoSuggestionWhenComplete(t *testing.T) {
	e := newEngineWith(t, time.Now())
	if got := e.Suggest(Request{Field: FieldURL, Prefix: "https://", Limit: 8}); len(got) != 0 {
		t.Fatalf("esperava vazio, veio %v", texts(got))
	}
}

// Match de histórico é case-insensitive e supera o scheme.
func TestHistoryBeatsSchemeCaseInsensitive(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now,
		Record{URL: "https://api.exemplo.com/users", At: now},
	)
	got := texts(e.Suggest(Request{Field: FieldURL, Prefix: "HTTPS://API", Limit: 8}))
	if len(got) == 0 || got[0] != "https://api.exemplo.com/users" {
		t.Fatalf("histórico deveria vir primeiro, veio %v", got)
	}
}

// Mais frequente rankeia acima de menos frequente.
func TestFrecencyByCount(t *testing.T) {
	now := time.Now()
	recs := []Record{
		{URL: "https://a.com/x", At: now},
		{URL: "https://a.com/x", At: now},
		{URL: "https://a.com/y", At: now},
	}
	e := newEngineWith(t, now, recs...)
	got := texts(e.Suggest(Request{Field: FieldURL, Prefix: "https://a", Limit: 8}))
	if got[0] != "https://a.com/x" {
		t.Fatalf("x (2 hits) deveria vir antes de y (1 hit): %v", got)
	}
}

// Entre mesma frequência, a mais recente ganha (decay de recência).
func TestFrecencyByRecency(t *testing.T) {
	now := time.Now()
	recs := []Record{
		{URL: "https://a.com/old", At: now.Add(-90 * 24 * time.Hour)},
		{URL: "https://a.com/new", At: now.Add(-1 * time.Hour)},
	}
	e := newEngineWith(t, now, recs...)
	got := texts(e.Suggest(Request{Field: FieldURL, Prefix: "https://a", Limit: 8}))
	if got[0] != "https://a.com/new" {
		t.Fatalf("a mais recente deveria vir primeiro: %v", got)
	}
}

// URL usada na collection atual recebe boost.
func TestCollectionBoost(t *testing.T) {
	now := time.Now()
	recs := []Record{
		// "other" tem mais hits, mas fora da collection atual.
		{URL: "https://a.com/other", At: now, CollectionID: "c2"},
		{URL: "https://a.com/other", At: now, CollectionID: "c2"},
		{URL: "https://a.com/here", At: now, CollectionID: "c1"},
	}
	e := newEngineWith(t, now, recs...)
	got := texts(e.Suggest(Request{
		Field: FieldURL, Prefix: "https://a", CollectionID: "c1", Limit: 8,
	}))
	if got[0] != "https://a.com/here" {
		t.Fatalf("boost de collection deveria levar 'here' ao topo: %v", got)
	}
}

// merge deduplica por Text mantendo o maior score e respeita o limite.
func TestMergeDedupeAndLimit(t *testing.T) {
	in := []Suggestion{
		{Text: "a", Score: 1},
		{Text: "a", Score: 5},
		{Text: "b", Score: 3},
		{Text: "c", Score: 2},
	}
	out := merge(in, 2)
	if len(out) != 2 {
		t.Fatalf("limite=2, veio %d", len(out))
	}
	if out[0].Text != "a" || out[0].Score != 5 {
		t.Fatalf("esperava a/5 no topo (dedupe pelo maior), veio %+v", out[0])
	}
	if out[1].Text != "b" {
		t.Fatalf("esperava b em segundo, veio %s", out[1].Text)
	}
}

// Campo sem dado no índice e sem cold-start não produz sugestão. Query param
// não tem lista padrão (são específicos da API), então sem histórico = vazio —
// mesmo com histórico de URL no índice (providers não vazam entre campos).
func TestFieldWithoutDataEmpty(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now, Record{URL: "https://a.com/x", At: now})
	if got := e.Suggest(Request{Field: FieldParamKey, Prefix: "Con", Limit: 8}); len(got) != 0 {
		t.Fatalf("param sem histórico/cold-start deveria ser vazio, veio %v", texts(got))
	}
}
