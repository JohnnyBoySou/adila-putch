package predict

// urlProvider sugere URLs do histórico que começam com o que foi digitado,
// rankeadas por frecency (frequência × recência) com boost p/ a mesma
// collection. É a camada de maior ROI da Fase 1.
type urlProvider struct{}

// colBoost: estar na collection atual é um sinal forte de relevância — num
// API client você quase sempre quer a URL da collection aberta, mesmo que
// outra URL global tenha um pouco mais de hits. O multiplicador é alto de
// propósito p/ que o match de collection vença diferenças moderadas de
// frecency (uma URL da collection com 1 uso supera uma de fora com 2-3).
const colBoost = 4.0

func (urlProvider) suggest(ix *index, r Request) []Suggestion {
	if r.Field != FieldURL || r.Prefix == "" {
		return nil
	}
	out := make([]Suggestion, 0, 8)
	for u, st := range ix.urls {
		// Precisa haver algo a completar (mesma semântica do ghost-text do front).
		if len(u) <= len(r.Prefix) || !hasPrefixFold(u, r.Prefix) {
			continue
		}
		score := float64(st.count) * decay(ix.now.Sub(st.last))
		if r.CollectionID != "" && st.cols[r.CollectionID] {
			score *= colBoost
		}
		out = append(out, Suggestion{Text: u, Score: score, Source: "history"})
	}
	return out
}
