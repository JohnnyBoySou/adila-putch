package predict

// bodyProvider sugere o *esqueleto* de bodies JSON já usados (estrutura de
// chaves, valores zerados — ver skeleton.go). O usuário começa o corpo (ex.:
// digita `{`) e recebe o template canônico mais provável p/ aquele contexto,
// rankeado por frecency com boost de collection e de método HTTP.
//
// Segurança: o índice só guarda esqueletos (jsonSkeleton zera todo escalar na
// ingestão), então não há valor literal a vazar aqui — este provider nunca vê
// o conteúdo original.
type bodyProvider struct{}

// methodBoost: corpo observado com o mesmo método HTTP da request atual sobe.
// A forma do payload correlaciona forte com o verbo (POST cria, PUT substitui),
// então — como o colBoost — é um multiplicador alto de propósito: o esqueleto
// do método certo vence diferenças moderadas de frecency de outros métodos.
const methodBoost = 3.0

func (bodyProvider) suggest(ix *index, r Request) []Suggestion {
	if r.Field != FieldBodyJSON || r.Prefix == "" {
		return nil
	}
	out := make([]Suggestion, 0, 8)
	for skel, st := range ix.bodies {
		// Mesma semântica do ghost-text/urlProvider: precisa haver algo a
		// completar e o digitado tem de ser prefixo do esqueleto canônico.
		if len(skel) <= len(r.Prefix) || !hasPrefixFold(skel, r.Prefix) {
			continue
		}
		score := float64(st.count) * decay(ix.now.Sub(st.last))
		if r.CollectionID != "" && st.cols[r.CollectionID] {
			score *= colBoost
		}
		if r.Method != "" && st.methods[r.Method] {
			score *= methodBoost
		}
		out = append(out, Suggestion{Text: skel, Score: score, Source: "body"})
	}
	return out
}
