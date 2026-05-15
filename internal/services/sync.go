package services

// SyncService é a fachada de colaboração do putch: orquestra store (a pasta do
// workspace), git (motor local) e github (auth + API) numa superfície enxuta
// e estável para os bindings Wails. As engines (internal/git, internal/github)
// têm dezenas de métodos low-level — aqui expomos só o que a UI da Fase 7 usa
// para o fluxo "criar coleção → commit → outra pessoa pull".
//
// Segredos continuam protegidos pelo store (<env>.local.yml gitignored); esta
// camada nunca commita à mão — sempre `git add -A` respeitando o .gitignore.

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/joaov/putch/internal/git"
	"github.com/joaov/putch/internal/github"
	"github.com/joaov/putch/internal/store"
)

type GitHubAccount struct {
	Authenticated bool   `json:"authenticated"`
	Login         string `json:"login"`
	Name          string `json:"name"`
	AvatarURL     string `json:"avatarUrl"`
}

type ChangedFile struct {
	Path   string `json:"path"`
	Status string `json:"status"` // added|modified|deleted|untracked|conflict
}

type WorkspaceStatus struct {
	Path            string        `json:"path"`
	IsRepo          bool          `json:"isRepo"`
	HasRemote       bool          `json:"hasRemote"`
	RemoteURL       string        `json:"remoteUrl"` // sem token (sanitizada)
	Branch          string        `json:"branch"`
	Ahead           int           `json:"ahead"`
	Behind          int           `json:"behind"`
	Clean           bool          `json:"clean"`
	Changes         []ChangedFile `json:"changes"`
	Conflicted      bool          `json:"conflicted"`
	ConflictedFiles []string      `json:"conflictedFiles"`
}

type SyncService struct {
	store  *store.Store
	git    *git.Service
	github *github.Service
}

func NewSyncService(st *store.Store, g *git.Service, gh *github.Service) *SyncService {
	return &SyncService{store: st, git: g, github: gh}
}

func (s *SyncService) root() string { return s.store.Root }

// ── GitHub auth (Device Flow) ─────────────────────────────────────────────────

// GitHub devolve o estado da conta. Se autenticado, busca o perfil
// (best-effort: token inválido degrada para não-autenticado).
func (s *SyncService) GitHub() (GitHubAccount, error) {
	if !s.github.IsAuthenticated() {
		return GitHubAccount{}, nil
	}
	u, err := s.github.GetUser()
	if err != nil {
		// Token presente mas rejeitado/offline: não trava a UI.
		return GitHubAccount{Authenticated: true}, nil
	}
	return GitHubAccount{
		Authenticated: true,
		Login:         u.Login,
		Name:          u.Name,
		AvatarURL:     u.AvatarURL,
	}, nil
}

// StartGitHubLogin inicia o Device Flow e já dispara o polling em background.
// O sucesso emite "github.changed" (via hook Emit, ligado no main) para a UI
// recarregar — o frontend só precisa mostrar UserCode/VerificationURI.
func (s *SyncService) StartGitHubLogin() (github.DeviceFlowStart, error) {
	df, err := s.github.StartDeviceFlow()
	if err != nil {
		return github.DeviceFlowStart{}, err
	}
	go func() {
		// Erro do polling (timeout/cancelado) não tem para onde subir aqui;
		// a UI percebe pela ausência do evento e pelo botão de cancelar.
		_ = s.github.PollDeviceToken(df.DeviceCode, df.Interval)
	}()
	return df, nil
}

func (s *SyncService) CancelGitHubLogin() {
	s.github.CancelDeviceFlow()
}

func (s *SyncService) GitHubLogout() error {
	return s.github.Logout()
}

func (s *SyncService) ListRepos() ([]github.GitHubUserRepo, error) {
	return s.github.ListMyRepos(100)
}

// ── Workspace status ──────────────────────────────────────────────────────────

// Status é o retrato único que a UI consome: é repo?, branch, ahead/behind vs
// origin, arquivos alterados e estado de conflito. Tudo best-effort — offline
// ou sem remoto não é erro, só campos zerados.
func (s *SyncService) Status() (WorkspaceStatus, error) {
	root := s.root()
	ws := WorkspaceStatus{Path: root, Clean: true}

	if !s.git.IsRepo(root) {
		return ws, nil
	}
	ws.IsRepo = true

	if br, err := s.git.CurrentBranch(root); err == nil {
		ws.Branch = br
	}

	if ri, err := s.git.RemoteInfo(root); err == nil && ri != nil && ri.URL != "" {
		ws.HasRemote = true
		ws.RemoteURL = sanitizeURL(ri.URL)
	}

	// Atualiza refs remotas para o ahead/behind ser real; offline → ignora.
	if ws.HasRemote {
		_ = s.git.Fetch(root)
		if ws.Branch != "" {
			if ab, err := s.git.AheadBehind(root, "origin/"+ws.Branch, ws.Branch); err == nil {
				ws.Ahead, ws.Behind = ab.Ahead, ab.Behind
			}
		}
	}

	st, err := s.git.Status(root)
	if err != nil {
		return ws, err
	}
	add := func(fs []git.FileChange) {
		for _, f := range fs {
			ws.Changes = append(ws.Changes, ChangedFile{Path: f.Path, Status: f.Status})
		}
	}
	add(st.Staged)
	add(st.Unstaged)
	add(st.Untracked)

	if conflicts, err := s.git.Conflicts(root); err == nil && len(conflicts) > 0 {
		ws.Conflicted = true
		ws.ConflictedFiles = conflicts
	} else if s.git.MergeInProgress(root) {
		// Merge começado mas sem arquivos U (ex.: resolvidos mas não commitado).
		ws.Conflicted = true
	}

	ws.Clean = len(ws.Changes) == 0 && !ws.Conflicted
	return ws, nil
}

// ── Operações de sync ─────────────────────────────────────────────────────────

// Commit estagia o workspace inteiro (respeitando .gitignore, então segredos
// .local.yml ficam de fora) e commita. Autor vem do git config do usuário.
func (s *SyncService) Commit(message string) (string, error) {
	if strings.TrimSpace(message) == "" {
		return "", fmt.Errorf("mensagem de commit não pode ser vazia")
	}
	root := s.root()
	if !s.git.IsRepo(root) {
		return "", fmt.Errorf("workspace ainda não está conectado a um repositório")
	}
	if err := s.git.StageAll(root); err != nil {
		return "", err
	}
	return s.git.Commit(root, message, "", "")
}

func (s *SyncService) Push() error {
	root := s.root()
	branch, err := s.git.CurrentBranch(root)
	if err != nil {
		return err
	}
	return s.git.Push(root, branch)
}

func (s *SyncService) Pull() (*git.PullResult, error) {
	root := s.root()
	branch, err := s.git.CurrentBranch(root)
	if err != nil {
		return nil, err
	}
	if err := s.git.Fetch(root); err != nil {
		return nil, err
	}
	return s.git.Pull(root, branch)
}

// ResolveConflict aceita "ours" (manter as minhas), "theirs" (usar as deles)
// ou "abort" (desistir do merge).
func (s *SyncService) ResolveConflict(strategy string) error {
	return s.git.ResolveConflict(s.root(), strategy)
}

// ── Conectar / clonar workspace ───────────────────────────────────────────────

// ConnectRemote liga o workspace atual a um repositório (o criador publicando).
// Injeta o token na URL https para push em repo privado funcionar sem
// credential helper (mesmo tradeoff do clone: token só no .git/config local).
func (s *SyncService) ConnectRemote(remoteURL string) error {
	authed := s.github.AuthenticatedURL(remoteURL)
	return s.git.InitWorkspace(s.root(), authed)
}

// CloneWorkspace popula o workspace a partir de um repositório existente
// (o colaborador entrando). Recusa se já houver um repo conectado.
func (s *SyncService) CloneWorkspace(cloneURL string) error {
	authed := s.github.AuthenticatedURL(cloneURL)
	return s.git.CloneInto(s.root(), authed)
}

// sanitizeURL remove qualquer userinfo (token x-access-token:...) antes de
// devolver a URL para a UI — o token nunca aparece na tela nem em logs.
func sanitizeURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.User == nil {
		return raw
	}
	u.User = nil
	return u.String()
}
