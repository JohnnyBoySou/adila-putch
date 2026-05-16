package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/joaov/putch/internal/store"
)

// AuthType/AuthValue descrevem autenticação aplicada na hora do envio.
// Convenção do AuthValue por tipo:
//   - "bearer": o token (vira `Authorization: Bearer <token>`)
//   - "basic":  "usuario:senha" (vira `Authorization: Basic <base64>`)
//   - "apikey": "Nome-Do-Header:valor" (vira `Nome-Do-Header: valor`)
//
// O valor pode conter `{{var}}` e é interpolado no frontend antes do Send,
// igual a URL/headers/body — por isso não há split de segredo aqui.
//
// Params são query params estruturados mesclados na URL. BodyType escolhe como
// o corpo é montado ("" / "raw" = Body cru; "form" = x-www-form-urlencoded de
// Form; "multipart" = Form + Files por caminho de arquivo). TimeoutMS > 0
// sobrescreve o timeout global do client.
type Request struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	CollectionID string            `json:"collection_id"`
	FolderID     string            `json:"folder_id"`
	URL          string            `json:"url"`
	Method       string            `json:"method"`
	Params       map[string]string `json:"params"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
	BodyType     string            `json:"body_type"`
	Form         map[string]string `json:"form"`
	Files        map[string]string `json:"files"`
	AuthType     string            `json:"auth_type"`
	AuthValue    string            `json:"auth_value"`
	TimeoutMS    int               `json:"timeout_ms"`
	PreScript    string            `json:"pre_script"`
	PostScript   string            `json:"post_script"`
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
	Params       map[string]string `json:"params"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body"`
	BodyType     string            `json:"body_type"`
	Form         map[string]string `json:"form"`
	Files        map[string]string `json:"files"`
	AuthType     string            `json:"auth_type"`
	AuthValue    string            `json:"auth_value"`
	TimeoutMS    int               `json:"timeout_ms"`
	PreScript    string            `json:"pre_script"`
	PostScript   string            `json:"post_script"`
}

type RequestUpdate struct {
	Name       string            `json:"name"`
	FolderID   string            `json:"folder_id"`
	URL        string            `json:"url"`
	Method     string            `json:"method"`
	Params     map[string]string `json:"params"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	BodyType   string            `json:"body_type"`
	Form       map[string]string `json:"form"`
	Files      map[string]string `json:"files"`
	AuthType   string            `json:"auth_type"`
	AuthValue  string            `json:"auth_value"`
	TimeoutMS  int               `json:"timeout_ms"`
	PreScript  string            `json:"pre_script"`
	PostScript string            `json:"post_script"`
}

type RequestConfig struct {
	URL       string            `json:"url"`
	Method    string            `json:"method"`
	Params    map[string]string `json:"params"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	BodyType  string            `json:"body_type"`
	Form      map[string]string `json:"form"`
	Files     map[string]string `json:"files"`
	AuthType  string            `json:"auth_type"`
	AuthValue string            `json:"auth_value"`
	TimeoutMS int               `json:"timeout_ms"`
	// PreScript/PostScript: JS estilo Postman. Variables semeia
	// pm.variables/pm.environment (o frontend manda a env já resolvida).
	PreScript  string            `json:"pre_script"`
	PostScript string            `json:"post_script"`
	Variables  map[string]string `json:"variables"`
	// ClientReqID correlaciona o envio com um Cancel() vindo da UI. Vazio =
	// envio não-cancelável (só o timeout vale).
	ClientReqID string `json:"client_req_id"`
}

type ResponseData struct {
	Status     int               `json:"status"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	DurationMS float64           `json:"duration_ms"`
	// Script agrega a saída de pre/post (console, pm.test, erro).
	Script ScriptResult `json:"script"`
}

type RequestsService struct {
	store  *store.Store
	client *http.Client
	// inflight mapeia ClientReqID → cancel do envio em andamento, para Cancel().
	mu       sync.Mutex
	inflight map[string]context.CancelFunc
}

func NewRequestsService(s *store.Store) *RequestsService {
	// Jar em memória: cookies de Set-Cookie persistem entre envios da mesma
	// sessão do app (login → request autenticada), mas não tocam o disco.
	jar, _ := cookiejar.New(nil)
	return &RequestsService{
		store:    s,
		client:   &http.Client{Timeout: 60 * time.Second, Jar: jar},
		inflight: map[string]context.CancelFunc{},
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
		Params:       r.Params,
		Headers:      headers,
		Body:         r.Body,
		BodyType:     r.BodyType,
		Form:         r.Form,
		Files:        r.Files,
		AuthType:     r.AuthType,
		AuthValue:    r.AuthValue,
		TimeoutMS:    r.TimeoutMS,
		PreScript:    r.PreScript,
		PostScript:   r.PostScript,
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
		Params:       input.Params,
		Headers:      input.Headers,
		Body:         input.Body,
		BodyType:     input.BodyType,
		Form:         input.Form,
		Files:        input.Files,
		AuthType:     input.AuthType,
		AuthValue:    input.AuthValue,
		TimeoutMS:    input.TimeoutMS,
		PreScript:    input.PreScript,
		PostScript:   input.PostScript,
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
		Name:       input.Name,
		FolderID:   strings.TrimSpace(input.FolderID),
		URL:        input.URL,
		Method:     input.Method,
		Params:     input.Params,
		Headers:    input.Headers,
		Body:       input.Body,
		BodyType:   input.BodyType,
		Form:       input.Form,
		Files:      input.Files,
		AuthType:   input.AuthType,
		AuthValue:  input.AuthValue,
		TimeoutMS:  input.TimeoutMS,
		PreScript:  input.PreScript,
		PostScript: input.PostScript,
	})
	if errors.Is(err, store.ErrNotFound) {
		return fmt.Errorf("request não encontrado")
	}
	return err
}

func (s *RequestsService) Delete(id string) error {
	return s.store.DeleteRequest(id)
}

// Send dispara a request com o ciclo estilo Postman: pre-script (pode mutar
// a request/variáveis) → envio → post-script (asserções/captura). Cria um
// contexto com timeout por-request (ou o global do client se TimeoutMS == 0)
// e, se houver ClientReqID, registra o cancel para Cancel() poder abortar.
func (s *RequestsService) Send(config RequestConfig) (ResponseData, error) {
	vars := config.Variables
	if vars == nil {
		vars = map[string]string{}
	}
	cfg := config // cópia mutável; o pre-script pode reescrever campos

	var pre ScriptResult
	if strings.TrimSpace(cfg.PreScript) != "" {
		pre = runScript(cfg.PreScript, "pre", &cfg, nil, vars)
		if pre.Error != "" {
			// Pre-script com erro fatal aborta o envio (como no Postman).
			return ResponseData{Script: pre}, fmt.Errorf("pre-request script: %s", pre.Error)
		}
	}

	ctx, cancel := requestContext(cfg.TimeoutMS)
	defer cancel()
	if id := cfg.ClientReqID; id != "" {
		s.mu.Lock()
		s.inflight[id] = cancel
		s.mu.Unlock()
		defer func() {
			s.mu.Lock()
			delete(s.inflight, id)
			s.mu.Unlock()
		}()
	}

	resp, err := sendHTTP(ctx, s.client, cfg)
	if err != nil {
		resp.Script = mergeScript(pre, ScriptResult{})
		return resp, err
	}

	var post ScriptResult
	if strings.TrimSpace(cfg.PostScript) != "" {
		post = runScript(cfg.PostScript, "post", &cfg, &resp, vars)
	}
	resp.Script = mergeScript(pre, post)
	return resp, nil
}

// Cancel aborta um Send em andamento pelo ClientReqID. Devolve false se não
// havia envio com esse id (já terminou ou nunca existiu).
func (s *RequestsService) Cancel(clientReqID string) bool {
	s.mu.Lock()
	cancel, ok := s.inflight[clientReqID]
	s.mu.Unlock()
	if ok {
		cancel()
	}
	return ok
}

// requestContext devolve o contexto do envio: com deadline se timeoutMS > 0,
// senão apenas cancelável (o ceiling global do http.Client ainda vale).
func requestContext(timeoutMS int) (context.Context, context.CancelFunc) {
	if timeoutMS > 0 {
		return context.WithTimeout(context.Background(), time.Duration(timeoutMS)*time.Millisecond)
	}
	return context.WithCancel(context.Background())
}

// applyAuth injeta o header de autenticação conforme authType. authValue já
// chega interpolado (sem `{{var}}`) do frontend. Tipo vazio ou desconhecido
// não mexe na request — assim os headers do usuário ficam intactos.
func applyAuth(req *http.Request, authType, authValue string) {
	switch strings.ToLower(strings.TrimSpace(authType)) {
	case "bearer":
		if v := strings.TrimSpace(authValue); v != "" {
			req.Header.Set("Authorization", "Bearer "+v)
		}
	case "basic":
		// "usuario:senha" — só o que está antes do primeiro ":" é o usuário,
		// senhas com ":" continuam válidas.
		user, pass, _ := strings.Cut(authValue, ":")
		token := base64.StdEncoding.EncodeToString([]byte(user + ":" + pass))
		req.Header.Set("Authorization", "Basic "+token)
	case "apikey":
		// "Nome-Do-Header:valor".
		name, val, ok := strings.Cut(authValue, ":")
		name = strings.TrimSpace(name)
		if ok && name != "" {
			req.Header.Set(name, strings.TrimSpace(val))
		}
	}
}

// mergeParams acrescenta os query params estruturados à URL, preservando o
// que já estiver na query string. Se a URL não parsear, devolve-a intacta
// (o erro real aparece depois em http.NewRequest).
func mergeParams(rawURL string, params map[string]string) string {
	if len(params) == 0 {
		return rawURL
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	q := u.Query()
	for k, v := range params {
		q.Set(k, v)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// buildBody monta o corpo conforme bodyType e devolve o Content-Type derivado
// (string vazia = não forçar; o usuário controla via header). Caminhos de
// arquivo de Files são lidos do disco para o multipart.
func buildBody(config RequestConfig) (io.Reader, string, error) {
	switch strings.ToLower(strings.TrimSpace(config.BodyType)) {
	case "form":
		if len(config.Form) == 0 {
			return nil, "", nil
		}
		vals := url.Values{}
		for k, v := range config.Form {
			vals.Set(k, v)
		}
		return strings.NewReader(vals.Encode()),
			"application/x-www-form-urlencoded", nil

	case "multipart":
		if len(config.Form) == 0 && len(config.Files) == 0 {
			return nil, "", nil
		}
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		for k, v := range config.Form {
			if err := w.WriteField(k, v); err != nil {
				return nil, "", err
			}
		}
		for field, path := range config.Files {
			f, err := os.Open(path)
			if err != nil {
				return nil, "", fmt.Errorf("arquivo do campo %q: %w", field, err)
			}
			part, err := w.CreateFormFile(field, filepath.Base(path))
			if err != nil {
				_ = f.Close()
				return nil, "", err
			}
			if _, err := io.Copy(part, f); err != nil {
				_ = f.Close()
				return nil, "", err
			}
			_ = f.Close()
		}
		if err := w.Close(); err != nil {
			return nil, "", err
		}
		return &buf, w.FormDataContentType(), nil

	default: // "" | "raw"
		if config.Body == "" {
			return nil, "", nil
		}
		return bytes.NewBufferString(config.Body), "", nil
	}
}

// sendHTTP executa uma request HTTP e devolve o response normalizado.
// Compartilhado entre RequestsService.Send e o runner de TestsService.
func sendHTTP(ctx context.Context, client *http.Client, config RequestConfig) (ResponseData, error) {
	method := strings.ToUpper(strings.TrimSpace(config.Method))
	if method == "" {
		method = "GET"
	}

	body, contentType, err := buildBody(config)
	if err != nil {
		return ResponseData{}, err
	}

	req, err := http.NewRequestWithContext(ctx, method, mergeParams(config.URL, config.Params), body)
	if err != nil {
		return ResponseData{}, err
	}
	for k, v := range config.Headers {
		req.Header.Set(k, v)
	}
	// Content-Type derivado (form/multipart) é autoritativo — o boundary do
	// multipart precisa bater com o corpo; sobrescreve um header manual.
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	// Auth depois dos headers do usuário: quando há auth configurada ela
	// vence um header manual conflitante; sem auth, os headers ficam intactos.
	applyAuth(req, config.AuthType, config.AuthValue)

	start := time.Now()
	resp, err := client.Do(req)
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
