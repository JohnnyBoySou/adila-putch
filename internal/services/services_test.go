package services

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/joaov/putch/internal/store"
)

// findFile localiza um arquivo por nome dentro de root (o slug da pasta do
// workspace depende de slugify e não deve ser hardcoded no teste).
func findFile(t *testing.T, root, name string) string {
	t.Helper()
	var found string
	err := filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && d.Name() == name {
			found = p
		}
		return nil
	})
	if err != nil || found == "" {
		t.Fatalf("arquivo %q não encontrado sob %s (err=%v)", name, root, err)
	}
	b, err := os.ReadFile(found)
	if err != nil {
		t.Fatalf("ReadFile %s: %v", found, err)
	}
	return string(b)
}

// newStore abre um store isolado em diretório temporário. OpenAt já garante um
// workspace "Padrão" ativo, então os services de collection/request/env
// funcionam direto.
func newStore(t *testing.T) *store.Store {
	t.Helper()
	s, err := store.OpenAt(t.TempDir())
	if err != nil {
		t.Fatalf("OpenAt: %v", err)
	}
	return s
}

func TestCollectionsServiceCRUD(t *testing.T) {
	st := newStore(t)
	svc := NewCollectionsService(st)

	// nome só com espaços é rejeitado (validação do service, não do store)
	if _, err := svc.Create(CollectionInput{Name: "   "}); err == nil {
		t.Fatal("Create devia rejeitar nome vazio")
	}

	// nome é trimado na persistência
	c, err := svc.Create(CollectionInput{Name: "  Minha API  ", Description: " desc ", Pinned: true})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if c.Name != "Minha API" || c.Description != "desc" {
		t.Fatalf("trim não aplicado: %+v", c)
	}

	got, err := svc.FindByID(c.ID)
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}
	if got.ID != c.ID || !got.Pinned {
		t.Fatalf("FindByID divergiu: %+v", got)
	}

	// id inexistente vira erro de domínio (não o ErrNotFound cru do store)
	if _, err := svc.FindByID("nao-existe"); err == nil ||
		!strings.Contains(err.Error(), "não encontrada") {
		t.Fatalf("FindByID inexistente: esperava erro de domínio, veio %v", err)
	}

	if err := svc.Update(c.ID, CollectionInput{Name: "Renomeada"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := svc.Update(c.ID, CollectionInput{Name: " "}); err == nil {
		t.Fatal("Update devia rejeitar nome vazio")
	}
	after, _ := svc.FindByID(c.ID)
	if after.Name != "Renomeada" {
		t.Fatalf("Update não persistiu: %+v", after)
	}

	if err := svc.Delete(c.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := svc.FindByID(c.ID); err == nil {
		t.Fatal("FindByID devia falhar após Delete")
	}
	// Delete idempotente (store retorna nil quando já não existe)
	if err := svc.Delete(c.ID); err != nil {
		t.Fatalf("Delete idempotente: %v", err)
	}
}

func TestCollectionsServiceListingPinnedAndPaginationAndQuery(t *testing.T) {
	st := newStore(t)
	svc := NewCollectionsService(st)

	for i := range 5 {
		if _, err := svc.Create(CollectionInput{Name: fmt.Sprintf("Col %d", i)}); err != nil {
			t.Fatalf("seed Create: %v", err)
		}
	}
	pinned, err := svc.Create(CollectionInput{Name: "Fixada", Pinned: true})
	if err != nil {
		t.Fatalf("Create pinned: %v", err)
	}

	all, err := svc.FindAll(1, 10)
	if err != nil {
		t.Fatalf("FindAll: %v", err)
	}
	if len(all) != 6 {
		t.Fatalf("esperava 6 collections, veio %d", len(all))
	}
	if all[0].ID != pinned.ID {
		t.Fatalf("pinnedFirst não colocou a fixada no topo: %+v", all[0])
	}

	// paginação: page 2 com limit 4 → 2 itens restantes
	page2, _ := svc.FindAll(2, 4)
	if len(page2) != 2 {
		t.Fatalf("paginação errada: esperava 2, veio %d", len(page2))
	}

	hits, err := svc.FindByQuery("col 3", 1, 10)
	if err != nil {
		t.Fatalf("FindByQuery: %v", err)
	}
	if len(hits) != 1 || hits[0].Name != "Col 3" {
		t.Fatalf("FindByQuery divergiu: %+v", hits)
	}
}

func TestCollectionsServiceExportImportRoundtrip(t *testing.T) {
	st := newStore(t)
	svc := NewCollectionsService(st)

	c, _ := svc.Create(CollectionInput{Name: "Exportável", Description: "x", Deprecated: true})
	dump, err := svc.Export(c.ID)
	if err != nil {
		t.Fatalf("Export: %v", err)
	}
	if !strings.Contains(dump, "Exportável") {
		t.Fatalf("Export não contém o nome:\n%s", dump)
	}

	imported, err := svc.Import(dump)
	if err != nil {
		t.Fatalf("Import: %v", err)
	}
	if imported.ID == c.ID {
		t.Fatal("Import devia criar nova collection com id próprio")
	}
	if imported.Name != "Exportável" || !imported.Deprecated {
		t.Fatalf("Import perdeu campos: %+v", imported)
	}

	// payload inválido → erro, não panic
	if _, err := svc.Import("{ não é json"); err == nil {
		t.Fatal("Import devia falhar com JSON inválido")
	}
	// payload sem nome → fallback "Sem nome"
	noName, err := svc.Import(`{"collection":{}}`)
	if err != nil || noName.Name != "Sem nome" {
		t.Fatalf("Import sem nome: %+v %v", noName, err)
	}
}

func TestRequestsServiceCRUDAndSend(t *testing.T) {
	st := newStore(t)
	cols := NewCollectionsService(st)
	reqs := NewRequestsService(st)

	// Create em collection inexistente vira erro de domínio
	if _, err := reqs.Create(RequestInput{Name: "x", CollectionID: "ghost"}); err == nil ||
		!strings.Contains(err.Error(), "coleção não encontrada") {
		t.Fatalf("Create sem collection: esperava erro de domínio, veio %v", err)
	}

	c, _ := cols.Create(CollectionInput{Name: "API"})
	r, err := reqs.Create(RequestInput{
		Name: "ping", CollectionID: c.ID, Method: "get", URL: "http://x",
	})
	if err != nil {
		t.Fatalf("Create request: %v", err)
	}
	if !r.IsActive {
		t.Fatalf("request criada devia vir ativa: %+v", r)
	}

	byCol, _ := reqs.FindByCollectionID(c.ID, 1, 10)
	if len(byCol) != 1 {
		t.Fatalf("FindByCollectionID: esperava 1, veio %d", len(byCol))
	}
	if hits, _ := reqs.FindByQuery("ping", 1, 10); len(hits) != 1 {
		t.Fatalf("FindByQuery: esperava 1, veio %d", len(hits))
	}

	if err := reqs.Update(r.ID, RequestUpdate{Name: "ping2", Method: "GET", URL: "http://y"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if got, _ := reqs.FindByID(r.ID); got.Name != "ping2" || got.URL != "http://y" {
		t.Fatalf("Update não persistiu: %+v", got)
	}
	if err := reqs.Update("ghost", RequestUpdate{Name: "z"}); err == nil ||
		!strings.Contains(err.Error(), "não encontrado") {
		t.Fatalf("Update inexistente: esperava erro de domínio, veio %v", err)
	}

	// Send: método/headers/body chegam corretos no servidor
	var gotMethod, gotHeader, gotBody string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		gotMethod = req.Method
		gotHeader = req.Header.Get("X-Test")
		b := make([]byte, req.ContentLength)
		_, _ = req.Body.Read(b)
		gotBody = string(b)
		w.WriteHeader(201)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer ts.Close()

	resp, err := reqs.Send(RequestConfig{
		Method: "POST", URL: ts.URL,
		Headers: map[string]string{"X-Test": "abc"}, Body: `{"a":1}`,
	})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if resp.Status != 201 || resp.Body != `{"ok":true}` {
		t.Fatalf("Send response divergiu: %+v", resp)
	}
	if gotMethod != "POST" || gotHeader != "abc" || gotBody != `{"a":1}` {
		t.Fatalf("Send não enviou corretamente: m=%s h=%s b=%s", gotMethod, gotHeader, gotBody)
	}

	if err := reqs.Delete(r.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := reqs.FindByID(r.ID); err == nil {
		t.Fatal("FindByID devia falhar após Delete")
	}
}

func TestEnvironmentsServiceSecretsAndInterpolate(t *testing.T) {
	st := newStore(t)
	svc := NewEnvironmentsService(st)

	if _, err := svc.Create(EnvironmentInput{}); err == nil {
		t.Fatal("Create devia exigir nome")
	}

	e, err := svc.Create(EnvironmentInput{
		Name: "dev",
		Variables: map[string]string{
			"base":  "https://api.example.com",
			"token": "s3cr3t",
		},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// segredo (heurística por nome) não vaza no arquivo versionado
	raw := findFile(t, st.Root, "dev.yml")
	if strings.Contains(raw, "s3cr3t") {
		t.Fatalf("segredo vazou no versionado:\n%s", raw)
	}
	if !strings.Contains(raw, "https://api.example.com") {
		t.Fatalf("valor não-secreto devia ser versionado:\n%s", raw)
	}

	// leitura mescla versionado + .local
	full, err := svc.FindByID(e.ID)
	if err != nil || full == nil {
		t.Fatalf("FindByID: %v %v", full, err)
	}
	if full.Variables["token"] != "s3cr3t" || full.Variables["base"] == "" {
		t.Fatalf("merge falhou: %+v", full.Variables)
	}

	out := svc.Interpolate("{{base}}/users?t={{token}}", full.Variables)
	if out != "https://api.example.com/users?t=s3cr3t" {
		t.Fatalf("Interpolate divergiu: %q", out)
	}

	if err := svc.Delete(e.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if envs, _ := svc.FindAll(); len(envs) != 0 {
		t.Fatalf("esperava 0 environments após Delete, veio %d", len(envs))
	}
}

// TestRequestsServiceAuthHelpers cobre os três tipos de auth, a precedência
// (auth configurada vence header manual) e o no-op quando não há auth.
func TestRequestsServiceAuthHelpers(t *testing.T) {
	st := newStore(t)
	reqs := NewRequestsService(st)

	var gotAuth, gotAPIKey string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		gotAuth = req.Header.Get("Authorization")
		gotAPIKey = req.Header.Get("X-API-Key")
		w.WriteHeader(200)
	}))
	defer ts.Close()

	// bearer → "Authorization: Bearer <token>"
	if _, err := reqs.Send(RequestConfig{
		Method: "GET", URL: ts.URL, AuthType: "bearer", AuthValue: "tok123",
	}); err != nil {
		t.Fatalf("Send bearer: %v", err)
	}
	if gotAuth != "Bearer tok123" {
		t.Fatalf("bearer divergiu: %q", gotAuth)
	}

	// basic → base64("user:pass"), senha com ":" preservada
	if _, err := reqs.Send(RequestConfig{
		Method: "GET", URL: ts.URL, AuthType: "basic", AuthValue: "alice:p:wd",
	}); err != nil {
		t.Fatalf("Send basic: %v", err)
	}
	want := "Basic " + base64.StdEncoding.EncodeToString([]byte("alice:p:wd"))
	if gotAuth != want {
		t.Fatalf("basic divergiu: %q != %q", gotAuth, want)
	}

	// apikey → header nomeado pelo usuário
	if _, err := reqs.Send(RequestConfig{
		Method: "GET", URL: ts.URL, AuthType: "apikey", AuthValue: "X-API-Key:secret",
	}); err != nil {
		t.Fatalf("Send apikey: %v", err)
	}
	if gotAPIKey != "secret" {
		t.Fatalf("apikey divergiu: %q", gotAPIKey)
	}

	// auth configurada vence um Authorization manual conflitante
	if _, err := reqs.Send(RequestConfig{
		Method: "GET", URL: ts.URL,
		Headers:  map[string]string{"Authorization": "Bearer manual"},
		AuthType: "bearer", AuthValue: "configurado",
	}); err != nil {
		t.Fatalf("Send precedência: %v", err)
	}
	if gotAuth != "Bearer configurado" {
		t.Fatalf("auth configurada devia vencer header manual: %q", gotAuth)
	}

	// sem auth: o header manual fica intacto
	if _, err := reqs.Send(RequestConfig{
		Method:  "GET",
		URL:     ts.URL,
		Headers: map[string]string{"Authorization": "Bearer manual"},
	}); err != nil {
		t.Fatalf("Send sem auth: %v", err)
	}
	if gotAuth != "Bearer manual" {
		t.Fatalf("sem auth devia preservar header manual: %q", gotAuth)
	}
}

// TestRequestsServiceCookieJarPersists garante que um Set-Cookie de um envio é
// reenviado no envio seguinte do mesmo service (sessão em memória).
func TestRequestsServiceCookieJarPersists(t *testing.T) {
	st := newStore(t)
	reqs := NewRequestsService(st)

	var sawCookie string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if c, err := req.Cookie("sid"); err == nil {
			sawCookie = c.Value
		}
		http.SetCookie(w, &http.Cookie{Name: "sid", Value: "abc123", Path: "/"})
		w.WriteHeader(200)
	}))
	defer ts.Close()

	// 1ª request: servidor ainda não vê cookie, mas devolve Set-Cookie
	if _, err := reqs.Send(RequestConfig{Method: "GET", URL: ts.URL}); err != nil {
		t.Fatalf("Send 1: %v", err)
	}
	if sawCookie != "" {
		t.Fatalf("1ª request não devia mandar cookie, mandou %q", sawCookie)
	}

	// 2ª request no mesmo service: o jar reenvia o cookie da sessão
	if _, err := reqs.Send(RequestConfig{Method: "GET", URL: ts.URL}); err != nil {
		t.Fatalf("Send 2: %v", err)
	}
	if sawCookie != "abc123" {
		t.Fatalf("jar não reenviou o cookie de sessão: %q", sawCookie)
	}
}

// TestRequestsServiceParamsAndBodyTypes cobre merge de query params e os
// corpos form/multipart (com upload de arquivo do disco).
func TestRequestsServiceParamsAndBodyTypes(t *testing.T) {
	st := newStore(t)
	reqs := NewRequestsService(st)

	var gotQuery url.Values
	var gotCT string
	var gotField, gotFileName, gotFileBody string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query()
		gotCT = r.Header.Get("Content-Type")
		if strings.HasPrefix(gotCT, "multipart/") {
			_ = r.ParseMultipartForm(1 << 20)
			gotField = r.FormValue("campo")
			if f, h, err := r.FormFile("arquivo"); err == nil {
				gotFileName = h.Filename
				b, _ := io.ReadAll(f)
				gotFileBody = string(b)
				_ = f.Close()
			}
		} else {
			_ = r.ParseForm()
			gotField = r.PostFormValue("campo")
		}
		w.WriteHeader(200)
	}))
	defer ts.Close()

	// query existente na URL + Params estruturados; "a" é sobrescrito
	if _, err := reqs.Send(RequestConfig{
		Method: "GET", URL: ts.URL + "?a=1&keep=z",
		Params: map[string]string{"a": "override", "b": "2"},
	}); err != nil {
		t.Fatalf("Send params: %v", err)
	}
	if gotQuery.Get("a") != "override" || gotQuery.Get("b") != "2" || gotQuery.Get("keep") != "z" {
		t.Fatalf("merge de params divergiu: %v", gotQuery)
	}

	// form urlencoded
	if _, err := reqs.Send(RequestConfig{
		Method: "POST", URL: ts.URL, BodyType: "form",
		Form: map[string]string{"campo": "valor"},
	}); err != nil {
		t.Fatalf("Send form: %v", err)
	}
	if gotField != "valor" || !strings.HasPrefix(gotCT, "application/x-www-form-urlencoded") {
		t.Fatalf("form divergiu: campo=%q ct=%q", gotField, gotCT)
	}

	// multipart com upload de arquivo lido do disco
	fpath := filepath.Join(t.TempDir(), "payload.txt")
	if err := os.WriteFile(fpath, []byte("conteudo-do-arquivo"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if _, err := reqs.Send(RequestConfig{
		Method: "POST", URL: ts.URL, BodyType: "multipart",
		Form:  map[string]string{"campo": "txt"},
		Files: map[string]string{"arquivo": fpath},
	}); err != nil {
		t.Fatalf("Send multipart: %v", err)
	}
	if gotField != "txt" || gotFileName != "payload.txt" || gotFileBody != "conteudo-do-arquivo" {
		t.Fatalf("multipart divergiu: campo=%q nome=%q body=%q", gotField, gotFileName, gotFileBody)
	}
}

// TestRequestsServiceTimeoutAndCancel cobre o timeout por-request e o
// cancelamento em andamento via ClientReqID.
func TestRequestsServiceTimeoutAndCancel(t *testing.T) {
	st := newStore(t)
	reqs := NewRequestsService(st)

	release := make(chan struct{})
	started := make(chan struct{}, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case started <- struct{}{}:
		default:
		}
		<-release // segura a resposta até o teste liberar
		w.WriteHeader(200)
	}))
	defer ts.Close()
	defer close(release)

	// timeout por-request estoura antes do servidor responder
	if _, err := reqs.Send(RequestConfig{
		Method: "GET", URL: ts.URL, TimeoutMS: 50,
	}); err == nil {
		t.Fatal("Send com TimeoutMS curto devia falhar")
	}
	<-started // drena o sinal do envio que deu timeout

	// cancelamento em andamento por ClientReqID
	errc := make(chan error, 1)
	go func() {
		_, err := reqs.Send(RequestConfig{
			Method: "GET", URL: ts.URL, ClientReqID: "req-1",
		})
		errc <- err
	}()
	<-started // envio chegou no servidor (está pendurado em <-release)
	if !reqs.Cancel("req-1") {
		t.Fatal("Cancel devia achar o envio em andamento")
	}
	if err := <-errc; err == nil {
		t.Fatal("Send cancelado devia retornar erro")
	}
	if reqs.Cancel("inexistente") {
		t.Fatal("Cancel de id inexistente devia ser false")
	}
}

// TestTestsServiceCaptureChaining valida o encadeamento: o passo 1 captura um
// valor do JSON e o passo 2 usa {{var}} no AuthValue, resolvido na hora.
func TestTestsServiceCaptureChaining(t *testing.T) {
	st := newStore(t)
	cols := NewCollectionsService(st)
	reqs := NewRequestsService(st)
	tests := NewTestsService(st)

	var sawAuth string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login":
			_, _ = w.Write([]byte(`{"data":{"token":"T-42"}}`))
		case "/protegido":
			sawAuth = r.Header.Get("Authorization")
			w.WriteHeader(204)
		default:
			w.WriteHeader(404)
		}
	}))
	defer ts.Close()

	c, _ := cols.Create(CollectionInput{Name: "Fluxo"})
	login, err := reqs.Create(RequestInput{
		Name: "login", CollectionID: c.ID, Method: "POST", URL: ts.URL + "/login",
	})
	if err != nil {
		t.Fatalf("Create login: %v", err)
	}
	prot, err := reqs.Create(RequestInput{
		Name: "protegido", CollectionID: c.ID, Method: "GET", URL: ts.URL + "/protegido",
		AuthType: "bearer", AuthValue: "{{tok}}",
	})
	if err != nil {
		t.Fatalf("Create protegido: %v", err)
	}

	suite, err := tests.Create(TestInput{
		Name: "login-then-use",
		Steps: []TestStep{
			{
				Name: "login", RequestID: login.ID,
				Assertions: []TestAssertion{{Type: "status", Expected: "200"}},
				Captures: []TestCapture{
					{Var: "tok", From: "json", Path: "data.token"},
					{Var: "code", From: "status"},
				},
			},
			{
				Name: "usa token", RequestID: prot.ID,
				Assertions: []TestAssertion{{Type: "status", Expected: "204"}},
			},
		},
	})
	if err != nil {
		t.Fatalf("Create suite: %v", err)
	}

	res, err := tests.Run(suite.ID)
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if !res.Passed {
		t.Fatalf("suíte devia passar: %+v", res)
	}
	if res.Steps[0].Captured["tok"] != "T-42" || res.Steps[0].Captured["code"] != "200" {
		t.Fatalf("captura divergiu: %+v", res.Steps[0].Captured)
	}
	if sawAuth != "Bearer T-42" {
		t.Fatalf("{{tok}} não foi interpolado no AuthValue: %q", sawAuth)
	}
}

// TestRequestsServiceScripting cobre o ciclo pre/post estilo Postman no Send:
// pre muta a request e variáveis; post faz pm.test/console e lê pm.response.
func TestRequestsServiceScripting(t *testing.T) {
	st := newStore(t)
	reqs := NewRequestsService(st)

	var gotHeader, gotURL string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get("X-Pre")
		gotURL = r.URL.String()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"user":{"id":7,"name":"ana"}}`))
	}))
	defer ts.Close()

	resp, err := reqs.Send(RequestConfig{
		Method: "GET", URL: ts.URL,
		Variables: map[string]string{"flag": "on"},
		PreScript: `
			pm.request.headers["X-Pre"] = "v" + pm.variables.get("flag");
			pm.request.url = pm.request.url + "?q=1";
			pm.variables.set("captured", "fromPre");
			console.log("pre ok", { a: 1 });
		`,
		PostScript: `
			pm.test("status 200", function(){ pm.expect(pm.response.code).to.equal(200); });
			var b = pm.response.json();
			pm.test("nome ana", function(){ pm.expect(b.user.name).to.eql("ana"); });
			pm.test("vai falhar", function(){ pm.expect(b.user.id).to.equal(99); });
			pm.variables.set("uid", String(b.user.id));
		`,
	})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if gotHeader != "von" {
		t.Fatalf("pre-script não mutou o header: %q", gotHeader)
	}
	if !strings.HasSuffix(gotURL, "?q=1") {
		t.Fatalf("pre-script não mutou a URL: %q", gotURL)
	}
	if len(resp.Script.Tests) != 3 {
		t.Fatalf("esperava 3 pm.test, veio %d (%+v)", len(resp.Script.Tests), resp.Script.Tests)
	}
	if !resp.Script.Tests[0].Passed || !resp.Script.Tests[1].Passed || resp.Script.Tests[2].Passed {
		t.Fatalf("resultados de pm.test divergiram: %+v", resp.Script.Tests)
	}
	if len(resp.Script.Console) == 0 || !strings.Contains(resp.Script.Console[0], `pre ok {"a":1}`) {
		t.Fatalf("console não capturado: %+v", resp.Script.Console)
	}

	// pre-script com throw não-capturado aborta o envio
	if _, err := reqs.Send(RequestConfig{
		Method: "GET", URL: ts.URL,
		PreScript: `throw new Error("boom");`,
	}); err == nil || !strings.Contains(err.Error(), "pre-request script") {
		t.Fatalf("pre-script com erro devia abortar o Send, veio %v", err)
	}

	// watchdog: loop infinito é interrompido
	old := scriptTimeout
	scriptTimeout = 150 * time.Millisecond
	defer func() { scriptTimeout = old }()
	r2 := runScript(`while(true){}`, "post", &RequestConfig{}, &ResponseData{}, nil)
	if r2.Error == "" || !strings.Contains(r2.Error, "tempo limite") {
		t.Fatalf("loop infinito devia estourar o watchdog, veio %q", r2.Error)
	}
}

// TestTestsServiceScriptChaining valida script no runner: o post-script do
// passo 1 captura via pm.variables.set e o passo 2 consome em {{var}}; um
// pm.test falho reprova o passo.
func TestTestsServiceScriptChaining(t *testing.T) {
	st := newStore(t)
	cols := NewCollectionsService(st)
	reqs := NewRequestsService(st)
	tests := NewTestsService(st)

	var sawToken string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/auth":
			_, _ = w.Write([]byte(`{"token":"ZZ9"}`))
		case "/use":
			sawToken = r.Header.Get("X-Token")
			w.WriteHeader(200)
		}
	}))
	defer ts.Close()

	c, _ := cols.Create(CollectionInput{Name: "ScriptFlow"})
	auth, _ := reqs.Create(RequestInput{
		Name: "auth", CollectionID: c.ID, Method: "POST", URL: ts.URL + "/auth",
		PostScript: `pm.variables.set("tk", pm.response.json().token);
		             pm.test("tem token", function(){ pm.expect(pm.response.json().token).to.be.a("string"); });`,
	})
	use, _ := reqs.Create(RequestInput{
		Name: "use", CollectionID: c.ID, Method: "GET", URL: ts.URL + "/use",
		Headers: map[string]string{"X-Token": "{{tk}}"},
	})

	suite, err := tests.Create(TestInput{
		Name: "fluxo-script",
		Steps: []TestStep{
			{Name: "auth", RequestID: auth.ID},
			{Name: "use", RequestID: use.ID,
				Assertions: []TestAssertion{{Type: "status", Expected: "200"}}},
		},
	})
	if err != nil {
		t.Fatalf("Create suite: %v", err)
	}

	res, err := tests.Run(suite.ID)
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if !res.Passed {
		t.Fatalf("suíte devia passar: %+v", res)
	}
	if sawToken != "ZZ9" {
		t.Fatalf("post-script do passo 1 não alimentou {{tk}} do passo 2: %q", sawToken)
	}
	if len(res.Steps[0].Script.Tests) != 1 || !res.Steps[0].Script.Tests[0].Passed {
		t.Fatalf("pm.test do passo 1 divergiu: %+v", res.Steps[0].Script)
	}

	// post-script com pm.test falho reprova o passo
	bad, _ := reqs.Create(RequestInput{
		Name: "bad", CollectionID: c.ID, Method: "POST", URL: ts.URL + "/auth",
		PostScript: `pm.test("sempre falha", function(){ pm.expect(1).to.equal(2); });`,
	})
	badSuite, _ := tests.Create(TestInput{
		Name:  "falha-script",
		Steps: []TestStep{{Name: "bad", RequestID: bad.ID}},
	})
	bres, _ := tests.Run(badSuite.ID)
	if bres.Passed || bres.Steps[0].Passed {
		t.Fatalf("pm.test falho devia reprovar o passo: %+v", bres)
	}
}

// TestStoreConcurrentCreatesNoLostUpdate reproduz a via real do Wails: cada
// chamada de serviço numa goroutine própria. Sem o mutex no Store, dois
// CreateCollection concorrentes podiam calcular o mesmo slug único (TOCTOU em
// uniqueDir) e gravar por cima um do outro — aqui exigimos que as N criações
// resultem em N collections com ids distintos. Rode com -race.
func TestStoreConcurrentCreatesNoLostUpdate(t *testing.T) {
	st := newStore(t)
	svc := NewCollectionsService(st)

	const n = 40
	var wg sync.WaitGroup
	errs := make(chan error, n)
	ids := make(chan string, n)
	for range n {
		wg.Go(func() {
			// Nome repetido de propósito: força a disputa pelo mesmo slug base.
			c, err := svc.Create(CollectionInput{Name: "Concorrente"})
			if err != nil {
				errs <- err
				return
			}
			ids <- c.ID
		})
	}
	wg.Wait()
	close(errs)
	close(ids)

	for err := range errs {
		t.Fatalf("Create concorrente falhou: %v", err)
	}
	seen := map[string]bool{}
	for id := range ids {
		if seen[id] {
			t.Fatalf("id duplicado em criações concorrentes: %s", id)
		}
		seen[id] = true
	}

	all, err := svc.FindAll(1, n+10)
	if err != nil {
		t.Fatalf("FindAll: %v", err)
	}
	if len(all) != n {
		t.Fatalf("lost update: criadas %d, persistidas %d", n, len(all))
	}
}
