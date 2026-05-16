package services

// WorkspaceService expõe à UI a raiz do workspace — a pasta versionada por
// git onde cada coleção vira uma subpasta de arquivos YAML — e permite
// trocá-la por uma pasta escolhida no diálogo nativo. A escolha é persistida
// no config da suíte Adila (settings.json) e aplicada ao *store.Store
// compartilhado em runtime, sem reiniciar o app: o store relê o filesystem a
// cada operação, então repontar s.Root vale na hora para todos os services.

import (
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/joaov/putch/internal/config"
	"github.com/joaov/putch/internal/store"
)

// ConfigKeyWorkspace é a chave em settings.json que guarda a raiz do
// workspace escolhida pelo usuário. Vazia/ausente ⇒ usa o padrão.
const ConfigKeyWorkspace = "putch.workspace"

type WorkspaceService struct {
	store *store.Store
	cfg   *config.Config
}

func NewWorkspaceService(st *store.Store, cfg *config.Config) *WorkspaceService {
	return &WorkspaceService{store: st, cfg: cfg}
}

// GetPath retorna a raiz do workspace em uso.
func (s *WorkspaceService) GetPath() string {
	return s.store.Root
}

// Choose abre o diálogo nativo de seleção de pasta. Em cancelamento devolve o
// path atual inalterado; ao escolher, aplica ao store e persiste no config.
func (s *WorkspaceService) Choose() (string, error) {
	path, err := application.Get().Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		CanCreateDirectories(true).
		SetTitle("Escolher pasta do workspace").
		PromptForSingleSelection()
	if err != nil {
		return s.store.Root, err
	}
	if strings.TrimSpace(path) == "" {
		return s.store.Root, nil // diálogo cancelado
	}
	return s.apply(path)
}

// ResetToDefault volta ao workspace padrão (~/.config/putch/workspace) e
// remove a preferência salva.
func (s *WorkspaceService) ResetToDefault() (string, error) {
	def, err := store.DefaultRoot()
	if err != nil {
		return s.store.Root, err
	}
	if err := s.store.SetRoot(def); err != nil {
		return s.store.Root, err
	}
	if err := s.cfg.Reset(ConfigKeyWorkspace); err != nil {
		return s.store.Root, err
	}
	return s.store.Root, nil
}

func (s *WorkspaceService) apply(path string) (string, error) {
	if err := s.store.SetRoot(path); err != nil {
		return s.store.Root, err
	}
	if err := s.cfg.Set(ConfigKeyWorkspace, s.store.Root); err != nil {
		return s.store.Root, err
	}
	return s.store.Root, nil
}
