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
	// ParentID é o folder pai ("" = folder direto na coleção).
	ParentID  string `json:"parent_id"`
	CreatedAt string `json:"created_at"`
}

type FoldersService struct {
	store *store.Store
}

func NewFoldersService(s *store.Store) *FoldersService {
	return &FoldersService{store: s}
}

func toFolder(f store.Folder) Folder {
	return Folder{
		ID: f.ID, Name: f.Name, CollectionID: f.CollectionID,
		ParentID: f.ParentID, CreatedAt: f.CreatedAt,
	}
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

// Create cria um folder. parentID == "" cria direto na coleção; parentID
// != "" cria um subfolder aninhado dentro do folder pai.
func (s *FoldersService) Create(collectionID, parentID, name string) (Folder, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Folder{}, fmt.Errorf("nome da pasta não pode ser vazio")
	}
	if strings.TrimSpace(collectionID) == "" {
		return Folder{}, fmt.Errorf("collection_id é obrigatório")
	}
	f, err := s.store.CreateFolder(collectionID, parentID, name)
	if errors.Is(err, store.ErrNotFound) {
		return Folder{}, fmt.Errorf("coleção ou pasta pai não encontrada")
	}
	if err != nil {
		return Folder{}, err
	}
	return toFolder(f), nil
}

// GetOrders devolve a ordem manual de cada container da coleção. Chave "" é a
// raiz da coleção; demais chaves são folderIDs.
func (s *FoldersService) GetOrders(collectionID string) (map[string][]string, error) {
	return s.store.GetOrders(collectionID)
}

// SetOrder persiste a ordem manual de um container (folderID == "" = raiz da
// coleção) no manifesto YAML versionável.
func (s *FoldersService) SetOrder(collectionID, folderID string, ids []string) error {
	return s.store.SetOrder(collectionID, folderID, ids)
}

func (s *FoldersService) Update(id, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("nome da pasta não pode ser vazio")
	}
	return s.store.UpdateFolder(id, name)
}

// Move reparenta um folder. newParentID == "" move para a raiz da coleção;
// caso contrário, para dentro do folder de id newParentID.
func (s *FoldersService) Move(id, newParentID string) error {
	if strings.TrimSpace(id) == "" {
		return fmt.Errorf("id da pasta é obrigatório")
	}
	err := s.store.MoveFolder(id, newParentID)
	if errors.Is(err, store.ErrNotFound) {
		return fmt.Errorf("pasta ou destino não encontrado")
	}
	if errors.Is(err, store.ErrInvalid) {
		return fmt.Errorf("não é possível mover a pasta para dentro dela mesma")
	}
	return err
}

func (s *FoldersService) Delete(id string) error {
	return s.store.DeleteFolder(id)
}
