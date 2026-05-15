package services

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/joaov/putch/internal/store"
)

type Request struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	CollectionID string            `json:"collection_id"`
	FolderID     string            `json:"folder_id"`
	URL          string            `json:"url"`
	Method       string            `json:"method"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
	CreatedAt    string            `json:"created_at"`
	UpdatedAt    string            `json:"updated_at"`
	IsFavorite   bool              `json:"is_favorite"`
	IsActive     bool              `json:"is_active"`
}

type RequestInput struct {
	Name         string            `json:"name"`
	CollectionID string            `json:"collection_id"`
	FolderID     string            `json:"folder_id"`
	URL          string            `json:"url"`
	Method       string            `json:"method"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
}

type RequestUpdate struct {
	Name     string            `json:"name"`
	FolderID string            `json:"folder_id"`
	URL      string            `json:"url"`
	Method   string            `json:"method"`
	Headers  map[string]string `json:"headers"`
	Body     string            `json:"body"`
}

type RequestConfig struct {
	URL     string            `json:"url"`
	Method  string            `json:"method"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

type ResponseData struct {
	Status     int               `json:"status"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	DurationMS float64           `json:"duration_ms"`
}

type RequestsService struct {
	store  *store.Store
	client *http.Client
}

func NewRequestsService(s *store.Store) *RequestsService {
	return &RequestsService{
		store:  s,
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

// toRequest converte o tipo do store para o tipo do binding. updated_at não é
// mais rastreado (o histórico do git é a fonte) — espelha created_at para
// manter o formato do binding estável.
func toRequest(r store.Request) Request {
	headers := r.Headers
	if headers == nil {
		headers = map[string]string{}
	}
	return Request{
		ID:           r.ID,
		Name:         r.Name,
		CollectionID: r.CollectionID,
		FolderID:     r.FolderID,
		URL:          r.URL,
		Method:       r.Method,
		Headers:      headers,
		Body:         r.Body,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.CreatedAt,
		IsFavorite:   r.IsFavorite,
		IsActive:     r.IsActive,
	}
}

func mapRequests(in []store.Request) []Request {
	out := []Request{}
	for _, r := range in {
		out = append(out, toRequest(r))
	}
	return out
}

func (s *RequestsService) FindAll(page, limit int) ([]Request, error) {
	reqs, err := s.store.ListRequests()
	if err != nil {
		return nil, err
	}
	byCreatedDesc(reqs, func(r store.Request) string { return r.CreatedAt })
	return mapRequests(paginate(reqs, page, limit)), nil
}

func (s *RequestsService) FindByCollectionID(collectionID string, page, limit int) ([]Request, error) {
	reqs, err := s.store.ListRequestsByCollection(collectionID)
	if err != nil {
		return nil, err
	}
	byCreatedDesc(reqs, func(r store.Request) string { return r.CreatedAt })
	return mapRequests(paginate(reqs, page, limit)), nil
}

func (s *RequestsService) FindByFolderID(folderID string, page, limit int) ([]Request, error) {
	reqs, err := s.store.ListRequestsByFolder(folderID)
	if err != nil {
		return nil, err
	}
	byCreatedDesc(reqs, func(r store.Request) string { return r.CreatedAt })
	return mapRequests(paginate(reqs, page, limit)), nil
}

func (s *RequestsService) FindByQuery(query string, page, limit int) ([]Request, error) {
	reqs, err := s.store.SearchRequests(query)
	if err != nil {
		return nil, err
	}
	byCreatedDesc(reqs, func(r store.Request) string { return r.CreatedAt })
	return mapRequests(paginate(reqs, page, limit)), nil
}

func (s *RequestsService) FindByID(id string) (Request, error) {
	r, err := s.store.GetRequest(id)
	if errors.Is(err, store.ErrNotFound) {
		return Request{}, fmt.Errorf("request não encontrado")
	}
	if err != nil {
		return Request{}, err
	}
	return toRequest(r), nil
}

func (s *RequestsService) Create(input RequestInput) (Request, error) {
	r, err := s.store.CreateRequest(store.Request{
		Name:         input.Name,
		CollectionID: input.CollectionID,
		FolderID:     strings.TrimSpace(input.FolderID),
		URL:          input.URL,
		Method:       input.Method,
		Headers:      input.Headers,
		Body:         input.Body,
	})
	if errors.Is(err, store.ErrNotFound) {
		return Request{}, fmt.Errorf("coleção não encontrada")
	}
	if err != nil {
		return Request{}, err
	}
	return toRequest(r), nil
}

func (s *RequestsService) Update(id string, input RequestUpdate) error {
	err := s.store.UpdateRequest(id, store.Request{
		Name:     input.Name,
		FolderID: strings.TrimSpace(input.FolderID),
		URL:      input.URL,
		Method:   input.Method,
		Headers:  input.Headers,
		Body:     input.Body,
	})
	if errors.Is(err, store.ErrNotFound) {
		return fmt.Errorf("request não encontrado")
	}
	return err
}

func (s *RequestsService) Delete(id string) error {
	return s.store.DeleteRequest(id)
}

func (s *RequestsService) Send(config RequestConfig) (ResponseData, error) {
	method := strings.ToUpper(strings.TrimSpace(config.Method))
	if method == "" {
		method = "GET"
	}

	var body io.Reader
	if method != "GET" && config.Body != "" {
		body = bytes.NewBufferString(config.Body)
	}

	req, err := http.NewRequest(method, config.URL, body)
	if err != nil {
		return ResponseData{}, err
	}
	for k, v := range config.Headers {
		req.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := s.client.Do(req)
	if err != nil {
		return ResponseData{}, err
	}
	defer resp.Body.Close()
	duration := float64(time.Since(start).Microseconds()) / 1000.0

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return ResponseData{}, err
	}

	headers := map[string]string{}
	for k, v := range resp.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	return ResponseData{
		Status:     resp.StatusCode,
		Headers:    headers,
		Body:       string(respBody),
		DurationMS: duration,
	}, nil
}
