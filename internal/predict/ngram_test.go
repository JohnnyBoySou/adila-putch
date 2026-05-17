package predict

import (
	"strings"
	"testing"
	"time"
)

// splitURL tokeniza scheme://host + segmentos de path, descartando query e
// fragment (escopo do modelo é só o path).
func TestSplitURLDropsQueryAndFragment(t *testing.T) {
	got, ok := splitURL("https://h.com/a/b?token=secret#frag")
	if !ok {
		t.Fatal("esperava ok")
	}
	want := []string{"https://h.com", "a", "b"}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("esperava %v, veio %v", want, got)
	}
	if _, ok := splitURL("ht"); ok {
		t.Fatal("sem scheme://host não tokeniza")
	}
}

// Próximo segmento previsto e rankeado por frequência.
func TestNgramNextSegmentByFreq(t *testing.T) {
	m := newNgramModel()
	m.observe("https://api.x.com/v1/users")
	m.observe("https://api.x.com/v1/users")
	m.observe("https://api.x.com/v1/orders")
	preds := m.predict([]string{"https://api.x.com", "v1"}, "")
	if len(preds) == 0 {
		t.Fatal("esperava previsões")
	}
	top, score := "", -1.0
	for _, p := range preds {
		if p.score > score {
			top, score = p.seg, p.score
		}
	}
	if top != "users" {
		t.Fatalf("users (2) deveria superar orders (1): %v", preds)
	}
}

// Backoff: host nunca visto → recua p/ contexto mais curto ("v1") e ainda
// prevê. É o ganho sobre o urlProvider (que só completa URL verbatim).
func TestNgramBackoffCrossHost(t *testing.T) {
	m := newNgramModel()
	for range 3 {
		m.observe("https://api.x.com/v1/users")
	}
	preds := m.predict([]string{"https://api.z.com", "v1"}, "")
	if len(preds) != 1 || preds[0].seg != "users" {
		t.Fatalf("backoff via 'v1' deveria prever 'users': %v", preds)
	}
}

// O parcial filtra as continuações por prefixo (case-insensitive).
func TestNgramPartialFilter(t *testing.T) {
	m := newNgramModel()
	m.observe("https://api.x.com/v1/users")
	m.observe("https://api.x.com/v1/orders")
	preds := m.predict([]string{"https://api.x.com", "v1"}, "us")
	if len(preds) != 1 || preds[0].seg != "users" {
		t.Fatalf("parcial 'us' deveria casar só 'users': %v", preds)
	}
}

// Invariante: a query string nunca vira segmento — nada de "secret" no modelo,
// e o segmento aprendido é só o path ("p").
func TestNgramNeverLearnsQuery(t *testing.T) {
	m := newNgramModel()
	m.observe("https://h.com/p?token=supersecret")
	preds := m.predict([]string{"https://h.com"}, "")
	if len(preds) != 1 || preds[0].seg != "p" {
		t.Fatalf("esperava só o segmento de path 'p': %v", preds)
	}
	for _, p := range preds {
		if strings.Contains(p.seg, "secret") || strings.Contains(p.seg, "token") {
			t.Fatalf("VAZOU query no n-gram: %q", p.seg)
		}
	}
	// "p" não tem filhos (a query não criou um próximo segmento).
	if g := m.predict([]string{"https://h.com", "p"}, ""); len(g) != 0 {
		t.Fatalf("'p' não deveria ter continuação, veio %v", g)
	}
}

// splitPrefix não dispara quando não cabe ao n-gram de path.
func TestSplitPrefixGuards(t *testing.T) {
	cases := []string{
		"ht",                            // sem scheme
		"https://api.x.c",               // host ainda incompleto (sem "/")
		"https://api.x.com/v1/users?to", // editando a query
	}
	for _, c := range cases {
		if _, _, ok := splitPrefix(c); ok {
			t.Fatalf("splitPrefix(%q) deveria recusar", c)
		}
	}
	ctx, partial, ok := splitPrefix("https://h.com/v1/us")
	if !ok || partial != "us" || strings.Join(ctx, "|") != "https://h.com|v1" {
		t.Fatalf("parse inesperado: ctx=%v partial=%q ok=%v", ctx, partial, ok)
	}
}

// Integração: o provider generaliza onde o urlProvider não alcança (host
// novo), produzindo uma URL que nunca foi digitada inteira.
func TestNgramProviderGeneralizesViaEngine(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now, Record{URL: "https://api.x.com/v1/users", At: now})
	got := texts(e.Suggest(Request{
		Field: FieldURL, Prefix: "https://api.z.com/v1/", Limit: 8,
	}))
	found := false
	for _, s := range got {
		if s == "https://api.z.com/v1/users" {
			found = true
		}
	}
	if !found {
		t.Fatalf("n-gram deveria prever cross-host 'https://api.z.com/v1/users': %v", got)
	}
}
