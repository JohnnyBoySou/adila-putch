package predict

import "strings"

// Modelo n-gram sobre segmentos de path de URL, com stupid-backoff.
//
// Complementa o urlProvider: aquele completa URLs vistas *verbatim*; este
// generaliza a ESTRUTURA. Dado o histórico .../v1/users, .../v1/orders, ao
// digitar .../v1/ ele prevê users/orders mesmo que a URL exata nunca tenha
// sido usada inteira; e em /api.z.com/v1/ (host novo) ainda sugere via backoff
// para o contexto mais curto ("v1").
//
// Backoff vai até a ordem 1 (último token), NÃO até um unigrama global: um
// "segmento mais comum em geral" ignora a posição no path e geraria ruído
// (ex.: prever .../p/p). Sem dado nem no contexto de 1 token → nada.
//
// Segurança/escopo: modela só o PATH. Query string e fragment são descartados
// na tokenização — não são estrutura de path e evitam aprender segredos em
// `?token=...`. URLs não são segredo no putch (segredo usa {{var}} de env).

const (
	ngramMaxOrder = 3   // contexto = até os últimos 3 tokens
	ngramBackoffα = 0.4 // peso ao recuar p/ um contexto mais curto
	ngramWeight   = 0.8 // escala final: previsão confiante < hit real de histórico, > scheme genérico
	ngramCtxJoin  = "\x00"
)

// ngramModel acumula contagens (contexto → próximo segmento). Imutável após o
// build (vive dentro do *index, trocado inteiro no Rebuild).
type ngramModel struct {
	grams map[string]map[string]int // ctxKey → segmento seguinte → contagem
	total map[string]int            // ctxKey → total de continuações
}

func newNgramModel() *ngramModel {
	return &ngramModel{
		grams: make(map[string]map[string]int),
		total: make(map[string]int),
	}
}

// splitURL tokeniza uma URL do histórico: [scheme://host, seg1, seg2, ...].
// Descarta query/fragment. ok=false se não há "scheme://host".
func splitURL(raw string) ([]string, bool) {
	if i := strings.IndexByte(raw, '#'); i >= 0 {
		raw = raw[:i]
	}
	if i := strings.IndexByte(raw, '?'); i >= 0 {
		raw = raw[:i]
	}
	i := strings.Index(raw, "://")
	if i < 0 {
		return nil, false
	}
	rest := raw[i+3:]
	host, path := rest, ""
	if s := strings.IndexByte(rest, '/'); s >= 0 {
		host, path = rest[:s], rest[s+1:]
	}
	if host == "" {
		return nil, false
	}
	tokens := []string{raw[:i+3] + host}
	for _, p := range strings.Split(path, "/") {
		if p != "" {
			tokens = append(tokens, p)
		}
	}
	return tokens, true
}

// observe incorpora uma URL ao modelo: cada segmento de path (índice ≥ 1, o
// host nunca é "próximo") conta sob os contextos de ordem 1..max.
func (m *ngramModel) observe(rawURL string) {
	t, ok := splitURL(rawURL)
	if !ok || len(t) < 2 {
		return
	}
	for i := 1; i < len(t); i++ {
		next := t[i]
		for order := 1; order <= ngramMaxOrder && order <= i; order++ {
			m.bump(strings.Join(t[i-order:i], ngramCtxJoin), next)
		}
	}
}

func (m *ngramModel) bump(ctxKey, next string) {
	c := m.grams[ctxKey]
	if c == nil {
		c = make(map[string]int)
		m.grams[ctxKey] = c
	}
	c[next]++
	m.total[ctxKey]++
}

// splitPrefix interpreta o que foi digitado: tokens completos de contexto + o
// segmento parcial atual. ok=false quando não cabe ao n-gram de path:
// host ainda incompleto (sem "/") ou já se está editando a query ("?").
func splitPrefix(raw string) (ctx []string, partial string, ok bool) {
	if strings.ContainsAny(raw, "?#") {
		return nil, "", false
	}
	i := strings.Index(raw, "://")
	if i < 0 {
		return nil, "", false
	}
	rest := raw[i+3:]
	s := strings.IndexByte(rest, '/')
	if s < 0 {
		return nil, "", false // host ainda sendo digitado
	}
	hostTok := raw[:i+3] + rest[:s]
	parts := strings.Split(rest[s+1:], "/")
	partial = parts[len(parts)-1]
	ctx = []string{hostTok}
	for _, p := range parts[:len(parts)-1] {
		if p != "" {
			ctx = append(ctx, p)
		}
	}
	return ctx, partial, true
}

type ngramPred struct {
	seg   string
	score float64
}

// predict aplica stupid-backoff: usa o contexto mais específico que tenha
// continuações casando o `partial`; senão recua (×α) p/ contextos mais curtos,
// até a ordem 1. Score = (contagem/total do contexto usado) × peso de backoff.
func (m *ngramModel) predict(ctx []string, partial string) []ngramPred {
	weight := 1.0
	hi := min(len(ctx), ngramMaxOrder)
	for order := hi; order >= 1; order-- {
		key := strings.Join(ctx[len(ctx)-order:], ngramCtxJoin)
		conts, total := m.grams[key], m.total[key]
		if total > 0 {
			var out []ngramPred
			for seg, c := range conts {
				if len(seg) <= len(partial) || !hasPrefixFold(seg, partial) {
					continue
				}
				out = append(out, ngramPred{seg, weight * float64(c) / float64(total)})
			}
			if len(out) > 0 {
				return out
			}
		}
		weight *= ngramBackoffα
	}
	return nil
}

// pathNgramProvider expõe o modelo n-gram no pipeline. Sugere a URL = (digitado
// até o segmento parcial) + (segmento previsto), satisfazendo o contrato do
// ghost-text (Text tem o prefixo digitado e é mais longo). Score escalado por
// ngramWeight p/ ficar abaixo de histórico verbatim e acima de scheme genérico;
// o merge deduplica por Text (se urlProvider já tem a URL exata, ele vence).
type pathNgramProvider struct{}

func (pathNgramProvider) suggest(ix *index, r Request) []Suggestion {
	if r.Field != FieldURL || r.Prefix == "" {
		return nil
	}
	ctx, partial, ok := splitPrefix(r.Prefix)
	if !ok {
		return nil
	}
	preds := ix.ngram.predict(ctx, partial)
	if len(preds) == 0 {
		return nil
	}
	base := r.Prefix[:len(r.Prefix)-len(partial)] // digitado, sem o parcial
	out := make([]Suggestion, 0, len(preds))
	for _, p := range preds {
		out = append(out, Suggestion{
			Text:   base + p.seg,
			Score:  p.score * ngramWeight,
			Source: "ngram",
		})
	}
	return out
}
