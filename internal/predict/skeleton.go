package predict

import "encoding/json"

// jsonSkeleton transforma um corpo JSON no seu *esqueleto canônico*: a mesma
// estrutura de chaves, mas com todo valor escalar zerado.
//
//	{"name":"João","token":"sk-secret","age":33}
//	  → {"age":0,"name":"","token":""}
//
// Isso é o coração do invariante de segurança da Fase 2: NUNCA reproduzimos o
// valor literal que o usuário digitou (poderia ser segredo/PII) — só a forma.
// O usuário ganha o template e preenche os valores. As chaves de objeto saem
// ordenadas (encoding/json ordena map keys), então o mesmo corpo lógico gera
// sempre a mesma string — pré-requisito p/ o casamento por prefixo do
// ghost-text e p/ a deduplicação no merge.
//
// ok=false quando o texto não é JSON válido (não indexamos lixo).
func jsonSkeleton(body string) (string, bool) {
	var v any
	if err := json.Unmarshal([]byte(body), &v); err != nil {
		return "", false
	}
	out, err := json.Marshal(zeroValue(v))
	if err != nil {
		return "", false
	}
	return string(out), true
}

// zeroValue substitui escalares pelo zero do seu tipo, recursando em
// objetos/arrays. Array não-vazio vira [esqueleto do 1º elemento] — preserva o
// formato dos itens (template útil) sem repetir conteúdo; array vazio fica [].
func zeroValue(v any) any {
	switch t := v.(type) {
	case map[string]any:
		m := make(map[string]any, len(t))
		for k, val := range t {
			m[k] = zeroValue(val)
		}
		return m
	case []any:
		if len(t) == 0 {
			return []any{}
		}
		return []any{zeroValue(t[0])}
	case string:
		return ""
	case float64:
		return float64(0)
	case bool:
		return false
	default: // nil
		return nil
	}
}
