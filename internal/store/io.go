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

// workspaceFile é o workspace serializado. Campos opcionais usam omitempty
// (workspace.yml antigo sem esses campos decodifica para zero values —
// compatível, sem migração).
type workspaceFile struct {
	ID            string `yaml:"id"`
	Name          string `yaml:"name"`
	Description   string `yaml:"description,omitempty"`
	Color         string `yaml:"color,omitempty"`
	Icon          string `yaml:"icon,omitempty"`
	Pinned        bool   `yaml:"pinned,omitempty"`
	CreatedAt     string `yaml:"created_at"`
	CreatedAuthor string `yaml:"created_author,omitempty"`
	UpdatedAt     string `yaml:"updated_at,omitempty"`
	UpdatedAuthor string `yaml:"updated_author,omitempty"`
}

func fromWorkspaceFile(wf workspaceFile) Workspace {
	return Workspace{
		ID:            wf.ID,
		Name:          wf.Name,
		Description:   wf.Description,
		Color:         wf.Color,
		Icon:          wf.Icon,
		Pinned:        wf.Pinned,
		CreatedAt:     wf.CreatedAt,
		CreatedAuthor: wf.CreatedAuthor,
		UpdatedAt:     wf.UpdatedAt,
		UpdatedAuthor: wf.UpdatedAuthor,
	}
}

func toWorkspaceFile(w Workspace) workspaceFile {
	return workspaceFile{
		ID:            w.ID,
		Name:          w.Name,
		Description:   w.Description,
		Color:         w.Color,
		Icon:          w.Icon,
		Pinned:        w.Pinned,
		CreatedAt:     w.CreatedAt,
		CreatedAuthor: w.CreatedAuthor,
		UpdatedAt:     w.UpdatedAt,
		UpdatedAuthor: w.UpdatedAuthor,
	}
}

// collectionFile é a collection serializada. Campos opcionais usam omitempty
// para manter os YAMLs antigos legíveis e sem ruído (collection.yml sem esses
// campos decodifica para zero values — compatível, sem migração).
type collectionFile struct {
	ID            string `yaml:"id"`
	Name          string `yaml:"name"`
	Description   string `yaml:"description,omitempty"`
	Pinned        bool   `yaml:"pinned,omitempty"`
	Deprecated    bool   `yaml:"deprecated,omitempty"`
	Bg            int    `yaml:"bg,omitempty"`
	CreatedAt     string `yaml:"created_at"`
	CreatedAuthor string `yaml:"created_author,omitempty"`
	UpdatedAt     string `yaml:"updated_at,omitempty"`
	UpdatedAuthor string `yaml:"updated_author,omitempty"`
}

func fromCollectionFile(cf collectionFile) Collection {
	return Collection{
		ID:            cf.ID,
		Name:          cf.Name,
		Description:   cf.Description,
		Pinned:        cf.Pinned,
		Deprecated:    cf.Deprecated,
		Bg:            cf.Bg,
		CreatedAt:     cf.CreatedAt,
		CreatedAuthor: cf.CreatedAuthor,
		UpdatedAt:     cf.UpdatedAt,
		UpdatedAuthor: cf.UpdatedAuthor,
	}
}

func toCollectionFile(c Collection) collectionFile {
	return collectionFile{
		ID:            c.ID,
		Name:          c.Name,
		Description:   c.Description,
		Pinned:        c.Pinned,
		Deprecated:    c.Deprecated,
		Bg:            c.Bg,
		CreatedAt:     c.CreatedAt,
		CreatedAuthor: c.CreatedAuthor,
		UpdatedAt:     c.UpdatedAt,
		UpdatedAuthor: c.UpdatedAuthor,
	}
}

// testFile é a suíte serializada. request_id referencia uma request do mesmo
// workspace; a hierarquia (workspace_id) é o caminho, não persistida.
type testAssertionFile struct {
	Type     string `yaml:"type"`
	Target   string `yaml:"target,omitempty"`
	Expected string `yaml:"expected,omitempty"`
}

type testCaptureFile struct {
	Var  string `yaml:"var"`
	From string `yaml:"from"`
	Path string `yaml:"path,omitempty"`
}

type testStepFile struct {
	Name       string              `yaml:"name"`
	RequestID  string              `yaml:"request_id"`
	Assertions []testAssertionFile `yaml:"assertions,omitempty"`
	Captures   []testCaptureFile   `yaml:"captures,omitempty"`
}

type testFile struct {
	ID        string         `yaml:"id"`
	Name      string         `yaml:"name"`
	CreatedAt string         `yaml:"created_at"`
	Steps     []testStepFile `yaml:"steps,omitempty"`
}

func fromTestFile(tf testFile, wsID string) Test {
	steps := make([]TestStep, 0, len(tf.Steps))
	for _, sf := range tf.Steps {
		as := make([]TestAssertion, 0, len(sf.Assertions))
		for _, af := range sf.Assertions {
			as = append(as, TestAssertion{Type: af.Type, Target: af.Target, Expected: af.Expected})
		}
		cs := make([]TestCapture, 0, len(sf.Captures))
		for _, cf := range sf.Captures {
			cs = append(cs, TestCapture{Var: cf.Var, From: cf.From, Path: cf.Path})
		}
		steps = append(steps, TestStep{Name: sf.Name, RequestID: sf.RequestID, Assertions: as, Captures: cs})
	}
	return Test{ID: tf.ID, Name: tf.Name, WorkspaceID: wsID, CreatedAt: tf.CreatedAt, Steps: steps}
}

func toTestFile(t Test) testFile {
	steps := make([]testStepFile, 0, len(t.Steps))
	for _, st := range t.Steps {
		as := make([]testAssertionFile, 0, len(st.Assertions))
		for _, a := range st.Assertions {
			as = append(as, testAssertionFile{Type: a.Type, Target: a.Target, Expected: a.Expected})
		}
		cs := make([]testCaptureFile, 0, len(st.Captures))
		for _, c := range st.Captures {
			cs = append(cs, testCaptureFile{Var: c.Var, From: c.From, Path: c.Path})
		}
		steps = append(steps, testStepFile{Name: st.Name, RequestID: st.RequestID, Assertions: as, Captures: cs})
	}
	return testFile{ID: t.ID, Name: t.Name, CreatedAt: t.CreatedAt, Steps: steps}
}

type folderFile struct {
	ID        string `yaml:"id"`
	Name      string `yaml:"name"`
	CreatedAt string `yaml:"created_at"`
}

// orderFile é o manifesto de ordem manual de um container (raiz da coleção ou
// um folder). Lista os ids dos filhos diretos (folders + requests) na ordem
// escolhida pelo usuário. Ids ausentes do snapshot são ignorados na aplicação;
// filhos sem entrada vão para o fim. Versionável (vai pro git).
type orderFile struct {
	Order []string `yaml:"order,omitempty"`
}

type requestFile struct {
	ID         string            `yaml:"id"`
	Name       string            `yaml:"name"`
	Method     string            `yaml:"method"`
	URL        string            `yaml:"url"`
	Params     map[string]string `yaml:"params,omitempty"`
	Headers    map[string]string `yaml:"headers,omitempty"`
	Body       literalString     `yaml:"body,omitempty"`
	BodyType   string            `yaml:"body_type,omitempty"`
	Form       map[string]string `yaml:"form,omitempty"`
	Files      map[string]string `yaml:"files,omitempty"`
	AuthType   string            `yaml:"auth_type,omitempty"`
	AuthValue  string            `yaml:"auth_value,omitempty"`
	TimeoutMS  int               `yaml:"timeout_ms,omitempty"`
	PreScript  literalString     `yaml:"pre_script,omitempty"`
	PostScript literalString     `yaml:"post_script,omitempty"`
	Favorite   bool              `yaml:"favorite"`
	Active     bool              `yaml:"active"`
	CreatedAt  string            `yaml:"created_at"`
}

// environmentFile é a parte versionada (sem valores secretos). `secret` lista
// os nomes de variáveis cujos valores vivem no <nome>.local.yml (gitignored).
type environmentFile struct {
	ID          string            `yaml:"id"`
	Name        string            `yaml:"name"`
	Description string            `yaml:"description,omitempty"`
	Pinned      bool              `yaml:"pinned,omitempty"`
	Deprecated  bool              `yaml:"deprecated,omitempty"`
	CreatedAt   string            `yaml:"created_at"`
	UpdatedAt   string            `yaml:"updated_at,omitempty"`
	Secret      []string          `yaml:"secret,omitempty"`
	Variables   map[string]string `yaml:"variables,omitempty"`
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

// writeYAML grava de forma atômica: escreve num arquivo temporário no mesmo
// diretório (rename só é atômico dentro do mesmo filesystem), faz fsync do
// arquivo e do diretório e só então renomeia por cima do destino. Crash no
// meio da escrita deixa o arquivo antigo intacto em vez de um YAML truncado.
func writeYAML(path string, v any) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	b, err := yaml.Marshal(v)
	if err != nil {
		return err
	}

	tmp, err := os.CreateTemp(dir, "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	// Em qualquer caminho de erro, não deixar o temporário órfão.
	defer func() { _ = os.Remove(tmpName) }()

	if _, err := tmp.Write(b); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmpName, 0o644); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	// fsync do diretório torna a própria troca de nome durável (best-effort:
	// alguns filesystems não suportam, e o rename já dá a atomicidade).
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}
