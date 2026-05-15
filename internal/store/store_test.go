package store

import (
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

	col, err := s.CreateCollection("Minha API")
	if err != nil {
		t.Fatal(err)
	}
	fol, err := s.CreateFolder(col.ID, "Auth")
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
	reqRaw, _ := os.ReadFile(filepath.Join(root, "minha-api", "auth", "list-users.yml"))
	if !strings.Contains(string(reqRaw), "body: |") {
		t.Fatalf("body não saiu como bloco literal:\n%s", reqRaw)
	}
	if strings.Contains(string(reqRaw), "collection_id") {
		t.Fatalf("collection_id não deveria ser persistido:\n%s", reqRaw)
	}

	// environment: token deve ir para .local.yml (gitignored), base fica versionado
	env, err := s.CreateEnvironment(col.ID, "dev", map[string]string{
		"base":  "https://api.dev.example.com",
		"token": "super-secret-xyz",
	})
	if err != nil {
		t.Fatal(err)
	}
	envYML, _ := os.ReadFile(filepath.Join(root, "minha-api", "environments", "dev.yml"))
	envLocal, _ := os.ReadFile(filepath.Join(root, "minha-api", "environments", "dev.local.yml"))
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
	if _, err := os.Stat(filepath.Join(root, "minha-api", "auth", "list-users.yml")); !os.IsNotExist(err) {
		t.Fatalf("arquivo antigo deveria ter sido renomeado")
	}

	reqs, _ := s.ListRequestsByCollection(col.ID)
	if len(reqs) != 1 {
		t.Fatalf("esperava 1 request, veio %d", len(reqs))
	}
}
