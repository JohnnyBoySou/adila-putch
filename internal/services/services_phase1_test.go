package services

// Testes da Fase 1 do ROADMAP: fecham os buracos de cobertura de service no
// backend (Folders, Workspaces, Workspace, Prediction, Sync). Seguem o padrão
// table-driven/AAA do services_test.go e usam store.OpenAt(t.TempDir()) para um
// store isolado, sem rede. Os helpers de teste dos pacotes git/github são
// package-private (package git / package github), então replicamos os
// equivalentes mínimos aqui via os/exec + t.TempDir().

import (
	"os"
	"os/exec"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/joaov/putch/internal/config"
	"github.com/joaov/putch/internal/git"
	"github.com/joaov/putch/internal/github"
	"github.com/joaov/putch/internal/predict"
	"github.com/joaov/putch/internal/store"
)

// ── helpers ───────────────────────────────────────────────────────────────────

// gitCmd roda `git -C dir args...` com autor/committer fixados, falhando o
// teste em erro. Espelha o helper `run` de internal/git/sync_test.go (que não
// é importável daqui).
func gitCmd(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	cmd.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=putch", "GIT_AUTHOR_EMAIL=putch@example.com",
		"GIT_COMMITTER_NAME=putch", "GIT_COMMITTER_EMAIL=putch@example.com",
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

// gitInitRepo transforma dir num repositório git com user configurado, pronto
// para commit sem depender do git config global da máquina.
func gitInitRepo(t *testing.T, dir string) {
	t.Helper()
	gitCmd(t, dir, "init")
	gitCmd(t, dir, "config", "user.email", "putch@example.com")
	gitCmd(t, dir, "config", "user.name", "putch")
}

// suggestionTexts extrai o campo .Text de uma lista de sugestões (o helper
// texts de predict_test.go é package-private).
func suggestionTexts(ss []predict.Suggestion) []string {
	out := make([]string, 0, len(ss))
	for _, s := range ss {
		out = append(out, s.Text)
	}
	return out
}

// ── FoldersService ─────────────────────────────────────────────────────────────

func TestFoldersServiceCRUDAndNesting(t *testing.T) {
	st := newStore(t)
	cols := NewCollectionsService(st)
	svc := NewFoldersService(st)

	// validações do service, antes de tocar o store
	if _, err := svc.Create("col", "", "   "); err == nil {
		t.Fatal("Create devia rejeitar nome vazio")
	}
	if _, err := svc.Create("  ", "", "Pasta"); err == nil {
		t.Fatal("Create devia exigir collection_id")
	}
	// coleção inexistente vira erro de domínio (não o ErrNotFound cru)
	if _, err := svc.Create("ghost", "", "Pasta"); err == nil ||
		!strings.Contains(err.Error(), "não encontrada") {
		t.Fatalf("Create sem coleção: esperava erro de domínio, veio %v", err)
	}

	c, _ := cols.Create(CollectionInput{Name: "API"})

	root, err := svc.Create(c.ID, "", "  Raiz  ")
	if err != nil {
		t.Fatalf("Create raiz: %v", err)
	}
	if root.Name != "Raiz" || root.ParentID != "" || root.CollectionID != c.ID {
		t.Fatalf("folder raiz divergiu: %+v", root)
	}

	sub, err := svc.Create(c.ID, root.ID, "Sub")
	if err != nil {
		t.Fatalf("Create subfolder: %v", err)
	}
	if sub.ParentID != root.ID {
		t.Fatalf("subfolder devia aninhar sob a raiz: %+v", sub)
	}

	// subfolder de pai inexistente → erro de domínio
	if _, err := svc.Create(c.ID, "ghost-parent", "X"); err == nil ||
		!strings.Contains(err.Error(), "não encontrada") {
		t.Fatalf("Create sob pai inexistente: esperava erro, veio %v", err)
	}

	all, err := svc.FindByCollectionID(c.ID)
	if err != nil {
		t.Fatalf("FindByCollectionID: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("esperava 2 folders, veio %d", len(all))
	}

	got, err := svc.FindByID(sub.ID)
	if err != nil || got.ID != sub.ID {
		t.Fatalf("FindByID: %+v %v", got, err)
	}
	if _, err := svc.FindByID("nao-existe"); err == nil ||
		!strings.Contains(err.Error(), "não encontrada") {
		t.Fatalf("FindByID inexistente: esperava erro de domínio, veio %v", err)
	}

	if err := svc.Update(root.ID, "  Renomeada  "); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := svc.Update(root.ID, " "); err == nil {
		t.Fatal("Update devia rejeitar nome vazio")
	}
	after, _ := svc.FindByID(root.ID)
	if after.Name != "Renomeada" {
		t.Fatalf("Update não persistiu: %+v", after)
	}

	if err := svc.Delete(sub.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	remaining, _ := svc.FindByCollectionID(c.ID)
	if len(remaining) != 1 {
		t.Fatalf("esperava 1 folder após Delete, veio %d", len(remaining))
	}
}

func TestFoldersServiceMoveAndCycleGuard(t *testing.T) {
	st := newStore(t)
	cols := NewCollectionsService(st)
	svc := NewFoldersService(st)
	c, _ := cols.Create(CollectionInput{Name: "API"})

	a, _ := svc.Create(c.ID, "", "A")
	b, _ := svc.Create(c.ID, a.ID, "B") // B aninhado sob A

	// id vazio → erro de validação
	if err := svc.Move("", a.ID); err == nil {
		t.Fatal("Move devia exigir id")
	}
	// destino inexistente → erro de domínio
	if err := svc.Move(b.ID, "ghost"); err == nil ||
		!strings.Contains(err.Error(), "não encontrado") {
		t.Fatalf("Move para destino inexistente: esperava erro, veio %v", err)
	}
	// ciclo: mover A para dentro de B (seu descendente) → ErrInvalid traduzido
	if err := svc.Move(a.ID, b.ID); err == nil ||
		!strings.Contains(err.Error(), "dentro dela mesma") {
		t.Fatalf("Move em ciclo: esperava recusa de ciclo, veio %v", err)
	}

	// caminho feliz: mover B para a raiz da coleção
	if err := svc.Move(b.ID, ""); err != nil {
		t.Fatalf("Move para raiz: %v", err)
	}
	moved, _ := svc.FindByID(b.ID)
	if moved.ParentID != "" {
		t.Fatalf("B devia ter ido para a raiz, ParentID=%q", moved.ParentID)
	}
}

func TestFoldersServiceOrdersRoundtrip(t *testing.T) {
	st := newStore(t)
	cols := NewCollectionsService(st)
	svc := NewFoldersService(st)
	c, _ := cols.Create(CollectionInput{Name: "API"})

	a, _ := svc.Create(c.ID, "", "A")
	b, _ := svc.Create(c.ID, "", "B")

	// raiz da coleção (folderID == "")
	want := []string{b.ID, a.ID}
	if err := svc.SetOrder(c.ID, "", want); err != nil {
		t.Fatalf("SetOrder: %v", err)
	}
	orders, err := svc.GetOrders(c.ID)
	if err != nil {
		t.Fatalf("GetOrders: %v", err)
	}
	got := orders[""]
	if len(got) != 2 || got[0] != b.ID || got[1] != a.ID {
		t.Fatalf("ordem da raiz não persistiu: %v", got)
	}
}

// ── WorkspacesService (plural) ──────────────────────────────────────────────────

func TestWorkspacesServiceCRUDAndActive(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	cfg := config.New()
	svc := NewWorkspacesService(st, cfg)

	// OpenAt já garante um workspace "Padrão" ativo
	initial, err := svc.FindAll()
	if err != nil {
		t.Fatalf("FindAll: %v", err)
	}
	if len(initial) != 1 {
		t.Fatalf("esperava 1 workspace inicial (Padrão), veio %d", len(initial))
	}
	active, err := svc.GetActive()
	if err != nil || !active.IsActive {
		t.Fatalf("GetActive inicial: %+v %v", active, err)
	}

	// validação: nome obrigatório (com trim)
	if _, err := svc.Create(WorkspaceInput{Name: "   "}); err == nil {
		t.Fatal("Create devia rejeitar nome vazio")
	}

	dev, err := svc.Create(WorkspaceInput{Name: "  Dev  ", Description: " api ", Pinned: true})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if dev.Name != "Dev" || dev.Description != "api" {
		t.Fatalf("trim não aplicado: %+v", dev)
	}

	// pinned aparece primeiro na listagem
	list, _ := svc.FindAll()
	if len(list) != 2 || list[0].ID != dev.ID {
		t.Fatalf("pinnedFirst não colocou o fixado no topo: %+v", list)
	}

	// SetActive troca o ativo e persiste no config compartilhado
	got, err := svc.SetActive(dev.ID)
	if err != nil {
		t.Fatalf("SetActive: %v", err)
	}
	if !got.IsActive || got.ID != dev.ID {
		t.Fatalf("SetActive não marcou ativo: %+v", got)
	}
	if id, _ := cfg.Get(ConfigKeyActiveWorkspace, "").(string); id != dev.ID {
		t.Fatalf("ativo não persistido no config: %q", id)
	}

	// Update com trim + validação
	if err := svc.Update(dev.ID, WorkspaceInput{Name: " "}); err == nil {
		t.Fatal("Update devia rejeitar nome vazio")
	}
	if err := svc.Update(dev.ID, WorkspaceInput{Name: "Dev2"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	after, _ := svc.GetActive()
	if after.Name != "Dev2" {
		t.Fatalf("Update não persistiu: %+v", after)
	}
}

// TestWorkspacesServiceDeleteNeverLeavesEmpty cobre a garantia de "nunca sem
// workspace": deletar o ativo repontar para outro; deletar o último recria um
// "Padrão".
func TestWorkspacesServiceDeleteNeverLeavesEmpty(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	cfg := config.New()
	svc := NewWorkspacesService(st, cfg)

	base, _ := svc.GetActive() // "Padrão", ativo
	dev, _ := svc.Create(WorkspaceInput{Name: "Dev"})

	// deletar um NÃO-ativo: some da lista, ativo intacto
	if err := svc.Delete(dev.ID); err != nil {
		t.Fatalf("Delete não-ativo: %v", err)
	}
	if list, _ := svc.FindAll(); len(list) != 1 {
		t.Fatalf("esperava 1 workspace após deletar o não-ativo, veio %d", len(list))
	}
	if act, _ := svc.GetActive(); act.ID != base.ID {
		t.Fatalf("ativo não devia mudar ao deletar outro: %+v", act)
	}

	// recria e deleta o ATIVO: precisa repontar para o remanescente
	other, _ := svc.Create(WorkspaceInput{Name: "Outro"})
	if err := svc.Delete(base.ID); err != nil {
		t.Fatalf("Delete ativo: %v", err)
	}
	act, err := svc.GetActive()
	if err != nil {
		t.Fatalf("GetActive após deletar o ativo: %v", err)
	}
	if act.ID != other.ID {
		t.Fatalf("ativo devia cair no remanescente (%s), veio %s", other.ID, act.ID)
	}

	// deletar o ÚLTIMO workspace: recria um "Padrão" para não ficar sem
	if err := svc.Delete(other.ID); err != nil {
		t.Fatalf("Delete último: %v", err)
	}
	list, _ := svc.FindAll()
	if len(list) != 1 || list[0].Name != "Padrão" {
		t.Fatalf("deletar o último devia recriar Padrão, veio %+v", list)
	}
	if _, err := svc.GetActive(); err != nil {
		t.Fatalf("devia haver um ativo após recriação: %v", err)
	}
}

// ── WorkspaceService (singular) ─────────────────────────────────────────────────

func TestWorkspaceServicePathAndReset(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	cfg := config.New()
	svc := NewWorkspaceService(st, cfg)

	// GetPath reflete o root em runtime do store
	if svc.GetPath() != st.Root {
		t.Fatalf("GetPath divergiu: %q != %q", svc.GetPath(), st.Root)
	}

	// simula uma preferência salva de uma sessão anterior
	if err := cfg.Set(ConfigKeyWorkspace, "/algum/path/antigo"); err != nil {
		t.Fatalf("cfg.Set: %v", err)
	}

	// ResetToDefault: volta ao root padrão (sob o XDG isolado) e limpa a
	// preferência. Não testamos Choose (abre diálogo nativo).
	path, err := svc.ResetToDefault()
	if err != nil {
		t.Fatalf("ResetToDefault: %v", err)
	}
	if path != st.Root {
		t.Fatalf("ResetToDefault devia devolver o novo root: %q != %q", path, st.Root)
	}
	if !strings.Contains(path, "putch") {
		t.Fatalf("root padrão devia estar sob a config dir do putch: %q", path)
	}
	// preferência resetada → Get cai no default
	if v, _ := cfg.Get(ConfigKeyWorkspace, "").(string); v != "" {
		t.Fatalf("preferência de workspace não foi resetada: %q", v)
	}
}

// ── PredictionService ───────────────────────────────────────────────────────────

// TestPredictionServiceSuggestAndTTL cobre o caminho feliz (cold start + match
// por histórico) e a semântica de rebuild lazy por TTL: dentro do TTL o índice
// NÃO é reconstruído; forçando lastBuild para o passado, o rebuild vê a request
// nova. Manipulamos o campo privado lastBuild direto (mesmo package) para tornar
// o teste determinístico sem sleep (predictTTL é const, não regulável).
func TestPredictionServiceSuggestAndTTL(t *testing.T) {
	st := newStore(t)
	cols := NewCollectionsService(st)
	reqs := NewRequestsService(st)
	svc := NewPredictionService(st)

	// cold start: sem histórico, prefixo de esquema sugere https:// e http://
	cold, err := svc.Suggest(predict.Request{Field: predict.FieldURL, Prefix: "ht", Limit: 8})
	if err != nil {
		t.Fatalf("Suggest cold: %v", err)
	}
	if texts := suggestionTexts(cold); !slices.Contains(texts, "https://") {
		t.Fatalf("cold start devia sugerir https://, veio %v", texts)
	}

	// cria uma request DEPOIS do primeiro build; dentro do TTL não deve aparecer
	c, _ := cols.Create(CollectionInput{Name: "API"})
	const apiURL = "https://api.exemplo.com/users"
	if _, err := reqs.Create(RequestInput{
		Name: "users", CollectionID: c.ID, Method: "GET", URL: apiURL,
	}); err != nil {
		t.Fatalf("Create request: %v", err)
	}

	within, err := svc.Suggest(predict.Request{Field: predict.FieldURL, Prefix: "https://api", Limit: 8})
	if err != nil {
		t.Fatalf("Suggest dentro do TTL: %v", err)
	}
	if slices.Contains(suggestionTexts(within), apiURL) {
		t.Fatalf("dentro do TTL o índice não devia reconstruir e ver a request nova: %v",
			suggestionTexts(within))
	}

	// força a expiração do TTL: o próximo Suggest reconstrói e vê a request
	svc.lastBuild = time.Now().Add(-2 * predictTTL)
	after, err := svc.Suggest(predict.Request{Field: predict.FieldURL, Prefix: "https://api", Limit: 8})
	if err != nil {
		t.Fatalf("Suggest após TTL: %v", err)
	}
	if !slices.Contains(suggestionTexts(after), apiURL) {
		t.Fatalf("após o TTL o rebuild devia sugerir a URL do histórico, veio %v",
			suggestionTexts(after))
	}
}

// ── SyncService ─────────────────────────────────────────────────────────────────

// newSyncService monta um SyncService com github não-autenticado (XDG isolado,
// sem rede) sobre o store dado.
func newSyncService(t *testing.T, st *store.Store) *SyncService {
	t.Helper()
	gh := github.NewService(config.New())
	if gh.IsAuthenticated() {
		t.Fatal("github não devia estar autenticado num XDG isolado")
	}
	return NewSyncService(st, git.NewService(), gh)
}

func TestSyncServiceStatusAndCommit(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	svc := newSyncService(t, st)

	// antes de virar repo: não é repo, considerado limpo
	pre, err := svc.Status()
	if err != nil {
		t.Fatalf("Status pré-repo: %v", err)
	}
	if pre.IsRepo || !pre.Clean {
		t.Fatalf("workspace sem git devia ser não-repo e limpo: %+v", pre)
	}

	// Commit fora de repo é recusado com erro de domínio
	if _, err := svc.Commit("msg"); err == nil ||
		!strings.Contains(err.Error(), "repositório") {
		t.Fatalf("Commit fora de repo: esperava erro, veio %v", err)
	}

	// vira repo git; os YAML criados pelo OpenAt aparecem como não rastreados
	gitInitRepo(t, st.Root)
	dirty, err := svc.Status()
	if err != nil {
		t.Fatalf("Status pós-init: %v", err)
	}
	if !dirty.IsRepo {
		t.Fatal("Status devia reconhecer o repo")
	}
	if dirty.Clean || len(dirty.Changes) == 0 {
		t.Fatalf("devia haver arquivos não rastreados: %+v", dirty)
	}

	// mensagem vazia é rejeitada
	if _, err := svc.Commit("   "); err == nil {
		t.Fatal("Commit devia rejeitar mensagem vazia")
	}

	// commit real: estagia tudo e retorna um sha
	sha, err := svc.Commit("commit inicial")
	if err != nil {
		t.Fatalf("Commit: %v", err)
	}
	if strings.TrimSpace(sha) == "" {
		t.Fatal("Commit devia retornar um sha não vazio")
	}

	// após commitar tudo, o workspace fica limpo
	clean, err := svc.Status()
	if err != nil {
		t.Fatalf("Status pós-commit: %v", err)
	}
	if !clean.Clean || len(clean.Changes) != 0 {
		t.Fatalf("workspace devia estar limpo após commit: %+v", clean)
	}
}

// TestSyncServicePushPull exercita a orquestração de rede LOCAL (bare remote em
// disco, sem internet): conectar remote → commit → push → pull up-to-date.
func TestSyncServicePushPull(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	svc := newSyncService(t, st)

	// remote bare local faz o papel do origin
	bare := t.TempDir()
	gitCmd(t, bare, "init", "--bare")

	// ConnectRemote inicializa o repo e adiciona o origin (sem token: não
	// autenticado, AuthenticatedURL devolve a URL/path inalterado)
	if err := svc.ConnectRemote(bare); err != nil {
		t.Fatalf("ConnectRemote: %v", err)
	}
	// user do repo para o commit ter autor
	gitCmd(t, st.Root, "config", "user.email", "putch@example.com")
	gitCmd(t, st.Root, "config", "user.name", "putch")

	if _, err := svc.Commit("inicial"); err != nil {
		t.Fatalf("Commit: %v", err)
	}
	if err := svc.Push(); err != nil {
		t.Fatalf("Push: %v", err)
	}

	// nada novo no remote → pull reporta already-up-to-date, sem conflito
	res, err := svc.Pull()
	if err != nil {
		t.Fatalf("Pull: %v", err)
	}
	if res.Conflicted {
		t.Fatalf("Pull não devia conflitar logo após o push: %+v", res)
	}
	if !res.AlreadyUpToDate && !res.FastForward && !res.Merged {
		t.Fatalf("Pull devia reportar estado consistente: %+v", res)
	}
}

func TestSyncServiceGuardsAndGitHub(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	st := newStore(t)
	svc := newSyncService(t, st)

	// github não-autenticado: conta vazia, sem erro (não trava a UI)
	acc, err := svc.GitHub()
	if err != nil {
		t.Fatalf("GitHub: %v", err)
	}
	if acc.Authenticated {
		t.Fatalf("conta não devia estar autenticada: %+v", acc)
	}

	// ResolveConflict com estratégia inválida é recusado pelo motor git
	gitInitRepo(t, st.Root)
	if err := svc.ResolveConflict("xpto"); err == nil ||
		!strings.Contains(err.Error(), "inválida") {
		t.Fatalf("ResolveConflict inválida: esperava erro, veio %v", err)
	}
}

// TestSanitizeURL garante que o token (userinfo) nunca vaza para a UI/logs.
func TestSanitizeURL(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{
			name: "remove token x-access-token",
			raw:  "https://x-access-token:ghp_segredo@github.com/acme/repo.git",
			want: "https://github.com/acme/repo.git",
		},
		{
			name: "remove userinfo simples",
			raw:  "https://user:senha@github.com/acme/repo.git",
			want: "https://github.com/acme/repo.git",
		},
		{
			name: "url sem userinfo permanece intacta",
			raw:  "https://github.com/acme/repo.git",
			want: "https://github.com/acme/repo.git",
		},
		{
			name: "url inválida é devolvida como veio",
			raw:  "://sem-esquema",
			want: "://sem-esquema",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := sanitizeURL(tt.raw); got != tt.want {
				t.Fatalf("sanitizeURL(%q) = %q, quer %q", tt.raw, got, tt.want)
			}
		})
	}
}
