package services

import (
	"fmt"
	"strings"

	"github.com/joaov/putch/internal/store"
)

type Environment struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	CollectionID string            `json:"collection_id"`
	Variables    map[string]string `json:"variables"`
	CreatedAt    string            `json:"created_at"`
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
		ID:           e.ID,
		Name:         e.Name,
		CollectionID: e.CollectionID,
		Variables:    vars,
		CreatedAt:    e.CreatedAt,
	}
}

// FindAll returns environments. If collectionID is empty, returns all.
func (s *EnvironmentsService) FindAll(collectionID string) ([]Environment, error) {
	envs, err := s.store.ListEnvironments(collectionID)
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

func (s *EnvironmentsService) Create(collectionID, name string, variables map[string]string) (Environment, error) {
	if name == "" {
		return Environment{}, fmt.Errorf("nome do environment é obrigatório")
	}
	e, err := s.store.CreateEnvironment(collectionID, name, variables)
	if err != nil {
		return Environment{}, err
	}
	return toEnvironment(e), nil
}

func (s *EnvironmentsService) Update(id, name string, variables map[string]string) error {
	return s.store.UpdateEnvironment(id, name, variables)
}

func (s *EnvironmentsService) Delete(id string) error {
	return s.store.DeleteEnvironment(id)
}

// Interpolate replaces {{key}} occurrences in text with values from variables.
func (s *EnvironmentsService) Interpolate(text string, variables map[string]string) string {
	for k, v := range variables {
		text = strings.ReplaceAll(text, "{{"+k+"}}", v)
	}
	return text
}
