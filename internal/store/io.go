package store

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// literalString é serializado como bloco literal YAML (`|`), o que mantém
// corpos JSON legíveis e com diff linha-a-linha no git. Na leitura comporta-se
// como string comum.
type literalString string

func (l literalString) MarshalYAML() (any, error) {
	if l == "" {
		return "", nil
	}
	return &yaml.Node{Kind: yaml.ScalarNode, Style: yaml.LiteralStyle, Value: string(l)}, nil
}

func (l *literalString) UnmarshalYAML(n *yaml.Node) error {
	var s string
	if err := n.Decode(&s); err != nil {
		return err
	}
	*l = literalString(s)
	return nil
}

// ---- DTOs em disco ---------------------------------------------------------
//
// O collection_id / folder_id NÃO são persistidos: a hierarquia é o próprio
// caminho do arquivo. updated_at também some — o histórico do git é a fonte
// de "quando mudou".

type collectionFile struct {
	ID        string `yaml:"id"`
	Name      string `yaml:"name"`
	CreatedAt string `yaml:"created_at"`
}

type folderFile struct {
	ID        string `yaml:"id"`
	Name      string `yaml:"name"`
	CreatedAt string `yaml:"created_at"`
}

type requestFile struct {
	ID        string            `yaml:"id"`
	Name      string            `yaml:"name"`
	Method    string            `yaml:"method"`
	URL       string            `yaml:"url"`
	Headers   map[string]string `yaml:"headers,omitempty"`
	Body      literalString     `yaml:"body,omitempty"`
	Favorite  bool              `yaml:"favorite"`
	Active    bool              `yaml:"active"`
	CreatedAt string            `yaml:"created_at"`
}

// environmentFile é a parte versionada (sem valores secretos). `secret` lista
// os nomes de variáveis cujos valores vivem no <nome>.local.yml (gitignored).
type environmentFile struct {
	ID        string            `yaml:"id"`
	Name      string            `yaml:"name"`
	CreatedAt string            `yaml:"created_at"`
	Secret    []string          `yaml:"secret,omitempty"`
	Variables map[string]string `yaml:"variables,omitempty"`
}

type environmentLocalFile struct {
	Variables map[string]string `yaml:"variables,omitempty"`
}

func readYAML[T any](path string) (T, error) {
	var v T
	b, err := os.ReadFile(path)
	if err != nil {
		return v, err
	}
	err = yaml.Unmarshal(b, &v)
	return v, err
}

func writeYAML(path string, v any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	b, err := yaml.Marshal(v)
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o644)
}
