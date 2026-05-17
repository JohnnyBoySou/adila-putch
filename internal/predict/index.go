package predict

import (
	"net/textproto"
	"time"
)

// urlStat acumula a frecency de uma URL observada.
type urlStat struct {
	count int
	last  time.Time
	cols  map[string]bool // collections em que essa URL apareceu (p/ boost)
}

// bodyStat acumula a frecency de um esqueleto de body (já canônico/zerado).
// Guarda os métodos em que apareceu: a forma do corpo correlaciona forte com
// o verbo HTTP (um POST difere de um PUT), então match de método dá boost.
type bodyStat struct {
	count   int
	last    time.Time
	cols    map[string]bool
	methods map[string]bool
}

// kvStat acumula a frecency de uma chave (header/param). Só a CHAVE é
// observada — valores de header/param podem ser segredo e NUNCA entram no
// índice (invariante de segurança da Fase 3).
type kvStat struct {
	count int
	last  time.Time
	cols  map[string]bool
}

// index é o estado derivado em memória. Imutável após o build (Rebuild troca
// o ponteiro inteiro), então os providers podem ler sem lock.
//
// `now` é o relógio de referência do build — o decaimento de frecency é
// calculado relativo a ele. Num app desktop o gap build→query é de segundos;
// fixar no build torna o ranking determinístico (e os testes triviais).
type index struct {
	now        time.Time
	urls       map[string]*urlStat
	bodies     map[string]*bodyStat // chave = esqueleto JSON canônico
	headerKeys map[string]*kvStat   // canonicalizada (RFC), case-insensitive
	paramKeys  map[string]*kvStat   // como digitada (query param é case-sensitive)
	ngram      *ngramModel          // n-gram de segmentos de path (Fase 4)
}

func newIndex() *index {
	return &index{
		urls:       make(map[string]*urlStat),
		bodies:     make(map[string]*bodyStat),
		headerKeys: make(map[string]*kvStat),
		paramKeys:  make(map[string]*kvStat),
		ngram:      newNgramModel(),
	}
}

// bumpKV acumula a frecency de uma chave num mapa kvStat.
func bumpKV(m map[string]*kvStat, key string, at time.Time, col string) {
	st := m[key]
	if st == nil {
		st = &kvStat{cols: make(map[string]bool)}
		m[key] = st
	}
	st.count++
	if at.After(st.last) {
		st.last = at
	}
	if col != "" {
		st.cols[col] = true
	}
}

// observe incorpora uma request ao índice. r.At ausente cai em `now`.
func (ix *index) observe(r Record, now time.Time) {
	if ix.now.IsZero() || now.After(ix.now) {
		ix.now = now
	}
	if r.URL != "" {
		at := r.At
		if at.IsZero() {
			at = now
		}
		st := ix.urls[r.URL]
		if st == nil {
			st = &urlStat{cols: make(map[string]bool)}
			ix.urls[r.URL] = st
		}
		st.count++
		if at.After(st.last) {
			st.last = at
		}
		if r.CollectionID != "" {
			st.cols[r.CollectionID] = true
		}
		ix.ngram.observe(r.URL)
	}
	if skel, ok := jsonSkeleton(r.BodyJSON); ok {
		at := r.At
		if at.IsZero() {
			at = now
		}
		st := ix.bodies[skel]
		if st == nil {
			st = &bodyStat{cols: make(map[string]bool), methods: make(map[string]bool)}
			ix.bodies[skel] = st
		}
		st.count++
		if at.After(st.last) {
			st.last = at
		}
		if r.CollectionID != "" {
			st.cols[r.CollectionID] = true
		}
		if r.Method != "" {
			st.methods[r.Method] = true
		}
	}
	at := r.At
	if at.IsZero() {
		at = now
	}
	// Só as CHAVES. Header é canonicalizado (RFC, case-insensitive); query
	// param é case-sensitive, fica como digitado. Valores nunca entram.
	for k := range r.Headers {
		if k != "" {
			bumpKV(ix.headerKeys, textproto.CanonicalMIMEHeaderKey(k), at, r.CollectionID)
		}
	}
	for _, k := range r.ParamKeys {
		if k != "" {
			bumpKV(ix.paramKeys, k, at, r.CollectionID)
		}
	}
}
