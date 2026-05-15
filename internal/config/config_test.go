package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// Set/Get/Reset com round-trip em disco, e o merge que preserva chaves de
// outros apps da suíte (não pisar no que o /ide gravou).
func TestConfigRoundtrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")

	// Simula o /ide tendo gravado outra chave antes.
	seed := map[string]any{"ide.theme": "dark"}
	b, _ := json.Marshal(seed)
	if err := os.WriteFile(path, b, 0o644); err != nil {
		t.Fatal(err)
	}

	c := &Config{data: make(map[string]any), path: path}
	c.load()

	if err := c.Set("github.token", "ghs_abc"); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if got := c.Get("github.token", ""); got != "ghs_abc" {
		t.Fatalf("Get token: %v", got)
	}

	// Outro processo (config nova lendo o mesmo arquivo) deve enxergar ambas.
	c2 := &Config{data: make(map[string]any), path: path}
	c2.load()
	if got := c2.Get("github.token", ""); got != "ghs_abc" {
		t.Fatalf("persistência falhou: %v", got)
	}
	if got := c2.Get("ide.theme", ""); got != "dark" {
		t.Fatalf("merge pisou na chave do /ide: %v", got)
	}

	if err := c.Reset("github.token"); err != nil {
		t.Fatalf("Reset: %v", err)
	}
	c3 := &Config{data: make(map[string]any), path: path}
	c3.load()
	if got := c3.Get("github.token", "missing"); got != "missing" {
		t.Fatalf("Reset não removeu: %v", got)
	}
	if got := c3.Get("ide.theme", ""); got != "dark" {
		t.Fatalf("Reset pisou na chave do /ide: %v", got)
	}
}
