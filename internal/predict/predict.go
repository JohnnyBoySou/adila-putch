// Package predict é o motor de autocomplete preditivo do putch.
//
// É deliberadamente estatístico e sem dependências: recuperação + ranking
// (frecency, n-gram) sobre o histórico do próprio usuário. Roda 100% local,
// em memória, com latência de poucos ms — adequado a ghost-text inline.
//
// O pacote é puro (não importa store/services) para ser trivialmente testável
// sob `go test -race`. Quem chama mapeia as requests do store para []Record e
// chama Engine.Rebuild; a UI chama Engine.Suggest a cada tecla (debounced).
//
// A extensão para novas fases (body, headers/params, n-gram) é só adicionar
// um provider — a interface Suggest/merge não muda.
package predict

import (
	"math"
	"sort"
	"strings"
	"sync"
	"time"
)

// Field identifica o campo que está sendo previsto.
type Field string

const (
	FieldURL       Field = "url"
	FieldBodyJSON  Field = "body"
	FieldHeaderKey Field = "header"
	FieldParamKey  Field = "param"
)

// Request é uma consulta de sugestão (uma tecla digitada num campo).
type Request struct {
	Field        Field  `json:"field"`
	Prefix       string `json:"prefix"`
	Method       string `json:"method"`
	URL          string `json:"url"` // contexto (relevante p/ body em fases futuras)
	CollectionID string `json:"collection_id"`
	Limit        int    `json:"limit"`
}

// Suggestion é uma completação candidata. Text é o valor canônico completo —
// o frontend aceita via Tab substituindo o campo por Text (case-normalizado).
type Suggestion struct {
	Text    string  `json:"text"`
	Display string  `json:"display"`
	Score   float64 `json:"score"`
	Source  string  `json:"source"`
}

// Record é uma request observada, já neutra (sem tipos de store/services).
// Campos além de URL/At/CollectionID são preenchidos desde já para as fases
// 2–4 não precisarem mexer na ingestão.
type Record struct {
	URL          string
	Method       string
	Headers      map[string]string
	ParamKeys    []string
	BodyJSON     string
	CollectionID string
	At           time.Time
}

// provider é uma camada do pipeline. Recebe o índice (somente leitura) e a
// consulta, devolve candidatos já com score relativo da camada.
type provider interface {
	suggest(idx *index, r Request) []Suggestion
}

// frecencyHalfLife: meia-vida do decaimento de recência (frecency estilo
// Mozilla). 30 dias = uma request de um mês atrás vale metade de uma de hoje.
const frecencyHalfLife = 30 * 24 * time.Hour

// decay devolve o fator de recência em (0,1] para uma idade.
func decay(age time.Duration) float64 {
	if age <= 0 {
		return 1
	}
	return math.Pow(0.5, age.Seconds()/frecencyHalfLife.Seconds())
}

// Engine é o motor com estado. Seguro para uso concorrente: Suggest pega
// RLock; Rebuild troca o índice sob Lock (build-then-swap, o build pesado
// acontece fora do lock). Não encosta no Store.mu — quem chama lê o store
// e passa Records prontos.
type Engine struct {
	mu        sync.RWMutex
	idx       *index
	providers []provider
}

// NewEngine cria o motor com o pipeline da fase atual.
func NewEngine() *Engine {
	return &Engine{
		idx: newIndex(),
		providers: []provider{
			schemeProvider{},
			urlProvider{},
			bodyProvider{},
			headerKeyProvider{},
			paramKeyProvider{},
			commonHeaderProvider{},
			pathNgramProvider{},
		},
	}
}

// Rebuild reconstrói o índice a partir do snapshot de requests. O índice é
// derivado (as requests são a fonte de verdade) — pode ser chamado à vontade.
func (e *Engine) Rebuild(recs []Record, now time.Time) {
	built := newIndex()
	for _, r := range recs {
		built.observe(r, now)
	}
	e.mu.Lock()
	e.idx = built
	e.mu.Unlock()
}

// Suggest roda o pipeline para o campo pedido e devolve o top-N mesclado.
func (e *Engine) Suggest(r Request) []Suggestion {
	if r.Limit <= 0 {
		r.Limit = 8
	}
	e.mu.RLock()
	idx := e.idx
	provs := e.providers
	e.mu.RUnlock()

	var all []Suggestion
	for _, p := range provs {
		all = append(all, p.suggest(idx, r)...)
	}
	return merge(all, r.Limit)
}

// merge deduplica por Text (mantendo o maior score) e ordena por score desc,
// desempate por Text asc (estável p/ a UI e p/ os testes).
func merge(in []Suggestion, limit int) []Suggestion {
	best := make(map[string]Suggestion, len(in))
	for _, s := range in {
		if s.Text == "" {
			continue
		}
		if cur, ok := best[s.Text]; !ok || s.Score > cur.Score {
			best[s.Text] = s
		}
	}
	out := make([]Suggestion, 0, len(best))
	for _, s := range best {
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].Text < out[j].Text
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

// hasPrefixFold = strings.HasPrefix case-insensitive (ASCII-friendly p/ URLs).
func hasPrefixFold(s, prefix string) bool {
	if len(prefix) > len(s) {
		return false
	}
	return strings.EqualFold(s[:len(prefix)], prefix)
}
