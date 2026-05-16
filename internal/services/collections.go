package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/joaov/putch/internal/store"
)

type Collection struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Pinned        bool   `json:"pinned"`
	Deprecated    bool   `json:"deprecated"`
	Bg            int    `json:"bg"`
	RequestCount  int    `json:"request_count"`
	CreatedAt     string `json:"created_at"`
	CreatedAuthor string `json:"created_author"`
	UpdatedAt     string `json:"updated_at"`
	UpdatedAuthor string `json:"updated_author"`
}

// CollectionInput são os campos que o frontend envia ao criar/editar uma
// collection. Espelha store.CollectionInput; metadados (datas, autores) ficam
// a cargo do store.
type CollectionInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Pinned      bool   `json:"pinned"`
	Deprecated  bool   `json:"deprecated"`
	Bg          int    `json:"bg"`
}

type CollectionsService struct {
	store *store.Store
}

func NewCollectionsService(s *store.Store) *CollectionsService {
	return &CollectionsService{store: s}
}

func toCollection(c store.Collection) Collection {
	return Collection{
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

// pinnedFirst reordena mantendo a ordem relativa de cada grupo (estável):
// fixadas primeiro, demais depois. Aplicado após byCreatedDesc, dá
// "fixadas no topo, e dentro de cada grupo as mais recentes primeiro".
func pinnedFirst(cols []store.Collection) []store.Collection {
	out := make([]store.Collection, 0, len(cols))
	for _, c := range cols {
		if c.Pinned {
			out = append(out, c)
		}
	}
	for _, c := range cols {
		if !c.Pinned {
			out = append(out, c)
		}
	}
	return out
}

func (s *CollectionsService) FindAll(page, limit int) ([]Collection, error) {
	cols, err := s.store.ListCollections()
	if err != nil {
		return nil, err
	}
	counts, err := s.store.CollectionRequestCounts()
	if err != nil {
		return nil, err
	}
	byCreatedDesc(cols, func(c store.Collection) string { return c.CreatedAt })
	cols = pinnedFirst(cols)
	out := []Collection{}
	for _, c := range paginate(cols, page, limit) {
		dto := toCollection(c)
		dto.RequestCount = counts[c.ID]
		out = append(out, dto)
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
	counts, err := s.store.CollectionRequestCounts()
	if err != nil {
		return nil, err
	}
	byCreatedDesc(filtered, func(c store.Collection) string { return c.CreatedAt })
	filtered = pinnedFirst(filtered)
	out := []Collection{}
	for _, c := range paginate(filtered, page, limit) {
		dto := toCollection(c)
		dto.RequestCount = counts[c.ID]
		out = append(out, dto)
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
	dto := toCollection(c)
	if counts, err := s.store.CollectionRequestCounts(); err == nil {
		dto.RequestCount = counts[c.ID]
	}
	return dto, nil
}

func (s *CollectionsService) Create(in CollectionInput) (Collection, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return Collection{}, fmt.Errorf("nome da coleção não pode ser vazio")
	}
	c, err := s.store.CreateCollection(store.CollectionInput{
		Name:        in.Name,
		Description: strings.TrimSpace(in.Description),
		Pinned:      in.Pinned,
		Deprecated:  in.Deprecated,
		Bg:          in.Bg,
	})
	if err != nil {
		return Collection{}, err
	}
	return toCollection(c), nil
}

func (s *CollectionsService) Update(id string, in CollectionInput) error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return fmt.Errorf("nome da coleção não pode ser vazio")
	}
	return s.store.UpdateCollection(id, store.CollectionInput{
		Name:        in.Name,
		Description: strings.TrimSpace(in.Description),
		Pinned:      in.Pinned,
		Deprecated:  in.Deprecated,
		Bg:          in.Bg,
	})
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
			Name        string `json:"name"`
			Description string `json:"description"`
			Deprecated  bool   `json:"deprecated"`
		} `json:"collection"`
	}
	if err := json.Unmarshal([]byte(fileContent), &payload); err != nil {
		return Collection{}, err
	}
	name := payload.Collection.Name
	if name == "" {
		name = "Sem nome"
	}
	return s.Create(CollectionInput{
		Name:        name,
		Description: payload.Collection.Description,
		Deprecated:  payload.Collection.Deprecated,
	})
}
