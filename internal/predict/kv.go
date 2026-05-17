package predict

import "net/textproto"

// Providers de chave (header/param). Sugerem só a CHAVE — valores de
// header/param podem ser segredo e nunca são indexados (ver kvStat/observe).
// Frecency + boost de collection, igual ao urlProvider.

// suggestKV é o corpo comum: chaves do histórico cujo prefixo casa o digitado.
func suggestKV(stats map[string]*kvStat, ix *index, r Request, source string) []Suggestion {
	out := make([]Suggestion, 0, 8)
	for k, st := range stats {
		if len(k) <= len(r.Prefix) || !hasPrefixFold(k, r.Prefix) {
			continue
		}
		score := float64(st.count) * decay(ix.now.Sub(st.last))
		if r.CollectionID != "" && st.cols[r.CollectionID] {
			score *= colBoost
		}
		out = append(out, Suggestion{Text: k, Score: score, Source: source})
	}
	return out
}

type headerKeyProvider struct{}

func (headerKeyProvider) suggest(ix *index, r Request) []Suggestion {
	if r.Field != FieldHeaderKey || r.Prefix == "" {
		return nil
	}
	return suggestKV(ix.headerKeys, ix, r, "header")
}

type paramKeyProvider struct{}

func (paramKeyProvider) suggest(ix *index, r Request) []Suggestion {
	if r.Field != FieldParamKey || r.Prefix == "" {
		return nil
	}
	return suggestKV(ix.paramKeys, ix, r, "param")
}

// commonHeaders: nomes de header padronizados (RFC) p/ cold-start — análogo ao
// schemeProvider. Headers são universais (ao contrário de query params, que são
// específicos da API), então faz sentido sugerir mesmo sem histórico. Score
// baixo de propósito: qualquer header do histórico do usuário supera.
var commonHeaders = []string{
	"Accept",
	"Accept-Encoding",
	"Accept-Language",
	"Authorization",
	"Cache-Control",
	"Content-Type",
	"Cookie",
	"If-Match",
	"If-None-Match",
	"Origin",
	"Referer",
	"User-Agent",
	"X-Api-Key",
	"X-Request-Id",
	"X-Requested-With",
}

type commonHeaderProvider struct{}

func (commonHeaderProvider) suggest(_ *index, r Request) []Suggestion {
	if r.Field != FieldHeaderKey || r.Prefix == "" {
		return nil
	}
	out := make([]Suggestion, 0, 4)
	for _, h := range commonHeaders {
		if len(h) <= len(r.Prefix) || !hasPrefixFold(h, r.Prefix) {
			continue
		}
		out = append(out, Suggestion{
			// Text canônico p/ casar com a forma canonicalizada do histórico
			// (dedupe no merge: "content-type" e "Content-Type" não duplicam).
			Text:   textproto.CanonicalMIMEHeaderKey(h),
			Score:  0.3,
			Source: "common-header",
		})
	}
	return out
}
