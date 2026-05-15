package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func run(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	cmd.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=T", "GIT_AUTHOR_EMAIL=t@p.dev",
		"GIT_COMMITTER_NAME=T", "GIT_COMMITTER_EMAIL=t@p.dev")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

func write(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

// bareRemote cria um remote bare + clone "a" com um commit inicial em main.
func bareRemote(t *testing.T) (remote, a string) {
	t.Helper()
	base := t.TempDir()
	remote = filepath.Join(base, "remote.git")
	if err := exec.Command("git", "init", "--bare", remote).Run(); err != nil {
		t.Fatal(err)
	}
	a = filepath.Join(base, "a")
	if err := exec.Command("git", "clone", remote, a).Run(); err != nil {
		t.Fatal(err)
	}
	run(t, a, "config", "user.email", "t@p.dev")
	run(t, a, "config", "user.name", "T")
	run(t, a, "checkout", "-b", "main")
	write(t, a, "req.yml", "name: X\nurl: /v1\n")
	run(t, a, "add", "-A")
	run(t, a, "commit", "-m", "init")
	run(t, a, "push", "-u", "origin", "main")
	return remote, a
}

// ResolveConflict("theirs") adota a versão recebida e fecha o merge limpo.
func TestResolveConflictTheirs(t *testing.T) {
	remote, a := bareRemote(t)
	b := filepath.Join(filepath.Dir(a), "b")
	if err := exec.Command("git", "clone", "-b", "main", remote, b).Run(); err != nil {
		t.Fatal(err)
	}
	run(t, b, "config", "user.email", "b@p.dev")
	run(t, b, "config", "user.name", "B")

	s := NewService()

	write(t, a, "req.yml", "name: X\nurl: /from-A\n")
	run(t, a, "commit", "-am", "A edit")
	run(t, a, "push", "origin", "main")

	write(t, b, "req.yml", "name: X\nurl: /from-B\n")
	run(t, b, "commit", "-am", "B edit")

	pr, err := s.Pull(b, "main")
	if err != nil || !pr.Conflicted {
		t.Fatalf("esperava conflito, veio %+v err=%v", pr, err)
	}
	if err := s.ResolveConflict(b, "theirs"); err != nil {
		t.Fatalf("ResolveConflict(theirs): %v", err)
	}
	if got, _ := os.ReadFile(filepath.Join(b, "req.yml")); string(got) != "name: X\nurl: /from-A\n" {
		t.Fatalf("theirs não adotou a versão do A: %q", got)
	}
	if c, _ := s.conflictedFiles(b); len(c) != 0 {
		t.Fatalf("ainda há conflito após resolver: %v", c)
	}
}

// CloneInto popula um workspace pré-existente (só .gitignore) a partir do
// remoto; InitWorkspace religa o origin de forma idempotente.
func TestCloneIntoAndInitWorkspace(t *testing.T) {
	remote, _ := bareRemote(t)
	s := NewService()

	ws := t.TempDir()
	write(t, ws, ".gitignore", "**/*.local.yml\n") // o que store.Open cria

	if err := s.CloneInto(ws, remote); err != nil {
		t.Fatalf("CloneInto: %v", err)
	}
	if got, _ := os.ReadFile(filepath.Join(ws, "req.yml")); string(got) != "name: X\nurl: /v1\n" {
		t.Fatalf("CloneInto não trouxe o conteúdo: %q", got)
	}
	if err := s.CloneInto(ws, remote); err == nil {
		t.Fatal("CloneInto deveria recusar repo já existente")
	}

	// InitWorkspace idempotente num repo já existente: só reafirma o origin.
	if err := s.InitWorkspace(ws, remote); err != nil {
		t.Fatalf("InitWorkspace (idempotente): %v", err)
	}

	// E num diretório virgem: vira repo com origin.
	fresh := t.TempDir()
	if err := s.InitWorkspace(fresh, remote); err != nil {
		t.Fatalf("InitWorkspace (novo): %v", err)
	}
	if !s.IsRepo(fresh) {
		t.Fatal("InitWorkspace não inicializou o repo")
	}
}

// Cenário de colaboração: remote bare + dois clones. Valida fast-forward,
// conflito como estado, e abort.
func TestPullCollaboration(t *testing.T) {
	base := t.TempDir()
	remote := filepath.Join(base, "remote.git")
	if err := exec.Command("git", "init", "--bare", remote).Run(); err != nil {
		t.Fatal(err)
	}

	a := filepath.Join(base, "a")
	b := filepath.Join(base, "b")
	if err := exec.Command("git", "clone", remote, a).Run(); err != nil {
		t.Fatal(err)
	}
	run(t, a, "checkout", "-b", "main")
	write(t, a, "req.yml", "name: X\nurl: /v1\n")
	run(t, a, "add", "-A")
	run(t, a, "commit", "-m", "init")
	run(t, a, "push", "-u", "origin", "main")

	if err := exec.Command("git", "clone", "-b", "main", remote, b).Run(); err != nil {
		t.Fatal(err)
	}

	s := NewService()
	if _, err := s.OpenRepo(b); err != nil {
		t.Fatal(err)
	}

	// --- fast-forward: A muda e empurra; B puxa ---
	write(t, a, "req.yml", "name: X\nurl: /v2\n")
	run(t, a, "commit", "-am", "bump v2")
	run(t, a, "push", "origin", "main")

	if err := s.Fetch(b); err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	pr, err := s.Pull(b, "main")
	if err != nil {
		t.Fatalf("Pull(ff): %v", err)
	}
	if !pr.FastForward || pr.Conflicted {
		t.Fatalf("esperava fast-forward limpo, veio %+v", pr)
	}
	if got, _ := os.ReadFile(filepath.Join(b, "req.yml")); string(got) != "name: X\nurl: /v2\n" {
		t.Fatalf("conteúdo não atualizou: %q", got)
	}

	// --- conflito: ambos mudam a mesma linha ---
	write(t, a, "req.yml", "name: X\nurl: /from-A\n")
	run(t, a, "commit", "-am", "A edit")
	run(t, a, "push", "origin", "main")

	write(t, b, "req.yml", "name: X\nurl: /from-B\n")
	run(t, b, "commit", "-am", "B edit")

	pr, err = s.Pull(b, "main")
	if err != nil {
		t.Fatalf("Pull(conflito) não deveria ser erro: %v", err)
	}
	if !pr.Conflicted || len(pr.ConflictedFiles) != 1 || pr.ConflictedFiles[0] != "req.yml" {
		t.Fatalf("esperava conflito em req.yml, veio %+v", pr)
	}

	// --- abort restaura o estado pré-merge ---
	if err := s.MergeAbort(b); err != nil {
		t.Fatalf("MergeAbort: %v", err)
	}
	st, _ := s.Status(b)
	for _, f := range append(st.Staged, st.Unstaged...) {
		if f.Status == "conflict" {
			t.Fatalf("ainda há conflito após abort: %+v", st)
		}
	}
	if got, _ := os.ReadFile(filepath.Join(b, "req.yml")); string(got) != "name: X\nurl: /from-B\n" {
		t.Fatalf("abort não restaurou versão do B: %q", got)
	}
}
