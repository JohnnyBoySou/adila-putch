// Package config persiste configurações do usuário em
// ~/.config/adila/settings.json — o MESMO arquivo usado pelo /ide e pelo
// /stash. Assim o token do GitHub autenticado em qualquer app da suíte Adila
// é reaproveitado aqui (e vice-versa), sem o usuário logar de novo.
//
// Diferente da versão do stash (que tinha ctx do Wails + debounce + emit),
// esta é deliberadamente enxuta e SEM dependência de Wails: gravação
// síncrona protegida por mutex. O arquivo é minúsculo (algumas chaves), então
// debounce seria complexidade sem ganho.
package config

import (
	"encoding/json"
	"maps"
	"os"
	"path/filepath"
	"sync"
)

type Config struct {
	mu   sync.RWMutex
	data map[string]any
	path string
}

// New carrega settings.json (se existir). Erro de leitura/parse não é fatal:
// começa com config vazia — o arquivo pode ainda não existir na primeira vez.
func New() *Config {
	c := &Config{data: make(map[string]any)}
	if path, err := settingsFilePath(); err == nil {
		c.path = path
		c.load()
	}
	return c
}

func (c *Config) load() {
	raw, err := os.ReadFile(c.path)
	if err != nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = json.Unmarshal(raw, &c.data)
}

// flush grava o mapa inteiro de volta. c.data foi carregado de settings.json
// no New(), então já contém as chaves dos outros apps da suíte (ex.: ide.theme)
// — elas são preservadas. (Mesma estratégia do stash. Escrita concorrente
// cross-process num arquivo de settings é rara o suficiente para não
// justificar merge-from-disk, que ressuscitaria chaves removidas via Reset.)
func (c *Config) flush() error {
	if c.path == "" {
		return nil
	}
	c.mu.RLock()
	snap := make(map[string]any, len(c.data))
	maps.Copy(snap, c.data)
	c.mu.RUnlock()

	b, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(c.path, b, 0o644)
}

func (c *Config) Get(key string, defaultValue any) any {
	c.mu.RLock()
	v, ok := c.data[key]
	c.mu.RUnlock()
	if !ok {
		return defaultValue
	}
	return v
}

func (c *Config) Set(key string, value any) error {
	c.mu.Lock()
	c.data[key] = value
	c.mu.Unlock()
	return c.flush()
}

func (c *Config) Reset(key string) error {
	c.mu.Lock()
	delete(c.data, key)
	c.mu.Unlock()
	return c.flush()
}

func settingsFilePath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "adila")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "settings.json"), nil
}
