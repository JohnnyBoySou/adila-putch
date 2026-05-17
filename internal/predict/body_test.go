package predict

import (
	"strings"
	"testing"
	"time"
)

// jsonSkeleton zera escalares e ordena chaves (canônico determinístico).
func TestJSONSkeletonZeroesAndSorts(t *testing.T) {
	got, ok := jsonSkeleton(`{"name":"João","age":33,"active":true,"note":null}`)
	if !ok {
		t.Fatal("esperava JSON válido")
	}
	want := `{"active":false,"age":0,"name":"","note":null}`
	if got != want {
		t.Fatalf("esperava %s, veio %s", want, got)
	}
}

// Aninhado: objetos recursam, array não-vazio mantém o formato do 1º item.
func TestJSONSkeletonNested(t *testing.T) {
	got, ok := jsonSkeleton(`{"user":{"id":7,"tags":["a","b"]},"items":[]}`)
	if !ok {
		t.Fatal("esperava JSON válido")
	}
	want := `{"items":[],"user":{"id":0,"tags":[""]}}`
	if got != want {
		t.Fatalf("esperava %s, veio %s", want, got)
	}
}

// JSON inválido não é indexável (ok=false).
func TestJSONSkeletonInvalid(t *testing.T) {
	if _, ok := jsonSkeleton(`name=foo&x=1`); ok {
		t.Fatal("form-encoded não é JSON, ok deveria ser false")
	}
	if _, ok := jsonSkeleton(""); ok {
		t.Fatal("vazio não é JSON, ok deveria ser false")
	}
}

// Invariante de segurança: nenhum valor literal (token/PII) sobrevive à
// ingestão — nem no esqueleto nem na sugestão final do engine.
func TestBodySecretNeverLeaks(t *testing.T) {
	now := time.Now()
	secret := "sk-live-DEADBEEFsupersecret"
	e := newEngineWith(t, now, Record{
		BodyJSON: `{"token":"` + secret + `","email":"a@b.com"}`,
		Method:   "POST", At: now,
	})
	got := texts(e.Suggest(Request{Field: FieldBodyJSON, Prefix: "{", Method: "POST", Limit: 8}))
	if len(got) == 0 {
		t.Fatal("esperava o esqueleto sugerido")
	}
	for _, s := range got {
		if strings.Contains(s, secret) || strings.Contains(s, "a@b.com") {
			t.Fatalf("VAZOU valor literal na sugestão: %s", s)
		}
	}
	if got[0] != `{"email":"","token":""}` {
		t.Fatalf("esperava esqueleto zerado, veio %s", got[0])
	}
}

// O esqueleto é sugerido quando o digitado é prefixo dele.
func TestBodySuggestByPrefix(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now, Record{
		BodyJSON: `{"name":"x"}`, Method: "POST", At: now,
	})
	got := texts(e.Suggest(Request{Field: FieldBodyJSON, Prefix: `{"n`, Method: "POST", Limit: 8}))
	if len(got) != 1 || got[0] != `{"name":""}` {
		t.Fatalf("esperava [{\"name\":\"\"}], veio %v", got)
	}
	// Prefixo que não casa não sugere.
	if g := e.Suggest(Request{Field: FieldBodyJSON, Prefix: `{"z`, Method: "POST", Limit: 8}); len(g) != 0 {
		t.Fatalf("prefixo divergente não deveria sugerir, veio %v", texts(g))
	}
}

// Mesmo método HTTP recebe boost sobre um esqueleto mais frequente de outro
// método.
func TestBodyMethodBoost(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now,
		// PUT: 2 hits, mas método diferente da query.
		Record{BodyJSON: `{"a":1}`, Method: "PUT", At: now},
		Record{BodyJSON: `{"a":1}`, Method: "PUT", At: now},
		// POST: 1 hit, casa o método da query.
		Record{BodyJSON: `{"b":2}`, Method: "POST", At: now},
	)
	got := texts(e.Suggest(Request{Field: FieldBodyJSON, Prefix: "{", Method: "POST", Limit: 8}))
	if got[0] != `{"b":0}` {
		t.Fatalf("boost de método deveria levar o body do POST ao topo: %v", got)
	}
}

// Campo diferente de body, ou body não-JSON, não produz sugestão de body.
func TestBodyNonJSONAndNonBodyField(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now,
		Record{BodyJSON: `name=foo`, Method: "POST", At: now}, // não-JSON: não indexa
	)
	if g := e.Suggest(Request{Field: FieldBodyJSON, Prefix: "{", Method: "POST", Limit: 8}); len(g) != 0 {
		t.Fatalf("body não-JSON não deveria indexar, veio %v", texts(g))
	}
	e2 := newEngineWith(t, now, Record{BodyJSON: `{"a":1}`, Method: "POST", At: now})
	if g := e2.Suggest(Request{Field: FieldURL, Prefix: "{", Method: "POST", Limit: 8}); len(g) != 0 {
		t.Fatalf("bodyProvider não deveria responder a FieldURL, veio %v", texts(g))
	}
}
