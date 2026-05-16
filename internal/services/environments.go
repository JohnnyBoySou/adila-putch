package services

import (
	"fmt"
	"strings"

	"github.com/joaov/putch/internal/store"
)

type Environment struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	WorkspaceID string            `json:"workspace_id"`
	Description string            `json:"description"`
	Pinned      bool              `json:"pinned"`
	Deprecated  bool              `json:"deprecated"`
	Variables   map[string]string `json:"variables"`
	CreatedAt   string            `json:"created_at"`
	UpdatedAt   string            `json:"updated_at"`
}

// EnvironmentInput são os campos editáveis enviados pela UI. CreatedAt/
// UpdatedAt são geridos pelo store.
type EnvironmentInput struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Pinned      bool              `json:"pinned"`
	Deprecated  bool              `json:"deprecated"`
	Variables   map[string]string `json:"variables"`
}

type EnvironmentsService struct {
	store *store.Store
}

func NewEnvironmentsService(s *store.Store) *EnvironmentsService {
	return &EnvironmentsService{store: s}
}

func toEnvironment(e store.Environment) Environment {
	vars := e.Variables
	if vars == nil {
		vars = map[string]string{}
	}
	return Environment{
		ID:          e.ID,
		Name:        e.Name,
		WorkspaceID: e.WorkspaceID,
		Description: e.Description,
		Pinned:      e.Pinned,
		Deprecated:  e.Deprecated,
		Variables:   vars,
		CreatedAt:   e.CreatedAt,
		UpdatedAt:   e.UpdatedAt,
	}
}

// FindAll retorna os environments do workspace ativo (compartilhados por
// todas as collections do workspace).
func (s *EnvironmentsService) FindAll() ([]Environment, error) {
	envs, err := s.store.ListEnvironments()
	if err != nil {
		return nil, err
	}
	byCreatedDesc(envs, func(e store.Environment) string { return e.CreatedAt })
	out := []Environment{}
	for _, e := range envs {
		out = append(out, toEnvironment(e))
	}
	return out, nil
}

func (s *EnvironmentsService) FindByID(id string) (*Environment, error) {
	e, err := s.store.GetEnvironment(id)
	if err != nil {
		return nil, err
	}
	if e == nil {
		return nil, nil
	}
	env := toEnvironment(*e)
	return &env, nil
}

func (s *EnvironmentsService) Create(in EnvironmentInput) (Environment, error) {
	if strings.TrimSpace(in.Name) == "" {
		return Environment{}, fmt.Errorf("nome do environment é obrigatório")
	}
	e, err := s.store.CreateEnvironment(store.EnvironmentInput{
		Name:        strings.TrimSpace(in.Name),
		Description: in.Description,
		Pinned:      in.Pinned,
		Deprecated:  in.Deprecated,
		Variables:   in.Variables,
	})
	if err != nil {
		return Environment{}, err
	}
	return toEnvironment(e), nil
}

func (s *EnvironmentsService) Update(id string, in EnvironmentInput) error {
	if strings.TrimSpace(in.Name) == "" {
		return fmt.Errorf("nome do environment é obrigatório")
	}
	return s.store.UpdateEnvironment(id, store.EnvironmentInput{
		Name:        strings.TrimSpace(in.Name),
		Description: in.Description,
		Pinned:      in.Pinned,
		Deprecated:  in.Deprecated,
		Variables:   in.Variables,
	})
}

func (s *EnvironmentsService) Delete(id string) error {
	return s.store.DeleteEnvironment(id)
}

// Interpolate replaces {{key}} occurrences in text with values from variables.
func (s *EnvironmentsService) Interpolate(text string, variables map[string]string) string {
	return interpolateVars(text, variables)
}

// interpolateVars troca cada {{chave}} em s pelo valor correspondente.
// Compartilhado entre a interpolação de env (UI) e o encadeamento de testes.
func interpolateVars(s string, vars map[string]string) string {
	for k, v := range vars {
		s = strings.ReplaceAll(s, "{{"+k+"}}", v)
	}
	return s
}

// interpolateMap aplica interpolateVars nos valores de um mapa, devolvendo uma
// cópia nova (nil/vazio passa direto, sem alocar).
func interpolateMap(m, vars map[string]string) map[string]string {
	if len(m) == 0 {
		return m
	}
	out := make(map[string]string, len(m))
	for k, v := range m {
		out[k] = interpolateVars(v, vars)
	}
	return out
}
