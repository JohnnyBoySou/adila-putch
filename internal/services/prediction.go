package services

import (
	"sync"
	"time"

	"github.com/joaov/putch/internal/predict"
	"github.com/joaov/putch/internal/store"
)

// PredictionService expõe o motor de autocomplete preditivo (pacote predict)
// ao frontend via Wails. O índice é derivado das requests do store; as
// requests são a fonte de verdade, então reconstruímos sob demanda.
//
// Estratégia de rebuild: TTL curto. Num app desktop as requests mudam raramente
// (criar/editar), mas Suggest é chamado a cada tecla. Reconstruir o índice a
// cada tecla desperdiçaria CPU; um TTL garante no máximo um rebuild por janela
// mesmo digitando rápido, e o gap (poucos segundos) é irrelevante p/ sugestão.
//
// Concorrência: este serviço NÃO encosta no Store.mu além de chamar o público
// store.ListRequests() (que trava internamente, fora dos nossos locks). O
// predict.Engine tem o próprio RWMutex; aqui só serializamos a decisão de
// "quem reconstrói" via buildMu.
type PredictionService struct {
	store  *store.Store
	engine *predict.Engine

	buildMu   sync.Mutex
	lastBuild time.Time
	built     bool
}

// predictTTL: idade máxima do índice antes de um rebuild preguiçoso.
const predictTTL = 5 * time.Second

func NewPredictionService(s *store.Store) *PredictionService {
	return &PredictionService{store: s, engine: predict.NewEngine()}
}

// Suggest devolve as completações para o campo/prefixo pedido. Reconstrói o
// índice se estiver velho (lazy, guardado por TTL).
func (s *PredictionService) Suggest(req predict.Request) ([]predict.Suggestion, error) {
	if err := s.ensureFresh(); err != nil {
		return nil, err
	}
	return s.engine.Suggest(req), nil
}

// ensureFresh reconstrói o índice se passou do TTL desde o último build. O
// ListRequests + Rebuild rodam sob buildMu, mas como o TTL torna rebuilds
// raros isso quase nunca serializa chamadas de Suggest concorrentes.
func (s *PredictionService) ensureFresh() error {
	s.buildMu.Lock()
	defer s.buildMu.Unlock()
	if s.built && time.Since(s.lastBuild) < predictTTL {
		return nil
	}
	reqs, err := s.store.ListRequests()
	if err != nil {
		return err
	}
	now := time.Now()
	s.engine.Rebuild(toRecords(reqs, now), now)
	s.lastBuild = now
	s.built = true
	return nil
}

// toRecords mapeia store.Request → predict.Record.
//
// Fases 1-3 usam URL/Method/CollectionID/At + Body raw + chaves de
// header/param. O body só é repassado quando é raw/JSON (form/multipart não
// são JSON); mesmo assim NÃO é indexado literalmente — o predict reduz a um
// esqueleto (valores zerados) na ingestão. De header/param passamos só as
// CHAVES (valores ficam ""): valor de header pode ser segredo (Authorization).
// AuthValue continua totalmente de fora. Defesa em profundidade: mesmo o
// Record não carrega valor sensível, e o index só lê chaves.
func toRecords(reqs []store.Request, now time.Time) []predict.Record {
	out := make([]predict.Record, 0, len(reqs))
	for _, r := range reqs {
		at := now
		if r.CreatedAt != "" {
			if t, err := time.Parse(time.RFC3339, r.CreatedAt); err == nil {
				at = t
			}
		}
		rec := predict.Record{
			URL:          r.URL,
			Method:       r.Method,
			CollectionID: r.CollectionID,
			At:           at,
		}
		if r.BodyType == "" || r.BodyType == "raw" {
			rec.BodyJSON = r.Body
		}
		if len(r.Headers) > 0 {
			keys := make(map[string]string, len(r.Headers))
			for k := range r.Headers {
				keys[k] = "" // só a chave; valor zerado de propósito
			}
			rec.Headers = keys
		}
		if len(r.Params) > 0 {
			pk := make([]string, 0, len(r.Params))
			for k := range r.Params {
				pk = append(pk, k)
			}
			rec.ParamKeys = pk
		}
		out = append(out, rec)
	}
	return out
}
