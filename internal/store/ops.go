package store

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ErrNotFound é retornado quando uma entidade não existe; os services o
// traduzem para mensagens de domínio.
var ErrNotFound = errors.New("não encontrado")

func now() string   { return time.Now().UTC().Format(time.RFC3339) }
func newID() string { return uuid.NewString() }

// ---- Workspaces ------------------------------------------------------------

// workspacePathByID faz um scan raso do root procurando a pasta cujo
// workspace.yml tem o id dado.
func (s *Store) workspacePathByID(id string) (string, error) {
	entries, err := os.ReadDir(s.Root)
	if err != nil {
		return "", err
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		p := filepath.Join(s.Root, e.Name())
		wf, err := readYAML[idOnly](filepath.Join(p, workspaceMeta))
		if err == nil && wf.ID == id {
			return p, nil
		}
	}
	return "", ErrNotFound
}

// activeWorkspacePath resolve a pasta do workspace ativo.
func (s *Store) activeWorkspacePath() (string, error) {
	if strings.TrimSpace(s.WorkspaceID) == "" {
		return "", ErrNotFound
	}
	return s.workspacePathByID(s.WorkspaceID)
}

func (s *Store) ListWorkspaces() ([]Workspace, error) {
	defer s.lock()()
	return s.listWorkspaces()
}

// listWorkspaces é a versão sem lock, usada por ensureActiveWorkspace (que já
// roda sob o lock de SetRoot ou sem concorrência no construtor).
func (s *Store) listWorkspaces() ([]Workspace, error) {
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	out := append([]Workspace{}, snap.workspaces...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt > out[j].CreatedAt })
	return out, nil
}

func (s *Store) GetWorkspace(id string) (Workspace, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return Workspace{}, err
	}
	for _, w := range snap.workspaces {
		if w.ID == id {
			return w, nil
		}
	}
	return Workspace{}, ErrNotFound
}

// WorkspaceInput são os campos editáveis de um workspace. CreatedAt/​
// UpdatedAt e os autores são geridos pelo store, não pelo chamador.
type WorkspaceInput struct {
	Name        string
	Description string
	Color       string
	Icon        string
	Pinned      bool
}

func (s *Store) CreateWorkspace(in WorkspaceInput) (Workspace, error) {
	defer s.lock()()
	return s.createWorkspace(in)
}

// createWorkspace é a versão sem lock, usada por ensureActiveWorkspace.
func (s *Store) createWorkspace(in WorkspaceInput) (Workspace, error) {
	ts := now()
	author := gitAuthor(s.Root)
	w := Workspace{
		ID:            newID(),
		Name:          in.Name,
		Description:   in.Description,
		Color:         in.Color,
		Icon:          in.Icon,
		Pinned:        in.Pinned,
		CreatedAt:     ts,
		CreatedAuthor: author,
		UpdatedAt:     ts,
		UpdatedAuthor: author,
	}
	dir := uniqueDir(s.Root, w.Name, workspaceMeta, w.ID, false)
	path := filepath.Join(s.Root, dir, workspaceMeta)
	if err := writeYAML(path, toWorkspaceFile(w)); err != nil {
		return Workspace{}, err
	}
	return w, nil
}

func (s *Store) UpdateWorkspace(id string, in WorkspaceInput) error {
	defer s.lock()()
	dir, err := s.workspacePathByID(id)
	if err != nil {
		return err
	}
	cur, _ := readYAML[workspaceFile](filepath.Join(dir, workspaceMeta))
	w := fromWorkspaceFile(cur)
	// Preserva a procedência de criação; só toca o que o usuário editou e os
	// metadados de modificação.
	w.ID = id
	w.Name = in.Name
	w.Description = in.Description
	w.Color = in.Color
	w.Icon = in.Icon
	w.Pinned = in.Pinned
	w.UpdatedAt = now()
	w.UpdatedAuthor = gitAuthor(s.Root)
	if err := writeYAML(filepath.Join(dir, workspaceMeta), toWorkspaceFile(w)); err != nil {
		return err
	}
	return renameDir(dir, filepath.Join(s.Root, uniqueDir(s.Root, w.Name, workspaceMeta, id, false)))
}

func (s *Store) DeleteWorkspace(id string) error {
	defer s.lock()()
	dir, err := s.workspacePathByID(id)
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return os.RemoveAll(dir)
}

// ---- Collections -----------------------------------------------------------

func (s *Store) ListCollections() ([]Collection, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	return snap.collections, nil
}

// CollectionRequestCounts conta as requests de cada collection do workspace
// ativo (inclui as soltas em requests/ e as dentro de folders). Derivado do
// snapshot — não é persistido.
func (s *Store) CollectionRequestCounts() (map[string]int, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	counts := make(map[string]int, len(snap.collections))
	for _, r := range snap.requests {
		counts[r.CollectionID]++
	}
	return counts, nil
}

func (s *Store) GetCollection(id string) (Collection, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return Collection{}, err
	}
	for _, c := range snap.collections {
		if c.ID == id {
			return c, nil
		}
	}
	return Collection{}, ErrNotFound
}

// CollectionInput são os campos editáveis de uma collection. CreatedAt/​
// UpdatedAt e os autores são geridos pelo store, não pelo chamador. O Bg é
// escolhido pelo usuário na criação e pode ser alterado na edição.
type CollectionInput struct {
	Name        string
	Description string
	Pinned      bool
	Deprecated  bool
	Bg          int
}

// gitAuthor resolve o autor (git config user.name) executado em dir. É
// best-effort: o app é local-first e versionado por git (mesma fonte de autor
// dos commits), então uma config ausente apenas resulta em autor vazio.
func gitAuthor(dir string) string {
	out, err := exec.Command("git", "-C", dir, "config", "user.name").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func (s *Store) CreateCollection(in CollectionInput) (Collection, error) {
	defer s.lock()()
	wsPath, err := s.activeWorkspacePath()
	if err != nil {
		return Collection{}, err
	}
	ts := now()
	author := gitAuthor(wsPath)
	c := Collection{
		ID:            newID(),
		Name:          in.Name,
		Description:   in.Description,
		Pinned:        in.Pinned,
		Deprecated:    in.Deprecated,
		Bg:            in.Bg,
		CreatedAt:     ts,
		CreatedAuthor: author,
		UpdatedAt:     ts,
		UpdatedAuthor: author,
	}
	dir := uniqueDir(wsPath, c.Name, collectionMeta, c.ID, false)
	path := filepath.Join(wsPath, dir, collectionMeta)
	if err := writeYAML(path, toCollectionFile(c)); err != nil {
		return Collection{}, err
	}
	return c, nil
}

func (s *Store) UpdateCollection(id string, in CollectionInput) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	dir, ok := snap.colDir[id]
	if !ok {
		return ErrNotFound
	}
	var cur Collection
	for _, c := range snap.collections {
		if c.ID == id {
			cur = c
		}
	}
	wsPath := filepath.Dir(dir)
	// Preserva a procedência de criação; só toca o que o usuário editou e os
	// metadados de modificação.
	cur.Name = in.Name
	cur.Description = in.Description
	cur.Pinned = in.Pinned
	cur.Deprecated = in.Deprecated
	cur.Bg = in.Bg
	cur.UpdatedAt = now()
	cur.UpdatedAuthor = gitAuthor(wsPath)
	if err := writeYAML(filepath.Join(dir, collectionMeta), toCollectionFile(cur)); err != nil {
		return err
	}
	return renameDir(dir, filepath.Join(wsPath, uniqueDir(wsPath, cur.Name, collectionMeta, id, false)))
}

func (s *Store) DeleteCollection(id string) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	dir, ok := snap.colDir[id]
	if !ok {
		return nil
	}
	return os.RemoveAll(dir)
}

// ---- Folders ---------------------------------------------------------------

func (s *Store) ListFolders(collectionID string) ([]Folder, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	out := []Folder{}
	for _, f := range snap.folders {
		if f.CollectionID == collectionID {
			out = append(out, f)
		}
	}
	return out, nil
}

func (s *Store) GetFolder(id string) (Folder, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return Folder{}, err
	}
	for _, f := range snap.folders {
		if f.ID == id {
			return f, nil
		}
	}
	return Folder{}, ErrNotFound
}

func (s *Store) CreateFolder(collectionID, name string) (Folder, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return Folder{}, err
	}
	colPath, ok := snap.colDir[collectionID]
	if !ok {
		return Folder{}, ErrNotFound
	}
	f := Folder{ID: newID(), Name: name, CollectionID: collectionID, CreatedAt: now()}
	dir := uniqueDir(colPath, name, folderMeta, f.ID, true)
	path := filepath.Join(colPath, dir, folderMeta)
	if err := writeYAML(path, folderFile{ID: f.ID, Name: f.Name, CreatedAt: f.CreatedAt}); err != nil {
		return Folder{}, err
	}
	return f, nil
}

func (s *Store) UpdateFolder(id, name string) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	dir, ok := snap.folDir[id]
	if !ok {
		return ErrNotFound
	}
	var cur Folder
	for _, f := range snap.folders {
		if f.ID == id {
			cur = f
		}
	}
	if err := writeYAML(filepath.Join(dir, folderMeta),
		folderFile{ID: id, Name: name, CreatedAt: cur.CreatedAt}); err != nil {
		return err
	}
	colPath := snap.colDir[cur.CollectionID]
	return renameDir(dir, filepath.Join(colPath, uniqueDir(colPath, name, folderMeta, id, true)))
}

func (s *Store) DeleteFolder(id string) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	dir, ok := snap.folDir[id]
	if !ok {
		return nil
	}
	return os.RemoveAll(dir)
}

// ---- Requests --------------------------------------------------------------

func (s *Store) ListRequests() ([]Request, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	return snap.requests, nil
}

func (s *Store) ListRequestsByCollection(collectionID string) ([]Request, error) {
	defer s.lock()()
	return s.filterRequests(func(r Request) bool { return r.CollectionID == collectionID })
}

func (s *Store) ListRequestsByFolder(folderID string) ([]Request, error) {
	defer s.lock()()
	return s.filterRequests(func(r Request) bool { return r.FolderID == folderID })
}

func (s *Store) SearchRequests(query string) ([]Request, error) {
	defer s.lock()()
	q := strings.ToLower(query)
	return s.filterRequests(func(r Request) bool {
		return strings.Contains(strings.ToLower(r.Name), q) ||
			strings.Contains(strings.ToLower(r.URL), q)
	})
}

func (s *Store) filterRequests(keep func(Request) bool) ([]Request, error) {
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	out := []Request{}
	for _, r := range snap.requests {
		if keep(r) {
			out = append(out, r)
		}
	}
	return out, nil
}

func (s *Store) GetRequest(id string) (Request, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return Request{}, err
	}
	for _, r := range snap.requests {
		if r.ID == id {
			return r, nil
		}
	}
	return Request{}, ErrNotFound
}

// requestDir resolve a pasta física de um request: a pasta do folder se
// folderID != "", senão <collection>/requests.
func (s *Store) requestDir(snap *snapshot, collectionID, folderID string) (string, error) {
	if strings.TrimSpace(folderID) != "" {
		dir, ok := snap.folDir[folderID]
		if !ok {
			return "", ErrNotFound
		}
		return dir, nil
	}
	colPath, ok := snap.colDir[collectionID]
	if !ok {
		return "", ErrNotFound
	}
	return filepath.Join(colPath, requestsDir), nil
}

func (s *Store) CreateRequest(in Request) (Request, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return Request{}, err
	}
	dir, err := s.requestDir(snap, in.CollectionID, in.FolderID)
	if err != nil {
		return Request{}, err
	}
	in.ID = newID()
	in.CreatedAt = now()
	in.IsActive = true
	in.IsFavorite = false
	if in.Headers == nil {
		in.Headers = map[string]string{}
	}
	base := uniqueFile(dir, in.Name, in.ID)
	if err := writeYAML(filepath.Join(dir, base+".yml"), toRequestFile(in)); err != nil {
		return Request{}, err
	}
	return in, nil
}

func (s *Store) UpdateRequest(id string, in Request) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	oldPath, ok := snap.reqPath[id]
	if !ok {
		return ErrNotFound
	}
	var cur Request
	for _, r := range snap.requests {
		if r.ID == id {
			cur = r
		}
	}
	in.ID = id
	in.CollectionID = cur.CollectionID
	in.CreatedAt = cur.CreatedAt
	in.IsActive = cur.IsActive
	in.IsFavorite = cur.IsFavorite
	if in.Headers == nil {
		in.Headers = map[string]string{}
	}
	dir, err := s.requestDir(snap, cur.CollectionID, in.FolderID)
	if err != nil {
		return err
	}
	newPath := filepath.Join(dir, uniqueFile(dir, in.Name, id)+".yml")
	if err := writeYAML(newPath, toRequestFile(in)); err != nil {
		return err
	}
	if newPath != oldPath {
		return os.Remove(oldPath)
	}
	return nil
}

func (s *Store) DeleteRequest(id string) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	path, ok := snap.reqPath[id]
	if !ok {
		return nil
	}
	return os.Remove(path)
}

func toRequestFile(r Request) requestFile {
	return requestFile{
		ID: r.ID, Name: r.Name, Method: r.Method, URL: r.URL,
		Params: r.Params, Headers: r.Headers, Body: literalString(r.Body),
		BodyType: r.BodyType, Form: r.Form, Files: r.Files,
		AuthType: r.AuthType, AuthValue: r.AuthValue, TimeoutMS: r.TimeoutMS,
		PreScript: literalString(r.PreScript), PostScript: literalString(r.PostScript),
		Favorite: r.IsFavorite, Active: r.IsActive, CreatedAt: r.CreatedAt,
	}
}

// ---- Environments (nível de workspace) -------------------------------------

// EnvironmentInput são os campos editáveis de um environment. CreatedAt/
// UpdatedAt são geridos pelo store, não pelo chamador. Variables é a mescla
// completa (versionado + secretos); a divisão para .local.yml acontece em
// writeEnv.
type EnvironmentInput struct {
	Name        string
	Description string
	Pinned      bool
	Deprecated  bool
	Variables   map[string]string
}

func (s *Store) ListEnvironments() ([]Environment, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	out := append([]Environment{}, snap.envs...)
	return out, nil
}

func (s *Store) GetEnvironment(id string) (*Environment, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	for _, e := range snap.envs {
		if e.ID == id {
			ec := e
			return &ec, nil
		}
	}
	return nil, nil
}

func (s *Store) CreateEnvironment(in EnvironmentInput) (Environment, error) {
	defer s.lock()()
	wsPath, err := s.activeWorkspacePath()
	if err != nil {
		return Environment{}, err
	}
	dir := filepath.Join(wsPath, envsDir)
	ts := now()
	e := Environment{
		ID: newID(), Name: in.Name, WorkspaceID: s.WorkspaceID,
		Description: in.Description, Pinned: in.Pinned, Deprecated: in.Deprecated,
		Variables: in.Variables, CreatedAt: ts, UpdatedAt: ts,
	}
	if e.Variables == nil {
		e.Variables = map[string]string{}
	}
	base := uniqueFile(dir, e.Name, e.ID)
	if err := s.writeEnv(filepath.Join(dir, base+".yml"), e, nil); err != nil {
		return Environment{}, err
	}
	e.Secret = secretKeys(e.Variables, nil)
	return e, nil
}

func (s *Store) UpdateEnvironment(id string, in EnvironmentInput) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	oldPath, ok := snap.envPath[id]
	if !ok {
		return ErrNotFound
	}
	var cur Environment
	for _, e := range snap.envs {
		if e.ID == id {
			cur = e
		}
	}
	vars := in.Variables
	if vars == nil {
		vars = map[string]string{}
	}
	// Preserva CreatedAt; só toca o que o usuário editou e o UpdatedAt.
	e := Environment{
		ID: id, Name: in.Name, WorkspaceID: cur.WorkspaceID,
		Description: in.Description, Pinned: in.Pinned, Deprecated: in.Deprecated,
		Variables: vars, CreatedAt: cur.CreatedAt, UpdatedAt: now(),
	}
	dir := filepath.Dir(oldPath)
	newPath := filepath.Join(dir, uniqueFile(dir, in.Name, id)+".yml")
	if err := s.writeEnv(newPath, e, cur.Secret); err != nil {
		return err
	}
	if newPath != oldPath {
		_ = os.Remove(oldPath)
		_ = os.Remove(localPath(oldPath))
	}
	return nil
}

func (s *Store) DeleteEnvironment(id string) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	path, ok := snap.envPath[id]
	if !ok {
		return nil
	}
	_ = os.Remove(localPath(path))
	return os.Remove(path)
}

func localPath(yml string) string {
	return strings.TrimSuffix(yml, ".yml") + localSuffix
}

// writeEnv grava o environment dividindo segredos: chaves secretas vão para
// o .local.yml (gitignored); o resto fica versionado.
func (s *Store) writeEnv(path string, e Environment, explicit []string) error {
	secret := secretKeys(e.Variables, explicit)
	secretSet := map[string]bool{}
	for _, k := range secret {
		secretSet[k] = true
	}
	committed, local := map[string]string{}, map[string]string{}
	for k, v := range e.Variables {
		if secretSet[k] {
			local[k] = v
		} else {
			committed[k] = v
		}
	}
	ef := environmentFile{
		ID: e.ID, Name: e.Name,
		Description: e.Description, Pinned: e.Pinned, Deprecated: e.Deprecated,
		CreatedAt: e.CreatedAt, UpdatedAt: e.UpdatedAt,
		Secret: secret, Variables: committed,
	}
	if err := writeYAML(path, ef); err != nil {
		return err
	}
	lp := localPath(path)
	if len(local) == 0 {
		_ = os.Remove(lp)
		return nil
	}
	return writeYAML(lp, environmentLocalFile{Variables: local})
}

// secretKeys = lista explícita ∪ heurística por nome, ordenada.
var secretNameRe = regexp.MustCompile(`(?i)(token|secret|password|passwd|pwd|bearer|credential|api[_-]?key|access[_-]?key|private)`)

func secretKeys(vars map[string]string, explicit []string) []string {
	set := map[string]bool{}
	for _, k := range explicit {
		set[k] = true
	}
	for k := range vars {
		if secretNameRe.MatchString(k) {
			set[k] = true
		}
	}
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// ---- Tests (suíte; nível de workspace) -------------------------------------

func (s *Store) ListTests() ([]Test, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	out := append([]Test{}, snap.tests...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt > out[j].CreatedAt })
	return out, nil
}

func (s *Store) GetTest(id string) (Test, error) {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return Test{}, err
	}
	for _, t := range snap.tests {
		if t.ID == id {
			return t, nil
		}
	}
	return Test{}, ErrNotFound
}

func (s *Store) CreateTest(name string, steps []TestStep) (Test, error) {
	defer s.lock()()
	wsPath, err := s.activeWorkspacePath()
	if err != nil {
		return Test{}, err
	}
	dir := filepath.Join(wsPath, testsDir)
	t := Test{
		ID: newID(), Name: name, WorkspaceID: s.WorkspaceID,
		CreatedAt: now(), Steps: steps,
	}
	base := uniqueFile(dir, name, t.ID)
	if err := writeYAML(filepath.Join(dir, base+".yml"), toTestFile(t)); err != nil {
		return Test{}, err
	}
	return t, nil
}

func (s *Store) UpdateTest(id, name string, steps []TestStep) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	oldPath, ok := snap.testPath[id]
	if !ok {
		return ErrNotFound
	}
	var cur Test
	for _, t := range snap.tests {
		if t.ID == id {
			cur = t
		}
	}
	t := Test{
		ID: id, Name: name, WorkspaceID: cur.WorkspaceID,
		CreatedAt: cur.CreatedAt, Steps: steps,
	}
	dir := filepath.Dir(oldPath)
	newPath := filepath.Join(dir, uniqueFile(dir, name, id)+".yml")
	if err := writeYAML(newPath, toTestFile(t)); err != nil {
		return err
	}
	if newPath != oldPath {
		return os.Remove(oldPath)
	}
	return nil
}

func (s *Store) DeleteTest(id string) error {
	defer s.lock()()
	snap, err := s.snapshot()
	if err != nil {
		return err
	}
	path, ok := snap.testPath[id]
	if !ok {
		return nil
	}
	return os.Remove(path)
}

func renameDir(oldPath, newPath string) error {
	if oldPath == newPath {
		return nil
	}
	return os.Rename(oldPath, newPath)
}
