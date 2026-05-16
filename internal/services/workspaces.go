package services

// WorkspacesService expõe à UI os workspaces dentro do root versionado por
// git. Um workspace engloba collections, environments e tests. Há sempre um
// workspace "ativo": todas as operações de collection/request/env/test são
// escopadas nele. A escolha do ativo é persistida no config compartilhado da
// suíte Adila (settings.json) e aplicada ao *store.Store em runtime — o store
// relê o filesystem a cada operação, então repontar o ativo vale na hora.
//
// Não confundir com WorkspaceService (singular), que escolhe a PASTA root
// (repositório git) onde os workspaces vivem.

import (
	"fmt"
	"strings"

	"github.com/joaov/putch/internal/config"
	"github.com/joaov/putch/internal/store"
)

// ConfigKeyActiveWorkspace guarda o id do workspace ativo em settings.json.
const ConfigKeyActiveWorkspace = "putch.activeWorkspace"

type Workspace struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Color         string `json:"color"`
	Icon          string `json:"icon"`
	Pinned        bool   `json:"pinned"`
	CreatedAt     string `json:"created_at"`
	CreatedAuthor string `json:"created_author"`
	UpdatedAt     string `json:"updated_at"`
	UpdatedAuthor string `json:"updated_author"`
	IsActive      bool   `json:"is_active"`
}

// WorkspaceInput são os campos que o frontend envia ao criar/editar um
// workspace. Espelha store.WorkspaceInput; metadados (datas, autores) ficam
// a cargo do store.
type WorkspaceInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Icon        string `json:"icon"`
	Pinned      bool   `json:"pinned"`
}

type WorkspacesService struct {
	store *store.Store
	cfg   *config.Config
}

func NewWorkspacesService(s *store.Store, cfg *config.Config) *WorkspacesService {
	return &WorkspacesService{store: s, cfg: cfg}
}

func (s *WorkspacesService) toWorkspace(w store.Workspace) Workspace {
	return Workspace{
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
		IsActive:      w.ID == s.store.WorkspaceID,
	}
}

// FindAll lista os workspaces do root (store já ordena por CreatedAt desc),
// reordena fixados primeiro (estável) e marca o ativo.
func (s *WorkspacesService) FindAll() ([]Workspace, error) {
	wss, err := s.store.ListWorkspaces()
	if err != nil {
		return nil, err
	}
	out := []Workspace{}
	for _, w := range wss {
		if w.Pinned {
			out = append(out, s.toWorkspace(w))
		}
	}
	for _, w := range wss {
		if !w.Pinned {
			out = append(out, s.toWorkspace(w))
		}
	}
	return out, nil
}

// GetActive retorna o workspace ativo (ou erro se nenhum válido).
func (s *WorkspacesService) GetActive() (Workspace, error) {
	w, err := s.store.GetWorkspace(s.store.WorkspaceID)
	if err != nil {
		return Workspace{}, fmt.Errorf("nenhum workspace ativo")
	}
	return s.toWorkspace(w), nil
}

func (s *WorkspacesService) Create(in WorkspaceInput) (Workspace, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return Workspace{}, fmt.Errorf("nome do workspace é obrigatório")
	}
	w, err := s.store.CreateWorkspace(store.WorkspaceInput{
		Name:        in.Name,
		Description: strings.TrimSpace(in.Description),
		Color:       in.Color,
		Icon:        in.Icon,
		Pinned:      in.Pinned,
	})
	if err != nil {
		return Workspace{}, err
	}
	return s.toWorkspace(w), nil
}

func (s *WorkspacesService) Update(id string, in WorkspaceInput) error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return fmt.Errorf("nome do workspace é obrigatório")
	}
	return s.store.UpdateWorkspace(id, store.WorkspaceInput{
		Name:        in.Name,
		Description: strings.TrimSpace(in.Description),
		Color:       in.Color,
		Icon:        in.Icon,
		Pinned:      in.Pinned,
	})
}

// Delete remove o workspace. Se for o ativo, cai em outro existente (ou cria
// um padrão) para o app nunca ficar sem workspace.
func (s *WorkspacesService) Delete(id string) error {
	if err := s.store.DeleteWorkspace(id); err != nil {
		return err
	}
	if s.store.WorkspaceID != id {
		return nil
	}
	wss, err := s.store.ListWorkspaces()
	if err != nil {
		return err
	}
	target := ""
	if len(wss) == 0 {
		w, err := s.store.CreateWorkspace(store.WorkspaceInput{Name: "Padrão"})
		if err != nil {
			return err
		}
		target = w.ID
	} else {
		target = wss[0].ID
	}
	_, err = s.SetActive(target)
	return err
}

// SetActive troca o workspace ativo e persiste a escolha no config.
func (s *WorkspacesService) SetActive(id string) (Workspace, error) {
	if err := s.store.SetWorkspace(id); err != nil {
		return Workspace{}, err
	}
	if err := s.cfg.Set(ConfigKeyActiveWorkspace, id); err != nil {
		return Workspace{}, err
	}
	return s.GetActive()
}
