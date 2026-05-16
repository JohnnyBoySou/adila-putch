package services

// TestsService expõe à UI as suítes de teste do workspace ativo. Uma suíte
// encadeia várias requests (por id) numa sequência; cada passo valida o
// response com asserções. O runner reaproveita o mesmo motor HTTP do
// RequestsService (sendHTTP).

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"strconv"
	"strings"
	"time"

	"github.com/joaov/putch/internal/store"
)

type TestAssertion struct {
	Type     string `json:"type"`     // status | body_contains | header_exists | jsonpath
	Target   string `json:"target"`   // chave/caminho (header_exists/jsonpath)
	Expected string `json:"expected"` // valor esperado
}

// TestCapture extrai um valor do response de um passo para uma variável,
// reutilizável como {{Var}} (URL/headers/body/params/auth) nos passos
// seguintes. From: "json" (jsonpath no corpo) | "header" | "status".
type TestCapture struct {
	Var  string `json:"var"`
	From string `json:"from"`
	Path string `json:"path"`
}

type TestStep struct {
	Name       string          `json:"name"`
	RequestID  string          `json:"request_id"`
	Assertions []TestAssertion `json:"assertions"`
	Captures   []TestCapture   `json:"captures"`
}

type Test struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	WorkspaceID string     `json:"workspace_id"`
	CreatedAt   string     `json:"created_at"`
	Steps       []TestStep `json:"steps"`
}

type TestInput struct {
	Name  string     `json:"name"`
	Steps []TestStep `json:"steps"`
}

// Resultados de execução.

type AssertionResult struct {
	Type     string `json:"type"`
	Target   string `json:"target"`
	Expected string `json:"expected"`
	Actual   string `json:"actual"`
	Passed   bool   `json:"passed"`
}

type StepResult struct {
	Name       string            `json:"name"`
	RequestID  string            `json:"request_id"`
	Status     int               `json:"status"`
	DurationMS float64           `json:"duration_ms"`
	Error      string            `json:"error"`
	Assertions []AssertionResult `json:"assertions"`
	Captured   map[string]string `json:"captured"`
	// Script agrega pm.test/console/erro dos pre/post-scripts do passo.
	Script ScriptResult `json:"script"`
	Passed bool         `json:"passed"`
}

type TestRunResult struct {
	TestID string       `json:"test_id"`
	Passed bool         `json:"passed"`
	Steps  []StepResult `json:"steps"`
}

type TestsService struct {
	store  *store.Store
	client *http.Client
}

func NewTestsService(s *store.Store) *TestsService {
	// Jar próprio: passos encadeados de uma suíte (login → request protegida)
	// compartilham cookies de sessão, isolados do RequestsService.
	jar, _ := cookiejar.New(nil)
	return &TestsService{
		store:  s,
		client: &http.Client{Timeout: 60 * time.Second, Jar: jar},
	}
}

func toTest(t store.Test) Test {
	steps := make([]TestStep, 0, len(t.Steps))
	for _, st := range t.Steps {
		as := make([]TestAssertion, 0, len(st.Assertions))
		for _, a := range st.Assertions {
			as = append(as, TestAssertion{Type: a.Type, Target: a.Target, Expected: a.Expected})
		}
		cs := make([]TestCapture, 0, len(st.Captures))
		for _, c := range st.Captures {
			cs = append(cs, TestCapture{Var: c.Var, From: c.From, Path: c.Path})
		}
		steps = append(steps, TestStep{Name: st.Name, RequestID: st.RequestID, Assertions: as, Captures: cs})
	}
	return Test{
		ID: t.ID, Name: t.Name, WorkspaceID: t.WorkspaceID,
		CreatedAt: t.CreatedAt, Steps: steps,
	}
}

func toStoreSteps(in []TestStep) []store.TestStep {
	steps := make([]store.TestStep, 0, len(in))
	for _, st := range in {
		as := make([]store.TestAssertion, 0, len(st.Assertions))
		for _, a := range st.Assertions {
			as = append(as, store.TestAssertion{Type: a.Type, Target: a.Target, Expected: a.Expected})
		}
		cs := make([]store.TestCapture, 0, len(st.Captures))
		for _, c := range st.Captures {
			cs = append(cs, store.TestCapture{Var: c.Var, From: c.From, Path: c.Path})
		}
		steps = append(steps, store.TestStep{Name: st.Name, RequestID: st.RequestID, Assertions: as, Captures: cs})
	}
	return steps
}

func (s *TestsService) FindAll() ([]Test, error) {
	ts, err := s.store.ListTests()
	if err != nil {
		return nil, err
	}
	out := []Test{}
	for _, t := range ts {
		out = append(out, toTest(t))
	}
	return out, nil
}

func (s *TestsService) FindByID(id string) (Test, error) {
	t, err := s.store.GetTest(id)
	if errors.Is(err, store.ErrNotFound) {
		return Test{}, fmt.Errorf("teste não encontrado")
	}
	if err != nil {
		return Test{}, err
	}
	return toTest(t), nil
}

func (s *TestsService) Create(input TestInput) (Test, error) {
	if strings.TrimSpace(input.Name) == "" {
		return Test{}, fmt.Errorf("nome do teste é obrigatório")
	}
	t, err := s.store.CreateTest(input.Name, toStoreSteps(input.Steps))
	if err != nil {
		return Test{}, err
	}
	return toTest(t), nil
}

func (s *TestsService) Update(id string, input TestInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return fmt.Errorf("nome do teste é obrigatório")
	}
	err := s.store.UpdateTest(id, input.Name, toStoreSteps(input.Steps))
	if errors.Is(err, store.ErrNotFound) {
		return fmt.Errorf("teste não encontrado")
	}
	return err
}

func (s *TestsService) Delete(id string) error {
	return s.store.DeleteTest(id)
}

// Run executa a suíte: cada passo dispara a request referenciada, avalia as
// asserções e captura variáveis para os passos seguintes. {{var}} em
// URL/headers/body/params/auth é resolvido pelas variáveis capturadas até
// aqui. Um passo sem request válida falha mas não interrompe os demais.
func (s *TestsService) Run(id string) (TestRunResult, error) {
	t, err := s.store.GetTest(id)
	if errors.Is(err, store.ErrNotFound) {
		return TestRunResult{}, fmt.Errorf("teste não encontrado")
	}
	if err != nil {
		return TestRunResult{}, err
	}

	svcTest := toTest(t)
	result := TestRunResult{TestID: t.ID, Passed: true}
	vars := map[string]string{} // capturas acumuladas entre passos
	for _, st := range svcTest.Steps {
		sr := StepResult{Name: st.Name, RequestID: st.RequestID, Passed: true}

		req, gerr := s.store.GetRequest(st.RequestID)
		if gerr != nil {
			sr.Error = "request não encontrada"
			sr.Passed = false
			result.Passed = false
			result.Steps = append(result.Steps, sr)
			continue
		}

		cfg := RequestConfig{
			URL:      interpolateVars(req.URL, vars),
			Method:   req.Method,
			Params:   interpolateMap(req.Params, vars),
			Headers:  interpolateMap(req.Headers, vars),
			Body:     interpolateVars(req.Body, vars),
			BodyType: req.BodyType,
			Form:     interpolateMap(req.Form, vars),
			Files:    req.Files,
			AuthType: req.AuthType, AuthValue: interpolateVars(req.AuthValue, vars),
			TimeoutMS: req.TimeoutMS,
		}

		// Pre-script: pode mutar cfg e gravar em vars (compartilhado entre
		// passos). Erro fatal reprova o passo sem disparar a request.
		var pre ScriptResult
		if strings.TrimSpace(req.PreScript) != "" {
			pre = runScript(req.PreScript, "pre", &cfg, nil, vars)
			if pre.Error != "" {
				sr.Error = "pre-request script: " + pre.Error
				sr.Script = pre
				sr.Passed = false
				result.Passed = false
				result.Steps = append(result.Steps, sr)
				continue
			}
		}

		ctx, cancel := requestContext(req.TimeoutMS)
		resp, serr := sendHTTP(ctx, s.client, cfg)
		cancel()
		if serr != nil {
			sr.Error = serr.Error()
			sr.Script = mergeScript(pre, ScriptResult{})
			sr.Passed = false
			result.Passed = false
			result.Steps = append(result.Steps, sr)
			continue
		}
		sr.Status = resp.Status
		sr.DurationMS = resp.DurationMS

		for _, a := range st.Assertions {
			ar := evalAssertion(a, resp)
			if !ar.Passed {
				sr.Passed = false
			}
			sr.Assertions = append(sr.Assertions, ar)
		}

		// Capturas declarativas alimentam vars dos próximos passos (e ficam no
		// resultado para a UI). Capturas não influenciam o passed/failed.
		for _, c := range st.Captures {
			if c.Var == "" {
				continue
			}
			if val, ok := captureValue(c, resp); ok {
				vars[c.Var] = val
				if sr.Captured == nil {
					sr.Captured = map[string]string{}
				}
				sr.Captured[c.Var] = val
			}
		}

		// Post-script: pm.test/console + captura via pm.variables.set. Um
		// pm.test falho (ou throw não-capturado) reprova o passo.
		var post ScriptResult
		if strings.TrimSpace(req.PostScript) != "" {
			post = runScript(req.PostScript, "post", &cfg, &resp, vars)
		}
		sr.Script = mergeScript(pre, post)
		if sr.Script.failed() {
			sr.Passed = false
		}

		if !sr.Passed {
			result.Passed = false
		}
		result.Steps = append(result.Steps, sr)
	}
	return result, nil
}

// captureValue extrai o valor de um TestCapture do response. Reaproveita
// jsonPath/lookupHeader das asserções.
func captureValue(c TestCapture, resp ResponseData) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(c.From)) {
	case "status":
		return strconv.Itoa(resp.Status), true
	case "header":
		return lookupHeader(resp.Headers, c.Path)
	case "json":
		return jsonPath(resp.Body, c.Path)
	default:
		return "", false
	}
}

func evalAssertion(a TestAssertion, resp ResponseData) AssertionResult {
	ar := AssertionResult{Type: a.Type, Target: a.Target, Expected: a.Expected}
	switch a.Type {
	case "status":
		ar.Actual = strconv.Itoa(resp.Status)
		ar.Passed = ar.Actual == strings.TrimSpace(a.Expected)
	case "body_contains":
		ar.Actual = truncate(resp.Body, 200)
		ar.Passed = strings.Contains(resp.Body, a.Expected)
	case "header_exists":
		v, ok := lookupHeader(resp.Headers, a.Target)
		ar.Actual = v
		ar.Passed = ok
		if a.Expected != "" {
			ar.Passed = ok && v == a.Expected
		}
	case "jsonpath":
		got, ok := jsonPath(resp.Body, a.Target)
		ar.Actual = got
		ar.Passed = ok && got == a.Expected
	default:
		ar.Actual = ""
		ar.Passed = false
	}
	return ar
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func lookupHeader(headers map[string]string, key string) (string, bool) {
	if v, ok := headers[key]; ok {
		return v, true
	}
	for k, v := range headers {
		if strings.EqualFold(k, key) {
			return v, true
		}
	}
	return "", false
}

// jsonPath resolve um caminho pontilhado simples (ex.: "data.0.name") sobre o
// corpo JSON e devolve o valor como string.
func jsonPath(body, path string) (string, bool) {
	var root any
	if err := json.Unmarshal([]byte(body), &root); err != nil {
		return "", false
	}
	cur := root
	for part := range strings.SplitSeq(path, ".") {
		if part == "" {
			continue
		}
		switch node := cur.(type) {
		case map[string]any:
			v, ok := node[part]
			if !ok {
				return "", false
			}
			cur = v
		case []any:
			idx, err := strconv.Atoi(part)
			if err != nil || idx < 0 || idx >= len(node) {
				return "", false
			}
			cur = node[idx]
		default:
			return "", false
		}
	}
	switch v := cur.(type) {
	case string:
		return v, true
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64), true
	case bool:
		return strconv.FormatBool(v), true
	case nil:
		return "null", true
	default:
		b, _ := json.Marshal(v)
		return string(b), true
	}
}
