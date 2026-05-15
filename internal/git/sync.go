package git

import (
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

// Fetch / Pull / MergeAbort: a operação que faltava no stash e que o fluxo de
// colaboração do putch exige ("outra pessoa faz pull").
//
// Usa o git do sistema (igual a Push/StashPush/AheadBehind já portados):
// credential helpers, SSH config e merge recursivo de verdade — o merge do
// go-git é fraco demais para resolver divergências reais entre colaboradores.
// Um conflito é devolvido como ESTADO estruturado (PullResult.Conflicted),
// não como erro, para a UI da Fase 7 conduzir a resolução.

type PullResult struct {
	AlreadyUpToDate bool     `json:"alreadyUpToDate"`
	FastForward     bool     `json:"fastForward"`
	Merged          bool     `json:"merged"`
	Conflicted      bool     `json:"conflicted"`
	ConflictedFiles []string `json:"conflictedFiles"`
	Output          string   `json:"output"`
}

// Fetch atualiza as refs remotas sem mexer na árvore de trabalho. Idempotente:
// "já atualizado" não é erro.
func (s *Service) Fetch(repoPath string) error {
	cmd := exec.Command("git", "-C", repoPath, "fetch", "--prune", "origin")
	out, err := cmd.CombinedOutput()
	if err != nil {
		o := strings.TrimSpace(string(out))
		if strings.Contains(o, "up to date") {
			return nil
		}
		return fmt.Errorf("git fetch falhou: %s", o)
	}
	return nil
}

// Pull faz fetch+merge da branch em origin. Não propaga o exit≠0 do git quando
// a causa é conflito de merge — nesse caso devolve PullResult{Conflicted:true}
// com os arquivos em conflito, deixando a árvore no estado de merge para o
// usuário resolver (ou abortar via MergeAbort).
func (s *Service) Pull(repoPath, branch string) (*PullResult, error) {
	if strings.TrimSpace(branch) == "" {
		return nil, errors.New("nome da branch vazio")
	}
	// --no-rebase: força estratégia de merge explícita. Sem isso, git ≥2.27
	// recusa pull em branches divergentes ("Need to specify how to reconcile").
	// Merge é o desejado: conflito vira estado tratável (não erro).
	cmd := exec.Command("git", "-C", repoPath, "pull", "--no-rebase", "--no-edit", "origin", branch)
	out, err := cmd.CombinedOutput()
	o := strings.TrimSpace(string(out))
	res := &PullResult{Output: o}

	switch {
	case strings.Contains(o, "Already up to date"):
		res.AlreadyUpToDate = true
	case strings.Contains(o, "Fast-forward"):
		res.FastForward = true
	}

	if err != nil {
		conflicts, cerr := s.conflictedFiles(repoPath)
		if cerr == nil && len(conflicts) > 0 {
			res.Conflicted = true
			res.ConflictedFiles = conflicts
			return res, nil // conflito é estado, não erro
		}
		return nil, fmt.Errorf("git pull falhou: %s", o)
	}

	if !res.AlreadyUpToDate && !res.FastForward {
		res.Merged = true
	}
	return res, nil
}

// StageAll põe tudo no índice (`git add -A`), incluindo deleções e arquivos
// novos — o que o fluxo do putch quer antes de um Commit ("commitar o
// workspace inteiro"). Usa git de sistema, igual ao resto do sync.
func (s *Service) StageAll(repoPath string) error {
	if out, err := exec.Command("git", "-C", repoPath, "add", "-A").CombinedOutput(); err != nil {
		return fmt.Errorf("git add -A falhou: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// Conflicts expõe a lista de arquivos não-mesclados (wrapper público de
// conflictedFiles) para a UI montar o status sem disparar um Pull.
func (s *Service) Conflicts(repoPath string) ([]string, error) {
	return s.conflictedFiles(repoPath)
}

// CurrentBranch devolve a branch atual via `symbolic-ref --short HEAD` — que,
// diferente de `rev-parse`, resolve mesmo numa branch ainda não-nascida
// (repo recém-init, antes do primeiro commit). Necessário para Push.
func (s *Service) CurrentBranch(repoPath string) (string, error) {
	out, err := exec.Command("git", "-C", repoPath, "symbolic-ref", "--short", "HEAD").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git symbolic-ref falhou: %s", strings.TrimSpace(string(out)))
	}
	b := strings.TrimSpace(string(out))
	if b == "" {
		return "", errors.New("HEAD desanexado (sem branch)")
	}
	return b, nil
}

// MergeInProgress detecta um merge inacabado (.git/MERGE_HEAD) — necessário
// para a UI reconduzir o fluxo de conflito após reabrir o app no meio dele.
func (s *Service) MergeInProgress(repoPath string) bool {
	out, err := exec.Command("git", "-C", repoPath, "rev-parse", "--verify", "-q", "MERGE_HEAD").CombinedOutput()
	return err == nil && strings.TrimSpace(string(out)) != ""
}

// MergeAbort cancela um merge em andamento e volta a árvore ao estado anterior.
// Escotilha de saída do fluxo de conflito.
func (s *Service) MergeAbort(repoPath string) error {
	cmd := exec.Command("git", "-C", repoPath, "merge", "--abort")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git merge --abort falhou: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// ResolveConflict encerra um merge conflitado escolhendo um lado inteiro.
// Granularidade de árvore (não por-arquivo) é suficiente para o modelo do
// putch: coleções são YAML pequenos, e a UI da Fase 7 expõe três botões.
//
//   - "abort"  → desfaz o merge (MergeAbort)
//   - "ours"   → mantém a versão local (a de quem deu pull)
//   - "theirs" → adota a versão recebida do remoto
//
// Em ours/theirs faz checkout do lado nos arquivos em conflito, dá `add -A` e
// fecha o merge com `commit --no-edit` (usa a MERGE_MSG já preparada).
func (s *Service) ResolveConflict(repoPath, strategy string) error {
	switch strategy {
	case "abort":
		return s.MergeAbort(repoPath)
	case "ours", "theirs":
	default:
		return fmt.Errorf("estratégia inválida: %q (use ours, theirs ou abort)", strategy)
	}

	files, err := s.conflictedFiles(repoPath)
	if err != nil {
		return err
	}
	if len(files) == 0 {
		return errors.New("nenhum arquivo em conflito para resolver")
	}

	args := append([]string{"-C", repoPath, "checkout", "--" + strategy, "--"}, files...)
	if out, err := exec.Command("git", args...).CombinedOutput(); err != nil {
		return fmt.Errorf("git checkout --%s falhou: %s", strategy, strings.TrimSpace(string(out)))
	}
	if out, err := exec.Command("git", "-C", repoPath, "add", "-A").CombinedOutput(); err != nil {
		return fmt.Errorf("git add falhou: %s", strings.TrimSpace(string(out)))
	}
	if out, err := exec.Command("git", "-C", repoPath, "commit", "--no-edit").CombinedOutput(); err != nil {
		return fmt.Errorf("git commit (fechar merge) falhou: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// InitWorkspace transforma repoPath num repositório git com origin apontando
// para remoteURL — o passo do criador que vai publicar o workspace. Idempotente:
// se já for repo, apenas garante o remote. Não faz commit nem push (a UI
// conduz isso via Commit/Push depois).
func (s *Service) InitWorkspace(repoPath, remoteURL string) error {
	if strings.TrimSpace(remoteURL) == "" {
		return errors.New("URL do remoto vazia")
	}
	if !s.IsRepo(repoPath) {
		if out, err := exec.Command("git", "-C", repoPath, "init").CombinedOutput(); err != nil {
			return fmt.Errorf("git init falhou: %s", strings.TrimSpace(string(out)))
		}
	}
	// remote set-url falha se origin não existe; remote add falha se já existe.
	// Tentar add e, se já existir, set-url cobre os dois casos.
	if out, err := exec.Command("git", "-C", repoPath, "remote", "add", "origin", remoteURL).CombinedOutput(); err != nil {
		if out2, err2 := exec.Command("git", "-C", repoPath, "remote", "set-url", "origin", remoteURL).CombinedOutput(); err2 != nil {
			return fmt.Errorf("configurar origin falhou: %s / %s",
				strings.TrimSpace(string(out)), strings.TrimSpace(string(out2)))
		}
	}
	return nil
}

// CloneInto popula repoPath (que já existe, p.ex. com só o .gitignore) a
// partir de um remoto — o passo de quem ENTRA num workspace já publicado.
// `git clone` exige diretório vazio; aqui fazemos init+fetch+checkout -f para
// trazer o conteúdo sem exigir mover a pasta do workspace.
func (s *Service) CloneInto(repoPath, cloneURL string) error {
	if strings.TrimSpace(cloneURL) == "" {
		return errors.New("URL de clone vazia")
	}
	if s.IsRepo(repoPath) {
		return errors.New("workspace já é um repositório git")
	}
	branch, err := s.defaultRemoteBranch(cloneURL)
	if err != nil {
		return err
	}
	if out, err := exec.Command("git", "-C", repoPath, "init").CombinedOutput(); err != nil {
		return fmt.Errorf("git init falhou: %s", strings.TrimSpace(string(out)))
	}
	if out, err := exec.Command("git", "-C", repoPath, "remote", "add", "origin", cloneURL).CombinedOutput(); err != nil {
		return fmt.Errorf("git remote add falhou: %s", strings.TrimSpace(string(out)))
	}
	if out, err := exec.Command("git", "-C", repoPath, "fetch", "origin").CombinedOutput(); err != nil {
		return fmt.Errorf("git fetch falhou: %s", strings.TrimSpace(string(out)))
	}
	// -f descarta o .gitignore local autogerado em favor do que vier do remoto.
	if out, err := exec.Command("git", "-C", repoPath, "checkout", "-f", "-B", branch, "origin/"+branch).CombinedOutput(); err != nil {
		return fmt.Errorf("git checkout falhou: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// IsRepo testa se path já tem um repositório git (rev-parse é barato e exato).
func (s *Service) IsRepo(path string) bool {
	err := exec.Command("git", "-C", path, "rev-parse", "--git-dir").Run()
	return err == nil
}

// defaultRemoteBranch descobre a branch padrão do remoto sem clonar.
// Primário: `ls-remote --symref HEAD` (no GitHub o symref do default sempre
// existe). Fallback: lista as heads e escolhe — única branch, ou main/master
// por convenção — para cobrir remotos cujo HEAD aponta a branch não-nascida.
func (s *Service) defaultRemoteBranch(url string) (string, error) {
	if out, err := exec.Command("git", "ls-remote", "--symref", url, "HEAD").CombinedOutput(); err == nil {
		for line := range strings.SplitSeq(string(out), "\n") {
			// Formato: "ref: refs/heads/main\tHEAD"
			if rest, ok := strings.CutPrefix(line, "ref: refs/heads/"); ok {
				if i := strings.IndexAny(rest, " \t"); i > 0 {
					return rest[:i], nil
				}
			}
		}
	}

	out, err := exec.Command("git", "ls-remote", "--heads", url).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git ls-remote falhou: %s", strings.TrimSpace(string(out)))
	}
	var heads []string
	for line := range strings.SplitSeq(strings.TrimSpace(string(out)), "\n") {
		if _, ref, ok := strings.Cut(line, "refs/heads/"); ok {
			heads = append(heads, strings.TrimSpace(ref))
		}
	}
	switch {
	case len(heads) == 0:
		return "", errors.New("remoto não tem branches")
	case len(heads) == 1:
		return heads[0], nil
	}
	for _, pref := range []string{"main", "master"} {
		for _, h := range heads {
			if h == pref {
				return h, nil
			}
		}
	}
	return heads[0], nil
}

// conflictedFiles lista os arquivos não-mesclados via git de sistema
// (`diff --diff-filter=U`), forma canônica e autoritativa. O Status() do
// go-git não lê índices em conflito (entradas com stage>0) de forma
// confiável — mesma limitação que nos fez evitar o merge do go-git.
func (s *Service) conflictedFiles(repoPath string) ([]string, error) {
	cmd := exec.Command("git", "-C", repoPath, "diff", "--name-only", "--diff-filter=U")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("git diff --diff-filter=U falhou: %s", strings.TrimSpace(string(out)))
	}
	var files []string
	for line := range strings.SplitSeq(strings.TrimSpace(string(out)), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			files = append(files, line)
		}
	}
	return files, nil
}
