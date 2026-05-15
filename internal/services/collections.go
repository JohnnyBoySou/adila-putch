package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/joaov/putch/internal/store"
)

type Collection struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

type CollectionsService struct {
	store *store.Store
}

func NewCollectionsService(s *store.Store) *CollectionsService {
	return &CollectionsService{store: s}
}

func toCollection(c store.Collection) Collection {
	return Collection{ID: c.ID, Name: c.Name, CreatedAt: c.CreatedAt}
}

func (s *CollectionsService) FindAll(page, limit int) ([]Collection, error) {
	cols, err := s.store.ListCollections()
	if err != nil {
		return nil, err
	}
	byCreatedDesc(cols, func(c store.Collection) string { return c.CreatedAt })
	out := []Collection{}
	for _, c := range paginate(cols, page, limit) {
		out = append(out, toCollection(c))
	}
	return out, nil
}

func (s *CollectionsService) FindByQuery(query string, page, limit int) ([]Collection, error) {
	cols, err := s.store.ListCollections()
	if err != nil {
		return nil, err
	}
	q := strings.ToLower(query)
	filtered := cols[:0]
	for _, c := range cols {
		if strings.Contains(strings.ToLower(c.Name), q) {
			filtered = append(filtered, c)
		}
	}
	byCreatedDesc(filtered, func(c store.Collection) string { return c.CreatedAt })
	out := []Collection{}
	for _, c := range paginate(filtered, page, limit) {
		out = append(out, toCollection(c))
	}
	return out, nil
}

func (s *CollectionsService) FindByID(id string) (Collection, error) {
	c, err := s.store.GetCollection(id)
	if errors.Is(err, store.ErrNotFound) {
		return Collection{}, fmt.Errorf("coleção não encontrada")
	}
	if err != nil {
		return Collection{}, err
	}
	return toCollection(c), nil
}

func (s *CollectionsService) Create(name string) (Collection, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Collection{}, fmt.Errorf("nome da coleção não pode ser vazio")
	}
	c, err := s.store.CreateCollection(name)
	if err != nil {
		return Collection{}, err
	}
	return toCollection(c), nil
}

func (s *CollectionsService) Update(id, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("nome da coleção não pode ser vazio")
	}
	return s.store.UpdateCollection(id, name)
}

func (s *CollectionsService) Delete(id string) error {
	return s.store.DeleteCollection(id)
}

func (s *CollectionsService) Export(id string) (string, error) {
	c, err := s.FindByID(id)
	if err != nil {
		return "", err
	}
	payload := map[string]any{"collection": c}
	bytes, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func (s *CollectionsService) Import(fileContent string) (Collection, error) {
	var payload struct {
		Collection struct {
			Name string `json:"name"`
		} `json:"collection"`
	}
	if err := json.Unmarshal([]byte(fileContent), &payload); err != nil {
		return Collection{}, err
	}
	name := payload.Collection.Name
	if name == "" {
		name = "Sem nome"
	}
	return s.Create(name)
}
