// Package store é a camada de persistência do putch em arquivos YAML.
//
// Layout no workspace (uma pasta por collection):
//
//	<root>/
//	  <collection-slug>/
//	    collection.yml
//	    requests/<request-slug>.yml          # requests sem pasta
//	    <folder-slug>/
//	      folder.yml
//	      <request-slug>.yml                 # requests da pasta
//	    environments/
//	      <env-slug>.yml                     # versionado (sem segredos)
//	      <env-slug>.local.yml               # gitignored (valores secretos)
//	  .gitignore                             # **/*.local.yml
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
)

const (
	collectionMeta = "collection.yml"
	folderMeta     = "folder.yml"
	requestsDir    = "requests"
	envsDir        = "environments"
	localSuffix    = ".local.yml"
	gitignoreLine  = "**/*.local.yml"
)

// Tipos de domínio expostos aos services (com collection_id/folder_id já
// reconstruídos a partir do caminho).

type Collection struct {
	ID        string
	Name      string
	CreatedAt string
}

type Folder struct {
	ID           string
	Name         string
	CollectionID string
	CreatedAt    string
}

type Request struct {
	ID           string
	Name         string
	CollectionID string
	FolderID     string
	URL          string
	Method       string
	Headers      map[string]string
	Body         string
	IsFavorite   bool
	IsActive     bool
	CreatedAt    string
}

type Environment struct {
	ID           string
	Name         string
	CollectionID string
	Variables    map[string]string // mescla de versionado + .local
	Secret       []string
	CreatedAt    string
}

type Store struct {
	Root string
}

// Open prepara o workspace padrão (~/.config/putch/workspace) e garante o
// .gitignore. Se o usuário apontar para um clone existente isso é trocado em
// fase posterior (integração git).
func Open() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("user config dir: %w", err)
	}
	root := filepath.Join(dir, "putch", "workspace")
	return OpenAt(root)
}

func OpenAt(root string) (*Store, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, fmt.Errorf("criar workspace: %w", err)
	}
	s := &Store{Root: root}
	if err := s.ensureGitignore(); err != nil {
		return nil, err
	}
	return s, nil
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

// uniqueDir retorna um nome de pasta único em parent (collection/folder),
// identificada pelo id em meta. avoidReserved evita colidir com requests/.
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

func reservedName(n string) bool { return n == requestsDir || n == envsDir }

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
// Releitura completa do workspace a cada operação: sem cache, logo sem bug de
// coerência (e coleções de API são pequenas). Reconstrói a hierarquia e os
// caminhos físicos de cada entidade.

type snapshot struct {
	collections []Collection
	folders     []Folder
	requests    []Request
	envs        []Environment

	colDir  map[string]string // collectionID -> caminho da pasta
	folDir  map[string]string // folderID -> caminho da pasta
	reqPath map[string]string // requestID -> caminho do arquivo
	envPath map[string]string // envID -> caminho do .yml versionado
}

func (s *Store) snapshot() (*snapshot, error) {
	snap := &snapshot{
		colDir:  map[string]string{},
		folDir:  map[string]string{},
		reqPath: map[string]string{},
		envPath: map[string]string{},
	}
	entries, err := os.ReadDir(s.Root)
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		colPath := filepath.Join(s.Root, e.Name())
		cf, err := readYAML[collectionFile](filepath.Join(colPath, collectionMeta))
		if err != nil {
			continue // pasta que não é collection
		}
		col := Collection{ID: cf.ID, Name: cf.Name, CreatedAt: cf.CreatedAt}
		snap.collections = append(snap.collections, col)
		snap.colDir[col.ID] = colPath

		if err := s.scanCollection(snap, col.ID, colPath); err != nil {
			return nil, err
		}
	}
	return snap, nil
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
		case name == envsDir:
			s.scanEnvironments(snap, colID, filepath.Join(colPath, name))
		default: // pasta de usuário
			folPath := filepath.Join(colPath, name)
			ff, err := readYAML[folderFile](filepath.Join(folPath, folderMeta))
			if err != nil {
				continue
			}
			snap.folders = append(snap.folders, Folder{
				ID: ff.ID, Name: ff.Name, CollectionID: colID, CreatedAt: ff.CreatedAt,
			})
			snap.folDir[ff.ID] = folPath
			s.scanRequests(snap, colID, ff.ID, folPath)
		}
	}
	return nil
}

func (s *Store) scanRequests(snap *snapshot, colID, folID, dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() || e.Name() == folderMeta || !strings.HasSuffix(e.Name(), ".yml") {
			continue
		}
		path := filepath.Join(dir, e.Name())
		rf, err := readYAML[requestFile](path)
		if err != nil {
			continue
		}
		snap.requests = append(snap.requests, Request{
			ID: rf.ID, Name: rf.Name, CollectionID: colID, FolderID: folID,
			URL: rf.URL, Method: rf.Method, Headers: rf.Headers,
			Body: string(rf.Body), IsFavorite: rf.Favorite, IsActive: rf.Active,
			CreatedAt: rf.CreatedAt,
		})
		snap.reqPath[rf.ID] = path
	}
}

func (s *Store) scanEnvironments(snap *snapshot, colID, dir string) {
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
		localPath := strings.TrimSuffix(path, ".yml") + localSuffix
		if lf, err := readYAML[environmentLocalFile](localPath); err == nil {
			maps.Copy(vars, lf.Variables)
		}
		snap.envs = append(snap.envs, Environment{
			ID: ef.ID, Name: ef.Name, CollectionID: colID,
			Variables: vars, Secret: ef.Secret, CreatedAt: ef.CreatedAt,
		})
		snap.envPath[ef.ID] = path
	}
}
