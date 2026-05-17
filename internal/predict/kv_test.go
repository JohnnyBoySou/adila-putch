package predict

import (
	"strings"
	"testing"
	"time"
)

// Header key do histórico sugerido por prefixo; canonicalizado (RFC).
func TestHeaderKeyFromHistoryCanonical(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now, Record{
		Headers: map[string]string{"x-tenant-id": "acme"}, At: now,
	})
	// Indexado como "X-Tenant-Id" (canônico); casa case-insensitive.
	got := texts(e.Suggest(Request{Field: FieldHeaderKey, Prefix: "x-ten", Limit: 8}))
	if len(got) == 0 || got[0] != "X-Tenant-Id" {
		t.Fatalf("esperava X-Tenant-Id canonicalizado, veio %v", got)
	}
}

// Invariante de segurança: valor de header (segredo) nunca vira sugestão.
func TestHeaderValueNeverLeaks(t *testing.T) {
	now := time.Now()
	secret := "Bearer sk-live-DEADBEEF"
	e := newEngineWith(t, now, Record{
		Headers: map[string]string{"Authorization": secret}, At: now,
	})
	got := texts(e.Suggest(Request{Field: FieldHeaderKey, Prefix: "Auth", Limit: 8}))
	if len(got) == 0 || got[0] != "Authorization" {
		t.Fatalf("esperava a CHAVE Authorization, veio %v", got)
	}
	for _, s := range got {
		if strings.Contains(s, secret) || strings.Contains(s, "sk-live") {
			t.Fatalf("VAZOU valor de header: %s", s)
		}
	}
}

// Param key é case-sensitive (não canonicaliza); sugerido por prefixo.
func TestParamKeyCaseSensitive(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now, Record{
		ParamKeys: []string{"pageSize"}, At: now,
	})
	got := texts(e.Suggest(Request{Field: FieldParamKey, Prefix: "page", Limit: 8}))
	if len(got) != 1 || got[0] != "pageSize" {
		t.Fatalf("esperava [pageSize] como digitado, veio %v", got)
	}
	// Header e param não se misturam.
	if g := e.Suggest(Request{Field: FieldHeaderKey, Prefix: "page", Limit: 8}); len(g) != 0 {
		t.Fatalf("param não deveria aparecer como header, veio %v", texts(g))
	}
}

// Sem histórico, prefixo de header padrão tem cold-start (commonHeaderProvider).
func TestCommonHeaderColdStart(t *testing.T) {
	e := newEngineWith(t, time.Now())
	got := texts(e.Suggest(Request{Field: FieldHeaderKey, Prefix: "Content-T", Limit: 8}))
	if len(got) != 1 || got[0] != "Content-Type" {
		t.Fatalf("esperava [Content-Type] no cold-start, veio %v", got)
	}
	// Query param não tem cold-start (são específicos da API).
	if g := e.Suggest(Request{Field: FieldParamKey, Prefix: "Content-T", Limit: 8}); len(g) != 0 {
		t.Fatalf("param não deveria ter cold-start, veio %v", texts(g))
	}
}

// Header do histórico supera o cold-start e não duplica (dedupe por Text
// canônico no merge): digitar "content" com histórico de "content-type".
func TestHistoryHeaderBeatsCommonAndDedupes(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now,
		Record{Headers: map[string]string{"content-type": "application/json"}, At: now},
		Record{Headers: map[string]string{"content-type": "application/json"}, At: now},
	)
	got := texts(e.Suggest(Request{Field: FieldHeaderKey, Prefix: "Content", Limit: 8}))
	if len(got) != 1 || got[0] != "Content-Type" {
		t.Fatalf("esperava só [Content-Type] (histórico, sem duplicar cold-start): %v", got)
	}
}

// Boost de collection também vale p/ chaves.
func TestKVCollectionBoost(t *testing.T) {
	now := time.Now()
	e := newEngineWith(t, now,
		Record{ParamKeys: []string{"filterOut"}, At: now, CollectionID: "c2"},
		Record{ParamKeys: []string{"filterOut"}, At: now, CollectionID: "c2"},
		Record{ParamKeys: []string{"filterHere"}, At: now, CollectionID: "c1"},
	)
	got := texts(e.Suggest(Request{
		Field: FieldParamKey, Prefix: "filter", CollectionID: "c1", Limit: 8,
	}))
	if got[0] != "filterHere" {
		t.Fatalf("boost de collection deveria levar 'filterHere' ao topo: %v", got)
	}
}
