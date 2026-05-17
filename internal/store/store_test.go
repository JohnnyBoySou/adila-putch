package store

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRoundtrip(t *testing.T) {
	root := t.TempDir()
	s, err := OpenAt(root)
	if err != nil {
		t.Fatal(err)
	}

	// .gitignore criado com a regra de segredos
	gi, _ := os.ReadFile(filepath.Join(root, ".gitignore"))
	if !strings.Contains(string(gi), gitignoreLine) {
		t.Fatalf(".gitignore sem %q: %q", gitignoreLine, gi)
	}

	// OpenAt já garante um workspace "Padrão" ativo; aqui criamos um com
	// slug previsível para checar os caminhos físicos.
	ws, err := s.CreateWorkspace(WorkspaceInput{Name: "WS"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetWorkspace(ws.ID); err != nil {
		t.Fatal(err)
	}
	wsRoot := filepath.Join(root, "ws")

	col, err := s.CreateCollection(CollectionInput{Name: "Minha API"})
	if err != nil {
		t.Fatal(err)
	}
	fol, err := s.CreateFolder(col.ID, "", "Auth")
	if err != nil {
		t.Fatal(err)
	}

	body := "{\n  \"page\": 1\n}"
	req, err := s.CreateRequest(Request{
		CollectionID: col.ID, FolderID: fol.ID, Name: "List Users",
		Method: "GET", URL: "{{base}}/users",
		Headers: map[string]string{"Accept": "application/json"},
		Body:    body,
	})
	if err != nil {
		t.Fatal(err)
	}

	got, err := s.GetRequest(req.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Body != body || got.FolderID != fol.ID || got.CollectionID != col.ID {
		t.Fatalf("request roundtrip divergiu: %+v", got)
	}

	// body deve estar como bloco literal YAML (diff-friendly), não escapado
	reqRaw, _ := os.ReadFile(filepath.Join(wsRoot, "minha-api", "auth", "list-users.yml"))
	if !strings.Contains(string(reqRaw), "body: |") {
		t.Fatalf("body não saiu como bloco literal:\n%s", reqRaw)
	}
	if strings.Contains(string(reqRaw), "collection_id") {
		t.Fatalf("collection_id não deveria ser persistido:\n%s", reqRaw)
	}

	// environment: agora é nível de workspace; token vai para .local.yml
	// (gitignored), base fica versionado
	env, err := s.CreateEnvironment(EnvironmentInput{
		Name: "dev",
		Variables: map[string]string{
			"base":  "https://api.dev.example.com",
			"token": "super-secret-xyz",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	envYML, _ := os.ReadFile(filepath.Join(wsRoot, "environments", "dev.yml"))
	envLocal, _ := os.ReadFile(filepath.Join(wsRoot, "environments", "dev.local.yml"))
	if strings.Contains(string(envYML), "super-secret-xyz") {
		t.Fatalf("segredo vazou no arquivo versionado:\n%s", envYML)
	}
	if !strings.Contains(string(envLocal), "super-secret-xyz") {
		t.Fatalf("segredo não foi para o .local.yml:\n%s", envLocal)
	}
	if !strings.Contains(string(envYML), "https://api.dev.example.com") {
		t.Fatalf("valor não-secreto deveria ser versionado:\n%s", envYML)
	}

	// leitura mescla versionado + local
	full, err := s.GetEnvironment(env.ID)
	if err != nil || full == nil {
		t.Fatalf("GetEnvironment: %v %v", full, err)
	}
	if full.Variables["token"] != "super-secret-xyz" || full.Variables["base"] == "" {
		t.Fatalf("merge de variáveis falhou: %+v", full.Variables)
	}

	// update + rename de arquivo, sem perder id
	if err := s.UpdateRequest(req.ID, Request{Name: "List All Users", FolderID: fol.ID,
		Method: "GET", URL: "{{base}}/users?all=1"}); err != nil {
		t.Fatal(err)
	}
	after, _ := s.GetRequest(req.ID)
	if after.ID != req.ID || after.Name != "List All Users" {
		t.Fatalf("update divergiu: %+v", after)
	}
	if _, err := os.Stat(filepath.Join(wsRoot, "minha-api", "auth", "list-users.yml")); !os.IsNotExist(err) {
		t.Fatalf("arquivo antigo deveria ter sido renomeado")
	}

	reqs, _ := s.ListRequestsByCollection(col.ID)
	if len(reqs) != 1 {
		t.Fatalf("esperava 1 request, veio %d", len(reqs))
	}
}

func TestNestedFoldersOrderFavoriteMove(t *testing.T) {
	root := t.TempDir()
	s, err := OpenAt(root)
	if err != nil {
		t.Fatal(err)
	}
	ws, err := s.CreateWorkspace(WorkspaceInput{Name: "WS"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetWorkspace(ws.ID); err != nil {
		t.Fatal(err)
	}
	wsRoot := filepath.Join(root, "ws")
	col, err := s.CreateCollection(CollectionInput{Name: "Org"})
	if err != nil {
		t.Fatal(err)
	}

	// Folder de topo + subfolder aninhado.
	parent, err := s.CreateFolder(col.ID, "", "Auth")
	if err != nil {
		t.Fatal(err)
	}
	child, err := s.CreateFolder(col.ID, parent.ID, "OAuth")
	if err != nil {
		t.Fatal(err)
	}
	if child.ParentID != parent.ID || parent.ParentID != "" {
		t.Fatalf("ParentID errado: parent=%+v child=%+v", parent, child)
	}
	// O subfolder vive fisicamente DENTRO da pasta do pai.
	if _, err := os.Stat(filepath.Join(wsRoot, "org", "auth", "oauth", folderMeta)); err != nil {
		t.Fatalf("subfolder não aninhado fisicamente: %v", err)
	}
	// Scan recupera ambos com o ParentID correto.
	folders, _ := s.ListFolders(col.ID)
	if len(folders) != 2 {
		t.Fatalf("esperava 2 folders, veio %d", len(folders))
	}
	for _, f := range folders {
		if f.ID == child.ID && f.ParentID != parent.ID {
			t.Fatalf("scan perdeu ParentID do subfolder: %+v", f)
		}
	}

	// Request dentro do subfolder aninhado.
	req, err := s.CreateRequest(Request{
		CollectionID: col.ID, FolderID: child.ID, Name: "Token",
		Method: "POST", URL: "{{base}}/oauth/token",
	})
	if err != nil {
		t.Fatal(err)
	}
	nestedPath := filepath.Join(wsRoot, "org", "auth", "oauth", "token.yml")
	if _, err := os.Stat(nestedPath); err != nil {
		t.Fatalf("request não foi para o subfolder aninhado: %v", err)
	}

	// SetRequestFavorite: único caminho para o "fixar".
	if err := s.SetRequestFavorite(req.ID, true); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.GetRequest(req.ID); !got.IsFavorite {
		t.Fatalf("favorite não persistiu: %+v", got)
	}
	// UpdateRequest preserva is_favorite (invariante existente).
	if err := s.UpdateRequest(req.ID, Request{
		Name: "Token", FolderID: child.ID, Method: "POST", URL: "{{base}}/oauth/token?v=2",
	}); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.GetRequest(req.ID); !got.IsFavorite {
		t.Fatalf("Update zerou is_favorite (deveria preservar): %+v", got)
	}

	// MoveRequest: subfolder -> raiz da coleção. Arquivo antigo some.
	if err := s.MoveRequest(req.ID, ""); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.GetRequest(req.ID); got.FolderID != "" {
		t.Fatalf("move não mudou FolderID: %+v", got)
	}
	if _, err := os.Stat(nestedPath); !os.IsNotExist(err) {
		t.Fatalf("arquivo antigo deveria ter sido removido no move")
	}
	if _, err := os.Stat(filepath.Join(wsRoot, "org", requestsDir, "token.yml")); err != nil {
		t.Fatalf("request não foi para requests/ da coleção: %v", err)
	}

	// Ordem manual: round-trip raiz + folder, e manifesto versionável no disco.
	rootOrder := []string{parent.ID, req.ID}
	if err := s.SetOrder(col.ID, "", rootOrder); err != nil {
		t.Fatal(err)
	}
	if err := s.SetOrder(col.ID, parent.ID, []string{child.ID}); err != nil {
		t.Fatal(err)
	}
	orders, err := s.GetOrders(col.ID)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(orders[""], ",") != strings.Join(rootOrder, ",") {
		t.Fatalf("ordem da raiz divergiu: %v", orders[""])
	}
	if strings.Join(orders[parent.ID], ",") != child.ID {
		t.Fatalf("ordem do folder divergiu: %v", orders[parent.ID])
	}
	if _, err := os.Stat(filepath.Join(wsRoot, "org", orderMeta)); err != nil {
		t.Fatalf("manifesto de ordem não foi versionado no disco: %v", err)
	}

	// DeleteFolder é recursivo: apagar o pai leva o subfolder junto.
	if err := s.DeleteFolder(parent.ID); err != nil {
		t.Fatal(err)
	}
	if folders, _ := s.ListFolders(col.ID); len(folders) != 0 {
		t.Fatalf("delete recursivo falhou, sobraram %d folders", len(folders))
	}
}

func TestMoveFolder(t *testing.T) {
	root := t.TempDir()
	s, err := OpenAt(root)
	if err != nil {
		t.Fatal(err)
	}
	ws, err := s.CreateWorkspace(WorkspaceInput{Name: "WS"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetWorkspace(ws.ID); err != nil {
		t.Fatal(err)
	}
	wsRoot := filepath.Join(root, "ws")
	col, err := s.CreateCollection(CollectionInput{Name: "Org"})
	if err != nil {
		t.Fatal(err)
	}

	// Dois folders de topo; "moved" carrega uma request.
	target, err := s.CreateFolder(col.ID, "", "Target")
	if err != nil {
		t.Fatal(err)
	}
	moved, err := s.CreateFolder(col.ID, "", "Moved")
	if err != nil {
		t.Fatal(err)
	}
	req, err := s.CreateRequest(Request{
		CollectionID: col.ID, FolderID: moved.ID, Name: "Ping",
		Method: "GET", URL: "{{base}}/ping",
	})
	if err != nil {
		t.Fatal(err)
	}

	// Mover "moved" para dentro de "target": a pasta e sua request vão junto.
	if err := s.MoveFolder(moved.ID, target.ID); err != nil {
		t.Fatalf("MoveFolder falhou: %v", err)
	}
	nested := filepath.Join(wsRoot, "org", "target", "moved")
	if _, err := os.Stat(filepath.Join(nested, folderMeta)); err != nil {
		t.Fatalf("pasta não foi aninhada fisicamente: %v", err)
	}
	if _, err := os.Stat(filepath.Join(nested, "ping.yml")); err != nil {
		t.Fatalf("request não acompanhou a pasta: %v", err)
	}
	// ParentID rederivado no scan; antigo caminho de topo sumiu.
	folders, _ := s.ListFolders(col.ID)
	for _, f := range folders {
		if f.ID == moved.ID && f.ParentID != target.ID {
			t.Fatalf("ParentID não rederivou para target: %+v", f)
		}
	}
	if _, err := os.Stat(filepath.Join(wsRoot, "org", "moved")); !os.IsNotExist(err) {
		t.Fatalf("pasta antiga de topo deveria ter sumido")
	}
	if got, _ := s.GetRequest(req.ID); got.FolderID != moved.ID {
		t.Fatalf("FolderID da request mudou indevidamente: %+v", got)
	}

	// No-op: mover para o pai onde já está não falha nem duplica.
	if err := s.MoveFolder(moved.ID, target.ID); err != nil {
		t.Fatalf("no-op MoveFolder falhou: %v", err)
	}

	// Anti-ciclo: target não pode ir para dentro de moved (seu descendente).
	if err := s.MoveFolder(target.ID, moved.ID); !errors.Is(err, ErrInvalid) {
		t.Fatalf("esperava ErrInvalid ao criar ciclo, veio %v", err)
	}
	// Anti-ciclo: pasta para dentro de si mesma.
	if err := s.MoveFolder(moved.ID, moved.ID); !errors.Is(err, ErrInvalid) {
		t.Fatalf("esperava ErrInvalid ao mover para si mesma, veio %v", err)
	}
	// Id inexistente.
	if err := s.MoveFolder("nope", ""); !errors.Is(err, ErrNotFound) {
		t.Fatalf("esperava ErrNotFound para id inexistente, veio %v", err)
	}

	// Voltar "moved" para a raiz da coleção.
	if err := s.MoveFolder(moved.ID, ""); err != nil {
		t.Fatalf("mover de volta à raiz falhou: %v", err)
	}
	if _, err := os.Stat(filepath.Join(wsRoot, "org", "moved", folderMeta)); err != nil {
		t.Fatalf("pasta não voltou para a raiz: %v", err)
	}
	folders, _ = s.ListFolders(col.ID)
	for _, f := range folders {
		if f.ID == moved.ID && f.ParentID != "" {
			t.Fatalf("ParentID deveria ser raiz após voltar: %+v", f)
		}
	}
}
