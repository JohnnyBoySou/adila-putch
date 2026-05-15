package github

import (
	"testing"

	"github.com/joaov/putch/internal/config"
)

// injectTokenIntoURL: token só entra em https sem userinfo; ssh/sem-token
// passam intactos. Crítico — esse caminho move o segredo pra dentro da URL.
func TestInjectTokenIntoURL(t *testing.T) {
	cases := []struct {
		name, in, token, want string
	}{
		{"https sem token", "https://github.com/o/r.git", "", "https://github.com/o/r.git"},
		{"https com token", "https://github.com/o/r.git", "ghs_x", "https://x-access-token:ghs_x@github.com/o/r.git"},
		{"ssh ignora token", "git@github.com:o/r.git", "ghs_x", "git@github.com:o/r.git"},
		{"já tem userinfo", "https://user@github.com/o/r.git", "ghs_x", "https://user@github.com/o/r.git"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := injectTokenIntoURL(c.in, c.token); got != c.want {
				t.Fatalf("got %q want %q", got, c.want)
			}
		})
	}
}

// Sem token no Config: não autenticado e apiRequest recusa antes de qualquer
// rede (garante que nada vaza sem credencial).
func TestUnauthenticatedGuards(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	g := NewService(config.New())
	if g.IsAuthenticated() {
		t.Fatal("não deveria estar autenticado sem token")
	}
	if _, err := g.apiRequest("GET", "/user", nil); err == nil {
		t.Fatal("apiRequest deveria falhar sem token")
	}
}

// O hook Emit é opcional: chamar emit sem Emit setado não pode panicar.
func TestEmitNilSafe(t *testing.T) {
	g := &Service{}
	g.emit("github.changed")
	g.emit("github:clone-progress", CloneProgress{Phase: "x"})
}
