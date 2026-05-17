package predict

// schemeProvider completa o scheme da URL (sempre digitamos "https://...").
// Score baixo de propósito: qualquer URL real do histórico deve superá-lo,
// mas ele garante sugestão útil mesmo sem histórico (cold start).
type schemeProvider struct{}

// Pares scheme→score base. https acima de http (default seguro).
var schemes = []struct {
	text  string
	score float64
}{
	{"https://", 0.5},
	{"http://", 0.4},
}

func (schemeProvider) suggest(_ *index, r Request) []Suggestion {
	if r.Field != FieldURL || r.Prefix == "" {
		return nil
	}
	var out []Suggestion
	for _, s := range schemes {
		if len(s.text) <= len(r.Prefix) || !hasPrefixFold(s.text, r.Prefix) {
			continue
		}
		out = append(out, Suggestion{Text: s.text, Score: s.score, Source: "scheme"})
	}
	return out
}
