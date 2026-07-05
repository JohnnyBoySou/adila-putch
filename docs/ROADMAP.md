# putch — Plano de implementação das lacunas

> Deriva de [`STATUS.md`](./STATUS.md) (varredura de 2026-07-04). Cada item traz o
> **porquê**, os **arquivos reais a tocar** por camada, o **critério de pronto** e
> uma estimativa grosseira de esforço (P = pessoa-dia ideal).
>
> **Arquitetura a respeitar em toda feature nova** (fluxo padrão do projeto):
> `internal/<pkg>` → método no **service** de `internal/services/` (vira binding) →
> `task bindings` → `frontend/src/services/*.service.ts` → `stores/*.store.ts`
> (Zustand, optimistic) → `hooks/use*.ts` → tela em `features/**` + rota em
> `routes/panel/**`. Gates: `task typecheck` + `go test -race`.

## Ordem recomendada

| Fase | Item | Prioridade | Esforço |
|---|---|---|---|
| 0 | Higiene: typo de arquivo, duplicação de service, `updated_at` | P0 | ✅ concluída |
| 1 | Fechar buracos de teste de service no backend | P1 | ~1.5 P |
| 2 | Expor histórico/branches/diff de git na UI | P1 | ~4 P |
| 3 | Fluxo de PR / code review na UI | P1 | ~6 P |
| 4 | Round-trip completo de import/export de coleção | P2 | ~2 P |
| 5 | Tela de perfil (ou remoção) | P3 | ~1 P |
| 6 | Base de testes de frontend + gates de CI | P2 (adiado) | ~3 P |

Total grosseiro: ~18 pessoa-dia. As Fases 2–3 são as maiores entregas de valor
(capacidade já pronta no backend, sem UI). **A base de testes de frontend foi
adiada para a Fase 6** por decisão de priorização — segue sendo a maior dívida de
qualidade, mas não bloqueia as entregas de valor. Ver nota em §Fase 6 sobre uma
parte barata (lint/format bloqueantes) que pode ser antecipada isolada.

---

## Fase 0 — Higiene (P0, ~0.5 P) — ✅ CONCLUÍDA (2026-07-04)

Correções baratas que reduzem atrito antes das features maiores.

1. ✅ **Renomeado `enviroments.service.ts` → `environments.service.ts`**
   (`frontend/src/services/`, via `git mv` preservando histórico). Os 6 imports
   atualizados (5 via alias `@/services/...`, 1 relativo). `task typecheck` verde.
2. ✅ **`workspace.service.ts` vs `workspaces.service.ts`**: confirmados como os
   dois serviços Go legítimos e distintos — singular = `WorkspaceService` (escolhe
   a PASTA root do store); plural = `WorkspacesService` (CRUD dos workspaces dentro
   do root). Sem sobreposição, nada a consolidar. Cabeçalho de disambiguação agora
   no topo de **ambos** os arquivos.
3. ✅ **`updated_at` de Request** — decisão **(b)**: mantém espelhando `created_at`.
   O histórico do git é a fonte da verdade para modificação; já documentado no DTO
   em `internal/services/requests.go` (`toRequest`, l. 147-149). Nenhuma mudança de
   código necessária — a decisão só estava implícita, agora está registrada aqui.

**Pronto quando**: `task typecheck` e `go test -race ./...` verdes, sem imports
quebrados, distinção de workspace(s) documentada. → **Atingido**: ambos os gates
verdes, zero refs ao typo `enviroments`, distinção documentada nos dois arquivos.

---

## Fase 1 — Buracos de teste de service no backend (P1, ~1.5 P) ✅ CONCLUÍDA

**Por quê**: `services_test.go` cobre Collections/Environments/Requests/Tests, mas
**não** Folders, Workspaces, Workspace, Prediction e Sync. Fechar isso cedo dá
rede de segurança para as Fases 2–3, que estendem justamente o `SyncService`.

**Passos** (em `internal/services/`, tabela-driven, padrão dos testes existentes):

1. ✅ `FoldersService`: create aninhado, `Move` (incl. recusa de ciclo, delegando
   ao store), `GetOrders/SetOrder`, delete + validações (nome/collection_id vazios,
   pai/coleção inexistentes traduzidos para erro de domínio).
2. ✅ `WorkspacesService`: CRUD com trim, `SetActive` (persiste no config), pinned
   primeiro no `FindAll`, garantia de "nunca sem workspace" no `Delete` (repontar
   para outro; recriar "Padrão" ao deletar o último).
3. ✅ `WorkspaceService`: `GetPath/ResetToDefault` sob `XDG_CONFIG_HOME` isolado
   (o `Choose` abre diálogo nativo — não testado, conforme planejado).
4. ✅ `PredictionService`: `Suggest` cold start + match por histórico; TTL de 5s
   validado de forma determinística manipulando `lastBuild` (mesmo package), sem
   `sleep` — `predictTTL` é `const`, não regulável.
5. ✅ `SyncService`: repo git temporário via `os/exec` (helpers do pacote `git`
   são package-private, replicados localmente) para `Status/Commit/Push/Pull/`
   `ResolveConflict`; `github` não-autenticado via `XDG_CONFIG_HOME` isolado, sem
   rede. `Push/Pull` exercitados contra um bare remote local. Bônus: `sanitizeURL`
   (segurança — não vazar token na UI/logs).

**Pronto quando**: cada service acima com ao menos um teste de caminho feliz + um
de erro; `go test -race ./internal/services/...` verde. → **Atingido**: 11 novos
testes em `services_phase1_test.go`, todos verdes com `-race`; cobertura do pacote
`services` subiu para ~71,5%. Métodos ainda em 0% são só os que exigem rede real
(OAuth Device Flow do GitHub) ou diálogo nativo (`Choose`/`apply`), fora do escopo.

---

## Fase 2 — Histórico/branches/diff de git na UI (P1, ~4 P)

**Por quê**: `internal/git/service.go` já implementa `Log`, `ListBranches`,
`Checkout`, `CreateBranch`, `StashPush/Pop`, `CommitDiff`, `FileDiff`,
`AheadBehind`, `DiscardFile(s)` — nada disso chega ao frontend. Só `Status` é
agregado hoje pelo `SyncService`.

**Backend** (`internal/services/sync.go`): adicionar métodos-fachada que delegam
para `git.Service`, expondo DTOs já existentes (`CommitInfo`, `BranchInfo`,
`DiffResult`, `CommitDiffResult`, `AheadBehind`):

- `Log(limit) []CommitInfo`
- `ListBranches() []BranchInfo` · `Checkout(name)` · `CreateBranch(name)`
- `FileDiff(path) DiffResult` · `CommitDiff(sha) CommitDiffResult`
- `DiscardFile(path)` / `DiscardFiles([]path)`
- (opcional) `StashPush(msg)` / `StashPop()`

Rodar `task bindings`.

**Frontend**:
- `services/sync.service.ts` (ou novo `git.service.ts`): wrappers das novas
  bindings.
- `stores/sync.store.ts`: estado de `commits`, `branches`, `activeBranch`,
  `selectedDiff`.
- `features/git/view.tsx` (356 LOC hoje): adicionar abas/painéis — **Histórico**
  (lista de commits + diff do commit reusando o render de diff da resposta),
  **Branches** (listar/trocar/criar), e **discard por arquivo** no painel de
  status. Reaproveitar a UI de diff que já existe em `features/response`.

**Testes**: cobrir os novos métodos do `SyncService` (a Fase 1 abre caminho) e um
teste de store para troca de branch.

**Pronto quando**: usuário consegue ver histórico de commits com diff, listar e
trocar de branch e descartar mudanças por arquivo, sem sair do app.

---

## Fase 3 — Fluxo de PR / code review na UI (P1, ~6 P)

**Por quê**: **maior capacidade pronta e ociosa**. `internal/github/github.go`
implementa ~20 métodos de PR/review sem nenhum binding: `CreatePullRequest`,
`ListPullRequests`, `GetPullRequest`, `MergePullRequest`, `ListIssueComments`,
`CreateIssueComment`, `ListReviews`, `ListReviewComments`, `CreateReview`,
`CreateReviewComment`, `ReplyToReviewComment`, `ListPullRequestCommits`,
`ListPullRequestFiles`. DTOs já existem (`PullRequestSummary`, `PullRequestDetail`,
`IssueComment`, `PullRequestReview`, `ReviewComment`, `ReviewCommentInput`,
`PullRequestFile`, `PullRequestCommit`).

**Backend** (`internal/services/sync.go` — estender a fachada, respeitar
`sanitizeURL`/token oculto):

- Fase 3a (leitura): `ListPullRequests`, `GetPullRequest`,
  `ListPullRequestFiles`, `ListReviews`, `ListReviewComments`,
  `ListPullRequestCommits`, `ListIssueComments`.
- Fase 3b (escrita): `CreatePullRequest`, `CreateIssueComment`, `CreateReview`,
  `CreateReviewComment`, `ReplyToReviewComment`, `MergePullRequest`.

Rodar `task bindings`.

**Frontend**:
- `services/` + `stores/`: novo `pull-requests.store.ts` + hook `usePullRequests`.
- **Nova rota** `routes/panel/git/pull-requests/` (lista) e
  `.../pull-requests/$number/` (detalhe) — ou aba dentro de `features/git`.
- **Nova feature** `features/pull-requests/`:
  - lista de PRs (abertos/fechados) com status;
  - detalhe: descrição, commits, **arquivos com diff** (reusar render de diff),
    thread de review comments inline, criar review/comentar/responder;
  - ações: abrir PR novo, merge.
- Sidebar: adicionar item "Pull Requests" (sob Git).

**Segurança**: validar que URLs/tokens nunca vazam para a UI (já há `sanitizeURL`
no backend); comentários de usuário passam por texto, sem HTML cru.

**Pronto quando**: usuário autenticado consegue listar PRs, ver arquivos+diff e
comentários, criar review/comentar e fazer merge — tudo dentro do putch.

> Sugestão: entregar **3a (leitura) primeiro** como incremento utilizável, depois
> 3b (escrita). Depende da Fase 2 se quiser reaproveitar o render de diff.

---

## Fase 4 — Round-trip completo de import/export de coleção (P2, ~2 P)

**Por quê**: `CollectionsService.Import` reconstrói só metadados
(name/description/deprecated) e **descarta requests, folders e environments** do
arquivo exportado. Export→Import não fecha o ciclo.

**Backend** (`internal/services/collections.go`):
- Definir/travar um **schema de export** que inclua a coleção + folders (com
  hierarquia via ParentID) + requests (todos os campos, incl. body/auth/scripts).
  Decidir se environments entram no mesmo arquivo ou em export separado.
- `Export`: serializar a árvore completa (hoje já produz JSON — estender payload).
- `Import`: recriar folders (resolvendo ParentID → caminho) e requests,
  regenerando IDs para evitar colisão, mantendo a ordem.
- **Compatibilidade**: aceitar formato do Insomnia/Postman? (opcional — abrir como
  item separado se sim).

**Testes**: teste de round-trip em `services_test.go` — export de uma coleção com
pastas aninhadas + requests + auth, import num store limpo, asserção de igualdade
estrutural.

**Pronto quando**: exportar e reimportar uma coleção reproduz requests, pastas e
configs; teste de round-trip verde.

---

## Fase 5 — Tela de perfil (P3, ~1 P)

**Por quê**: `features/profile/view.tsx` (38 LOC) é um card estático sem lógica —
único componente sem função real.

**Opções** (decidir com o usuário):
- **(a) Remover** a rota/menu se não há conta a exibir (app é local) — mais
  simples, elimina superfície morta.
- **(b) Transformar em "Conta"**: mostrar dados reais do GitHub logado
  (`SyncService.GitHub()` já retorna `GitHubAccount`: avatar, login), status de
  sync do workspace e ações de logout — reaproveitando bindings existentes.

Recomendação: **(b)** se o fluxo de PR (Fase 3) entrar, pois passa a existir
"conta" com significado; senão **(a)**.

**Pronto quando**: a tela ou some do menu, ou exibe dados reais da conta GitHub.

---

## Fase 6 — Base de testes de frontend + gates de CI (P2, adiado, ~3 P)

**Por quê**: hoje há **zero** teste de frontend e nenhum runner. Regressões em
stores (optimistic update), services e no editor passam batido. Segue sendo a
maior dívida de qualidade — **adiada por priorização**, não descartada. Fazer
antes de o frontend crescer mais reduz o custo de retrofit.

**Passos**

1. **Instalar toolchain** (`frontend/`): `vitest`, `@testing-library/react`,
   `@testing-library/user-event`, `jsdom`, `@vitest/coverage-v8`. Adicionar
   `test` e `test:coverage` em `package.json`; config `vitest.config.ts`
   (environment jsdom, alias `@/` igual ao Vite).
2. **Mock das bindings Wails**: criar `src/test/wails-mock.ts` que stuba
   `@bindings/services` — os testes de store/service não devem chamar o backend
   real.
3. **Primeiros alvos** (maior risco primeiro):
   - `services/request.service.ts` (170 LOC) — montagem de `RequestConfig`,
     merge de params, mapeamento de auth/body.
   - Stores com optimistic update: `requests.store`, `collections.store`,
     `folders.store`, `sync.store` — inclusive rollback em erro.
   - `lib/curl.ts` (build de cURL) e `lib/http-methods.ts` — puros, alto ROI.
   - Se a Fase 3 entrou: `pull-requests.store`.
4. **CI** (`.github/workflows/ci.yml`, job `frontend`):
   - Adicionar passo `bun run test` **bloqueante**.
   - Remover `continue-on-error` de **lint e format** (oxlint/oxfmt) — torná-los
     bloqueantes.
5. **`task check`**: incluir `bun run test` no espelho local do CI.

**Pronto quando**: `bun run test` roda no CI como gate; lint/format bloqueiam;
cobertura inicial ≥ 40% nas camadas de dados (meta de subir a 80% incrementalmente,
conforme regra do projeto).

> **Antecipação barata (opcional, independe do resto)**: tornar **lint e format do
> frontend bloqueantes** no CI (remover `continue-on-error`) é ~15 min e não
> depende de instalar runner de teste. Pode ser feito a qualquer momento antes da
> Fase 6, se quiser um ganho de qualidade imediato sem o custo dos testes.

---

## Riscos e dependências transversais

- **Wails alpha pinado**: qualquer bump de `wails/v3` exige bump casado do
  `@wailsio/runtime` + `bun install` + restart (ver `CLAUDE.md`). Não bumpar no
  meio de uma fase.
- **`task bindings` após tocar assinatura de service**: esquecer disso quebra o
  IPC silenciosamente. Incluir no checklist de cada PR de backend.
- **Reuso de diff**: Fases 2, 3 e 4 se beneficiam do render de diff que já existe
  em `features/response` — extrair para um componente compartilhado em
  `components/functional/` na primeira delas evita duplicação.
- **CI sem macOS**: se alguma feature tocar comportamento específico de plataforma,
  considerar adicionar o job darwin (hoje ausente) antes de confiar no build.
