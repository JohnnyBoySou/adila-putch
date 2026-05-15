package services

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/joaov/putch/internal/store"
)

type Folder struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	CollectionID string `json:"collection_id"`
	CreatedAt    string `json:"created_at"`
}

type FoldersService struct {
	store *store.Store
}

func NewFoldersService(s *store.Store) *FoldersService {
	return &FoldersService{store: s}
}

func toFolder(f store.Folder) Folder {
	return Folder{ID: f.ID, Name: f.Name, CollectionID: f.CollectionID, CreatedAt: f.CreatedAt}
}

func (s *FoldersService) FindByCollectionID(collectionID string) ([]Folder, error) {
	folders, err := s.store.ListFolders(collectionID)
	if err != nil {
		return nil, err
	}
	sort.SliceStable(folders, func(i, j int) bool { return folders[i].Name < folders[j].Name })
	out := []Folder{}
	for _, f := range folders {
		out = append(out, toFolder(f))
	}
	return out, nil
}

func (s *FoldersService) FindByID(id string) (Folder, error) {
	f, err := s.store.GetFolder(id)
	if errors.Is(err, store.ErrNotFound) {
		return Folder{}, fmt.Errorf("pasta não encontrada")
	}
	if err != nil {
		return Folder{}, err
	}
	return toFolder(f), nil
}

func (s *FoldersService) Create(collectionID, name string) (Folder, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Folder{}, fmt.Errorf("nome da pasta não pode ser vazio")
	}
	if strings.TrimSpace(collectionID) == "" {
		return Folder{}, fmt.Errorf("collection_id é obrigatório")
	}
	f, err := s.store.CreateFolder(collectionID, name)
	if errors.Is(err, store.ErrNotFound) {
		return Folder{}, fmt.Errorf("coleção não encontrada")
	}
	if err != nil {
		return Folder{}, err
	}
	return toFolder(f), nil
}

func (s *FoldersService) Update(id, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("nome da pasta não pode ser vazio")
	}
	return s.store.UpdateFolder(id, name)
}

func (s *FoldersService) Delete(id string) error {
	return s.store.DeleteFolder(id)
}
