// Package store é a camada de persistência do putch em arquivos YAML.
//
// Layout no workspace root (pasta versionada por git):
//
//	<root>/
//	  .gitignore                               # **/*.local.yml
//	  <workspace-slug>/
//	    workspace.yml                          # id, name, created_at
//	    environments/
//	      <env-slug>.yml                       # versionado (sem segredos)
//	      <env-slug>.local.yml                 # gitignored (valores secretos)
//	    tests/
//	      <test-slug>.yml                      # suíte de testes (encadeia requests)
//	    <collection-slug>/
//	      collection.yml                         # id, name, description, pinned…
//	      .putch-order.yml                       # ordem manual da raiz da coleção
//	      requests/<request-slug>.yml          # requests sem pasta
//	      <folder-slug>/
//	        folder.yml
//	        .putch-order.yml                     # ordem manual deste folder
//	        <request-slug>.yml                 # requests da pasta
//	        <subfolder-slug>/                    # folders aninham recursivamente
//	          folder.yml
//	          <request-slug>.yml
//
// Um workspace engloba tudo: collections, environments (compartilhados por
// todas as collections do workspace) e tests. O `root` pode conter vários
// workspaces; um deles é o "ativo" (s.WorkspaceID) e todas as operações de
// collection/request/env/test são escopadas nele.
//
// A identidade de cada entidade é o campo `id` dentro do arquivo; o nome do
// arquivo é apenas cosmético (bom para diffs/PRs) e é recomputado em renames.
package store

import (
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

const (
	collectionMeta = "collection.yml"
	folderMeta     = "folder.yml"
	workspaceMeta  = "workspace.yml"
	requestsDir    = "requests"
	envsDir        = "environments"
	testsDir       = "tests"
	localSuffix    = ".local.yml"
	// orderMeta guarda a ordem manual de filhos (folders + requests) de um
	// container. Começa com "." — slugify nunca produz nome com ponto inicial,
	// então nunca colide com o slug de uma request. Versionável (vai pro git).
	orderMeta     = ".putch-order.yml"
	gitignoreLine = "**/*.local.yml"

	defaultWorkspaceName = "Padrão"
)

// Tipos de domínio expostos aos services (com workspace_id/collection_id/
// folder_id já reconstruídos a partir do caminho).

type Workspace struct {
	ID            string
	Name          string
	Description   string
	Color         string
	Icon          string
	Pinned        bool
	CreatedAt     string
	CreatedAuthor string
	UpdatedAt     string
	UpdatedAuthor string
}

type Collection struct {
	ID            string
	Name          string
	Description   string
	Pinned        bool
	Deprecated    bool
	Bg            int
	CreatedAt     string
	CreatedAuthor string
	UpdatedAt     string
	UpdatedAuthor string
}

type Folder struct {
	ID           string
	Name         string
	CollectionID string
	// ParentID é o folder pai ("" = folder direto na coleção). Derivado da
	// estrutura de diretórios aninhados durante o scan — não persistido no
	// YAML (a hierarquia é o próprio caminho, igual a CollectionID/FolderID).
	ParentID  string
	CreatedAt string
}

type Request struct {
	ID           string
	Name         string
	CollectionID string
	FolderID     string
	URL          string
	Method       string
	Headers      map[string]string
	// Params são query params estruturados, mesclados na URL no envio.
	Params map[string]string
	Body   string
	// BodyType: "" | "raw" | "form" | "multipart". "form" usa Form
	// (x-www-form-urlencoded); "multipart" usa Form (campos texto) + Files
	// (campo → caminho de arquivo local). "raw"/"" usa Body cru.
	BodyType string
	Form     map[string]string
	Files    map[string]string
	// AuthType: "" | "none" | "bearer" | "basic" | "apikey". AuthValue depende
	// do tipo (token; "user:senha"; "Header:valor"). Persistido como qualquer
	// outro campo — segredos devem usar {{var}} de env (igual a URL/headers).
	AuthType  string
	AuthValue string
	// TimeoutMS sobrescreve o timeout global do client (0 = usa o global).
	TimeoutMS int
	// PreScript/PostScript são JavaScript estilo Postman: pre roda antes do
	// envio (pode mutar a request e variáveis); post roda depois (asserções
	// via pm.test, pode capturar variáveis). Vazio = sem script.
	PreScript  string
	PostScript string
	IsFavorite bool
	IsActive   bool
	CreatedAt  string
}

type Environment struct {
	ID          string
	Name        string
	WorkspaceID string
	Description string
	Pinned      bool
	Deprecated  bool
	Variables   map[string]string // mescla de versionado + .local
	Secret      []string
	CreatedAt   string
	UpdatedAt   string
}

// TestAssertion é uma checagem aplicada ao response de um passo.
//
//	Type     status | body_contains | header_exists | jsonpath
//	Target   chave/caminho (header_exists/jsonpath); ignorado em status
//	Expected valor esperado (status code, substring, valor do jsonpath)
type TestAssertion struct {
	Type     string
	Target   string
	Expected string
}

// TestCapture extrai um valor do response de um passo para uma variável,
// reutilizável como {{Var}} nos passos seguintes. From: "json" (jsonpath no
// corpo) | "header" | "status".
type TestCapture struct {
	Var  string
	From string
	Path string
}

// TestStep é um passo da suíte: executa uma request (por id), valida o
// response com as asserções e captura variáveis para os próximos passos.
type TestStep struct {
	Name       string
	RequestID  string
	Assertions []TestAssertion
	Captures   []TestCapture
}

// Test é uma suíte que encadeia várias requests numa sequência.
type Test struct {
	ID          string
	Name        string
	WorkspaceID string
	CreatedAt   string
	Steps       []TestStep
}

type Store struct {
	Root        string // pasta versionada por git, pai dos workspaces
	WorkspaceID string // workspace ativo; todas as ops são escopadas nele

	// O Wails dispara cada chamada de serviço em sua própria goroutine, então
	// dois Create/Update concorrentes podiam ler o snapshot, calcular o mesmo
	// slug único e gravar por cima um do outro (TOCTOU em uniqueFile/uniqueDir,
	// lost-update). mu serializa todo o read-modify-write do store. Os helpers
	// internos (snapshot, ensure*, *Locked) NÃO travam — quem trava é o método
	// público de entrada.
	mu sync.Mutex
}

// lock trava o store e devolve a função de unlock, para uso idiomático
// `defer s.lock()()` no topo de cada método público.
func (s *Store) lock() func() {
	s.mu.Lock()
	return s.mu.Unlock
}

// DefaultRoot é o workspace root padrão: ~/.config/putch/workspace. Fonte
// única usada por Open() e pelo reset de pasta na UI.
func DefaultRoot() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("user config dir: %w", err)
	}
	return filepath.Join(dir, "putch", "workspace"), nil
}

// Open prepara o root padrão, garante o .gitignore, migra layout legado e
// garante ao menos um workspace ativo.
func Open() (*Store, error) {
	root, err := DefaultRoot()
	if err != nil {
		return nil, err
	}
	return OpenAt(root)
}

func OpenAt(root string) (*Store, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, fmt.Errorf("criar workspace root: %w", err)
	}
	s := &Store{Root: root}
	if err := s.ensureGitignore(); err != nil {
		return nil, err
	}
	if err := s.migrateLegacyLayout(); err != nil {
		return nil, fmt.Errorf("migrar layout legado: %w", err)
	}
	if err := s.ensureActiveWorkspace(); err != nil {
		return nil, err
	}
	return s, nil
}

// SetRoot aponta o store para outro root em runtime (troca de pasta pela UI).
// Reaplica gitignore, migração e workspace ativo para o novo root.
func (s *Store) SetRoot(root string) error {
	defer s.lock()()
	root = strings.TrimSpace(root)
	if root == "" {
		return fmt.Errorf("caminho do workspace vazio")
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return fmt.Errorf("criar workspace root: %w", err)
	}
	s.Root = root
	s.WorkspaceID = ""
	if err := s.ensureGitignore(); err != nil {
		return err
	}
	if err := s.migrateLegacyLayout(); err != nil {
		return fmt.Errorf("migrar layout legado: %w", err)
	}
	return s.ensureActiveWorkspace()
}

// SetWorkspace troca o workspace ativo. Valida que o id existe no root atual.
func (s *Store) SetWorkspace(id string) error {
	defer s.lock()()
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("workspace id vazio")
	}
	if _, err := s.workspacePathByID(id); err != nil {
		return err
	}
	s.WorkspaceID = id
	return nil
}

// ensureActiveWorkspace garante que s.WorkspaceID aponta para um workspace
// existente: cria "Padrão" se o root estiver vazio; se o ativo for inválido,
// cai no mais recente.
// Usa os helpers internos (sem lock): é chamado de OpenAt (construtor, sem
// concorrência) e de SetRoot (que já segura o lock) — chamar os métodos
// públicos ListWorkspaces/CreateWorkspace aqui daria deadlock reentrante.
func (s *Store) ensureActiveWorkspace() error {
	wss, err := s.listWorkspaces()
	if err != nil {
		return err
	}
	if len(wss) == 0 {
		w, err := s.createWorkspace(WorkspaceInput{Name: defaultWorkspaceName})
		if err != nil {
			return err
		}
		s.WorkspaceID = w.ID
		return nil
	}
	if s.WorkspaceID != "" {
		for _, w := range wss {
			if w.ID == s.WorkspaceID {
				return nil
			}
		}
	}
	s.WorkspaceID = wss[0].ID
	return nil
}

func (s *Store) ensureGitignore() error {
	path := filepath.Join(s.Root, ".gitignore")
	b, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	for ln := range strings.SplitSeq(string(b), "\n") {
		if strings.TrimSpace(ln) == gitignoreLine {
			return nil
		}
	}
	content := string(b)
	if content != "" && !strings.HasSuffix(content, "\n") {
		content += "\n"
	}
	content += gitignoreLine + "\n"
	return os.WriteFile(path, []byte(content), 0o644)
}

// migrateLegacyLayout move o layout antigo (collections direto no root, envs
// dentro de cada collection) para um workspace "Padrão". É no-op se já existe
// algum workspace ou se não há collection legada solta no root.
func (s *Store) migrateLegacyLayout() error {
	entries, err := os.ReadDir(s.Root)
	if err != nil {
		return err
	}
	var legacyCols []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		dir := filepath.Join(s.Root, e.Name())
		if _, err := readYAML[idOnly](filepath.Join(dir, workspaceMeta)); err == nil {
			return nil // já existe workspace: nada a migrar
		}
		if _, err := readYAML[idOnly](filepath.Join(dir, collectionMeta)); err == nil {
			legacyCols = append(legacyCols, e.Name())
		}
	}
	if len(legacyCols) == 0 {
		return nil
	}

	// Escolhe um slug de workspace que não colida com collection legada.
	wsSlug := slugify(defaultWorkspaceName)
	taken := map[string]bool{}
	for _, c := range legacyCols {
		taken[c] = true
	}
	for taken[wsSlug] {
		wsSlug += "-ws"
	}
	wsPath := filepath.Join(s.Root, wsSlug)
	w := Workspace{ID: newID(), Name: defaultWorkspaceName, CreatedAt: now()}
	if err := writeYAML(filepath.Join(wsPath, workspaceMeta),
		workspaceFile{ID: w.ID, Name: w.Name, CreatedAt: w.CreatedAt}); err != nil {
		return err
	}

	envDst := filepath.Join(wsPath, envsDir)
	for _, name := range legacyCols {
		src := filepath.Join(s.Root, name)
		dst := filepath.Join(wsPath, name)
		if err := os.Rename(src, dst); err != nil {
			return err
		}
		// Sobe os environments que viviam dentro da collection para o nível
		// do workspace (compartilhados).
		legacyEnv := filepath.Join(dst, envsDir)
		ents, err := os.ReadDir(legacyEnv)
		if err != nil {
			continue
		}
		for _, ee := range ents {
			if ee.IsDir() || !strings.HasSuffix(ee.Name(), ".yml") {
				continue
			}
			if strings.HasSuffix(ee.Name(), localSuffix) {
				continue // movido junto com o .yml versionado
			}
			ef, err := readYAML[idOnly](filepath.Join(legacyEnv, ee.Name()))
			if err != nil {
				continue
			}
			base := uniqueFile(envDst, strings.TrimSuffix(ee.Name(), ".yml"), ef.ID)
			from := filepath.Join(legacyEnv, ee.Name())
			to := filepath.Join(envDst, base+".yml")
			if err := os.MkdirAll(envDst, 0o755); err != nil {
				return err
			}
			_ = os.Rename(from, to)
			lp := localPath(from)
			if _, err := os.Stat(lp); err == nil {
				_ = os.Rename(lp, localPath(to))
			}
		}
		_ = os.RemoveAll(legacyEnv)
	}
	s.WorkspaceID = w.ID
	return nil
}

// ---- slug ------------------------------------------------------------------

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(name string) string {
	s := nonSlug.ReplaceAllString(strings.ToLower(strings.TrimSpace(name)), "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "sem-nome"
	}
	return s
}

type idOnly struct {
	ID string `yaml:"id"`
}

func candidateName(base, selfID string, i int) string {
	switch {
	case i == 1:
		return base + "-" + shortID(selfID)
	case i > 1:
		return fmt.Sprintf("%s-%s-%d", base, shortID(selfID), i)
	default:
		return base
	}
}

// uniqueFile retorna um slug .yml único dentro de dir, ignorando o próprio
// arquivo da entidade selfID. Em colisão acrescenta um pedaço do id.
func uniqueFile(dir, name, selfID string) string {
	base := slugify(name)
	for i := 0; ; i++ {
		cand := candidateName(base, selfID, i)
		ex, err := readYAML[idOnly](filepath.Join(dir, cand+".yml"))
		if os.IsNotExist(err) || (err == nil && ex.ID == selfID) {
			return cand
		}
	}
}

// uniqueDir retorna um nome de pasta único em parent (workspace/collection/
// folder), identificada pelo id em meta. avoidReserved evita colidir com
// requests//environments//tests/.
func uniqueDir(parent, name, meta, selfID string, avoidReserved bool) string {
	base := slugify(name)
	for i := 0; ; i++ {
		cand := candidateName(base, selfID, i)
		if avoidReserved && reservedName(cand) {
			continue
		}
		ex, err := readYAML[idOnly](filepath.Join(parent, cand, meta))
		if os.IsNotExist(err) || (err == nil && ex.ID == selfID) {
			return cand
		}
	}
}

func reservedName(n string) bool {
	return n == requestsDir || n == envsDir || n == testsDir
}

func shortID(id string) string {
	id = strings.ReplaceAll(id, "-", "")
	if len(id) > 6 {
		return id[:6]
	}
	if id == "" {
		return "x"
	}
	return id
}

// ---- snapshot --------------------------------------------------------------
//
// Releitura completa a cada operação: sem cache, logo sem bug de coerência (e
// coleções de API são pequenas). Lista todos os workspaces do root e, para o
// workspace ativo, reconstrói a hierarquia e os caminhos físicos.

type snapshot struct {
	workspaces  []Workspace
	collections []Collection
	folders     []Folder
	requests    []Request
	envs        []Environment
	tests       []Test

	wsDir    map[string]string // workspaceID -> caminho da pasta
	colDir   map[string]string // collectionID -> caminho da pasta
	folDir   map[string]string // folderID -> caminho da pasta
	reqPath  map[string]string // requestID -> caminho do arquivo
	envPath  map[string]string // envID -> caminho do .yml versionado
	testPath map[string]string // testID -> caminho do arquivo
	// order: orderKey(colID, folderID) -> ordem manual dos ids filhos
	// (folders + requests). "" de folderID = raiz da coleção.
	order map[string][]string
}

// orderKey identifica um container de ordenação: a raiz de uma coleção
// (folderID == "") ou um folder específico.
func orderKey(collectionID, folderID string) string {
	return collectionID + "\x00" + folderID
}

func (s *Store) snapshot() (*snapshot, error) {
	snap := &snapshot{
		wsDir:    map[string]string{},
		colDir:   map[string]string{},
		folDir:   map[string]string{},
		reqPath:  map[string]string{},
		envPath:  map[string]string{},
		testPath: map[string]string{},
		order:    map[string][]string{},
	}
	entries, err := os.ReadDir(s.Root)
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		wsPath := filepath.Join(s.Root, e.Name())
		wf, err := readYAML[workspaceFile](filepath.Join(wsPath, workspaceMeta))
		if err != nil {
			continue // pasta que não é workspace
		}
		snap.workspaces = append(snap.workspaces, fromWorkspaceFile(wf))
		snap.wsDir[wf.ID] = wsPath
	}

	wsPath, ok := snap.wsDir[s.WorkspaceID]
	if !ok {
		return snap, nil // sem workspace ativo válido: só a lista de workspaces
	}
	if err := s.scanWorkspace(snap, s.WorkspaceID, wsPath); err != nil {
		return nil, err
	}
	return snap, nil
}

func (s *Store) scanWorkspace(snap *snapshot, wsID, wsPath string) error {
	subs, err := os.ReadDir(wsPath)
	if err != nil {
		return err
	}
	for _, sub := range subs {
		name := sub.Name()
		switch {
		case !sub.IsDir():
			continue
		case name == envsDir:
			s.scanEnvironments(snap, wsID, filepath.Join(wsPath, name))
		case name == testsDir:
			s.scanTests(snap, wsID, filepath.Join(wsPath, name))
		default: // pasta de collection
			colPath := filepath.Join(wsPath, name)
			cf, err := readYAML[collectionFile](filepath.Join(colPath, collectionMeta))
			if err != nil {
				continue
			}
			col := fromCollectionFile(cf)
			snap.collections = append(snap.collections, col)
			snap.colDir[col.ID] = colPath
			if err := s.scanCollection(snap, col.ID, colPath); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Store) scanCollection(snap *snapshot, colID, colPath string) error {
	subs, err := os.ReadDir(colPath)
	if err != nil {
		return err
	}
	for _, sub := range subs {
		name := sub.Name()
		switch {
		case !sub.IsDir():
			continue
		case name == requestsDir:
			s.scanRequests(snap, colID, "", filepath.Join(colPath, name))
		default: // pasta de usuário (folder de topo da coleção)
			if err := s.scanFolder(snap, colID, "", filepath.Join(colPath, name)); err != nil {
				return err
			}
		}
	}
	// Ordem manual da raiz da coleção (folders de topo + requests soltas).
	if of, err := readYAML[orderFile](filepath.Join(colPath, orderMeta)); err == nil {
		snap.order[orderKey(colID, "")] = of.Order
	}
	return nil
}

// scanFolder lê um folder e, recursivamente, seus subfolders. parentID é o
// folder pai ("" = folder direto na coleção). Diretório sem folder.yml não é
// um folder válido — ignora em silêncio (pode ser lixo/temporário).
func (s *Store) scanFolder(snap *snapshot, colID, parentID, folPath string) error {
	ff, err := readYAML[folderFile](filepath.Join(folPath, folderMeta))
	if err != nil {
		return nil
	}
	fid := ff.ID
	snap.folders = append(snap.folders, Folder{
		ID: fid, Name: ff.Name, CollectionID: colID, ParentID: parentID, CreatedAt: ff.CreatedAt,
	})
	snap.folDir[fid] = folPath

	entries, err := os.ReadDir(folPath)
	if err != nil {
		return err
	}
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() {
			if err := s.scanFolder(snap, colID, fid, filepath.Join(folPath, name)); err != nil {
				return err
			}
			continue
		}
		if name == folderMeta || name == orderMeta || !strings.HasSuffix(name, ".yml") {
			continue
		}
		path := filepath.Join(folPath, name)
		rf, err := readYAML[requestFile](path)
		if err != nil {
			continue
		}
		snap.requests = append(snap.requests, requestFromFile(rf, colID, fid))
		snap.reqPath[rf.ID] = path
	}
	if of, err := readYAML[orderFile](filepath.Join(folPath, orderMeta)); err == nil {
		snap.order[orderKey(colID, fid)] = of.Order
	}
	return nil
}

func (s *Store) scanRequests(snap *snapshot, colID, folID, dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || name == folderMeta || name == orderMeta || !strings.HasSuffix(name, ".yml") {
			continue
		}
		path := filepath.Join(dir, name)
		rf, err := readYAML[requestFile](path)
		if err != nil {
			continue
		}
		snap.requests = append(snap.requests, requestFromFile(rf, colID, folID))
		snap.reqPath[rf.ID] = path
	}
}

// requestFromFile monta o Request de domínio a partir do DTO em disco. colID/
// folID vêm da posição física (a hierarquia é o caminho, não o YAML).
func requestFromFile(rf requestFile, colID, folID string) Request {
	return Request{
		ID: rf.ID, Name: rf.Name, CollectionID: colID, FolderID: folID,
		URL: rf.URL, Method: rf.Method, Headers: rf.Headers,
		Params: rf.Params, Body: string(rf.Body),
		BodyType: rf.BodyType, Form: rf.Form, Files: rf.Files,
		AuthType: rf.AuthType, AuthValue: rf.AuthValue,
		TimeoutMS:  rf.TimeoutMS,
		PreScript:  string(rf.PreScript),
		PostScript: string(rf.PostScript),
		IsFavorite: rf.Favorite, IsActive: rf.Active,
		CreatedAt: rf.CreatedAt,
	}
}

func (s *Store) scanEnvironments(snap *snapshot, wsID, dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yml") || strings.HasSuffix(e.Name(), localSuffix) {
			continue
		}
		path := filepath.Join(dir, e.Name())
		ef, err := readYAML[environmentFile](path)
		if err != nil {
			continue
		}
		vars := map[string]string{}
		maps.Copy(vars, ef.Variables)
		localFile := strings.TrimSuffix(path, ".yml") + localSuffix
		if lf, err := readYAML[environmentLocalFile](localFile); err == nil {
			maps.Copy(vars, lf.Variables)
		}
		snap.envs = append(snap.envs, Environment{
			ID: ef.ID, Name: ef.Name, WorkspaceID: wsID,
			Description: ef.Description, Pinned: ef.Pinned, Deprecated: ef.Deprecated,
			Variables: vars, Secret: ef.Secret,
			CreatedAt: ef.CreatedAt, UpdatedAt: ef.UpdatedAt,
		})
		snap.envPath[ef.ID] = path
	}
}

func (s *Store) scanTests(snap *snapshot, wsID, dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".yml") {
			continue
		}
		path := filepath.Join(dir, e.Name())
		tf, err := readYAML[testFile](path)
		if err != nil {
			continue
		}
		snap.tests = append(snap.tests, fromTestFile(tf, wsID))
		snap.testPath[tf.ID] = path
	}
}
