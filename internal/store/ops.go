package store

import (
	"errors"
	"os"
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

// ---- Collections -----------------------------------------------------------

func (s *Store) ListCollections() ([]Collection, error) {
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	return snap.collections, nil
}

func (s *Store) GetCollection(id string) (Collection, error) {
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

func (s *Store) CreateCollection(name string) (Collection, error) {
	c := Collection{ID: newID(), Name: name, CreatedAt: now()}
	dir := uniqueDir(s.Root, name, collectionMeta, c.ID, false)
	path := filepath.Join(s.Root, dir, collectionMeta)
	if err := writeYAML(path, collectionFile{ID: c.ID, Name: c.Name, CreatedAt: c.CreatedAt}); err != nil {
		return Collection{}, err
	}
	return c, nil
}

func (s *Store) UpdateCollection(id, name string) error {
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
	if err := writeYAML(filepath.Join(dir, collectionMeta),
		collectionFile{ID: id, Name: name, CreatedAt: cur.CreatedAt}); err != nil {
		return err
	}
	return renameDir(dir, filepath.Join(s.Root, uniqueDir(s.Root, name, collectionMeta, id, false)))
}

func (s *Store) DeleteCollection(id string) error {
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
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	return snap.requests, nil
}

func (s *Store) ListRequestsByCollection(collectionID string) ([]Request, error) {
	return s.filterRequests(func(r Request) bool { return r.CollectionID == collectionID })
}

func (s *Store) ListRequestsByFolder(folderID string) ([]Request, error) {
	return s.filterRequests(func(r Request) bool { return r.FolderID == folderID })
}

func (s *Store) SearchRequests(query string) ([]Request, error) {
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
		Headers: r.Headers, Body: literalString(r.Body),
		Favorite: r.IsFavorite, Active: r.IsActive, CreatedAt: r.CreatedAt,
	}
}

// ---- Environments ----------------------------------------------------------

func (s *Store) ListEnvironments(collectionID string) ([]Environment, error) {
	snap, err := s.snapshot()
	if err != nil {
		return nil, err
	}
	out := []Environment{}
	for _, e := range snap.envs {
		if collectionID == "" || e.CollectionID == collectionID {
			out = append(out, e)
		}
	}
	return out, nil
}

func (s *Store) GetEnvironment(id string) (*Environment, error) {
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

func (s *Store) CreateEnvironment(collectionID, name string, vars map[string]string) (Environment, error) {
	snap, err := s.snapshot()
	if err != nil {
		return Environment{}, err
	}
	colPath, ok := snap.colDir[collectionID]
	if !ok {
		return Environment{}, ErrNotFound
	}
	dir := filepath.Join(colPath, envsDir)
	e := Environment{
		ID: newID(), Name: name, CollectionID: collectionID,
		Variables: vars, CreatedAt: now(),
	}
	if e.Variables == nil {
		e.Variables = map[string]string{}
	}
	base := uniqueFile(dir, name, e.ID)
	if err := s.writeEnv(filepath.Join(dir, base+".yml"), e, nil); err != nil {
		return Environment{}, err
	}
	e.Secret = secretKeys(e.Variables, nil)
	return e, nil
}

func (s *Store) UpdateEnvironment(id, name string, vars map[string]string) error {
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
	if vars == nil {
		vars = map[string]string{}
	}
	e := Environment{
		ID: id, Name: name, CollectionID: cur.CollectionID,
		Variables: vars, CreatedAt: cur.CreatedAt,
	}
	dir := filepath.Dir(oldPath)
	newPath := filepath.Join(dir, uniqueFile(dir, name, id)+".yml")
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
		ID: e.ID, Name: e.Name, CreatedAt: e.CreatedAt,
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

func renameDir(oldPath, newPath string) error {
	if oldPath == newPath {
		return nil
	}
	return os.Rename(oldPath, newPath)
}
