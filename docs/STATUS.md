# putch — Estado do projeto (o que temos / o que falta)

> Documento de status gerado a partir de uma varredura completa do código em
> **2026-07-04**. Descreve o que está implementado, o que está pronto no backend
> mas não exposto na UI, e as lacunas de qualidade/documentação.
>
> Escopo medido: ~7.700 LOC Go (`internal/`) + ~15.400 LOC TS/TSX (`frontend/src/`).

---

## 1. Visão geral

**putch** é um cliente HTTP desktop (estilo Insomnia/Postman), **local-first**, feito
com **Wails v3** (Go + WebView) no backend e **React 19 + TanStack Router + Vite**
no frontend. A persistência é em **arquivos YAML versionáveis por git** — não há
banco de dados. A colaboração é feita via **GitHub** (login por Device Flow +
API REST), tratando o workspace como um repositório git.

### Stack real

| Camada | Tecnologia |
|---|---|
| Desktop shell | Wails v3 `v3.0.0-alpha.78` (frameless, controles de janela custom) |
| Backend | Go 1.25 — `net/http` (motor HTTP), `go-git` + binário `git`, `goja` (scripts JS), `yaml.v3` |
| Persistência | Arquivos YAML no diretório do workspace (sem DB) |
| Frontend | React 19.2, TanStack Router 1.170, Vite 8, TypeScript 6, Tailwind 4 |
| Estado | Zustand 5 (stores) + Context (tema/preferências) |
| UI | shadcn/ui (33 primitivos), motion 12, CodeMirror, dnd-kit, cmdk |

> ⚠️ **O `README.md` está desatualizado**: descreve persistência em **SQLite**
> (`internal/db/`, `modernc.org/sqlite`). Esse pacote **não existe** — a migração
> para store YAML já foi concluída. Ver §6.

### Arquitetura em camadas

```
main.go  →  registra 9 serviços Wails
   │
   ├── internal/services/   bindings Wails + DTOs JSON (fachada para o front)
   │        │
   │        ├── store/      persistência YAML (CRUD, escrita atômica, mutex)
   │        ├── git/        motor git (go-git + git do sistema)
   │        ├── github/     API REST + OAuth Device Flow
   │        └── predict/    autocomplete preditivo (frecency + n-gram)
   │
   └── config/              config transversal (settings.json da suíte Adila)
```

---

## 2. O que temos — funcional ponta a ponta

### 2.1 Fluxo HTTP core (o coração) — ✅ completo

Montar request → enviar → ver resposta funciona de ponta a ponta, com envio
**real** via binding Wails (`RequestsService.Send`).

- **Métodos e composição**: URL + método, query params, headers, body em 3 modos
  (**raw**, **form url-encoded**, **multipart** com upload de arquivos do disco),
  auth (**Bearer**, **Basic**, **API-Key**), timeout por request.
- **Envio** (`internal/services/requests.go`): motor `sendHTTP` com cookie jar em
  memória, timeout por request, **cancelamento** em voo (`Cancel`), merge de
  params, `applyAuth`, `buildBody` (lê arquivos multipart do disco).
- **Scripts pré/pós** estilo Postman via `goja` (JS puro, sandbox sem fs/rede),
  superfície `pm.*` (variables/environment/request/response/test/expect) com
  watchdog de 5s.
- **Editor** (`features/editor/view.tsx`, 564 LOC): auto-save com debounce,
  atalho **Ctrl/Cmd+Enter**, **preview de URL** com variáveis de environment
  resolvidas (destaca variáveis não resolvidas), **copiar como cURL**, salvar
  como template, autocomplete preditivo de URL.
- **Resposta** (`features/response/view.tsx`, 903 LOC): status colorido por faixa,
  tamanho, timing; abas Payload/Headers/Timing; **syntax highlight de JSON**
  (escapado com segurança), pretty/tree/raw, busca na resposta, **diff
  linha-a-linha (LCS)** contra a execução anterior, **geração de interface
  TypeScript** a partir do JSON, download do corpo.

### 2.2 Organização de requests — ✅ completo

- **Coleções**: CRUD, cor de card, pinned/deprecated, listar/criar/editar.
- **Pastas aninhadas**: hierarquia = caminho físico no disco (aninhamento
  recursivo), `ParentID` derivado no scan. CRUD + mover (recusa ciclos).
- **Árvore Postman-like** (`features/requests/list.tsx`, 1089 LOC): drag-and-drop,
  favoritos, duplicar, mover, rename inline, filtro, ordenação manual persistida
  (`.putch-order.yml`).

### 2.3 Workspaces & Environments — ✅ completo

- **Workspaces**: CRUD (nome, descrição, emoji/ícone, cor, pinned); um ativo por
  vez; escolha da pasta root via diálogo nativo. Nunca fica sem workspace.
- **Environments**: CRUD + editor de variáveis; interpolação `{{chave}}`;
  **segredos separados** em `<env>.local.yml` (gitignored) por heurística de nome
  (token/secret/password/apikey…) + lista explícita.

### 2.4 Testes — ✅ completo

- Suítes que encadeiam requests (`features/tests`, `internal/services/tests.go`):
  passos, **asserções** (`status`, `body_contains`, `header_exists`, `jsonpath`),
  **capturas** encadeadas entre passos (`json`/`header`/`status`), runner
  sequencial com interpolação de variáveis capturadas.

### 2.5 Colaboração git/GitHub — ✅ na UI (parcial no que é exposto)

- **Login GitHub** por Device Flow (sem PAT manual), listar repos.
- **Sync**: status do workspace, commit, push, pull, **resolução de conflito**
  (estado estruturado, não erro), conectar remote, clonar workspace.
- Motor git híbrido: `go-git` para leitura/status/diff/commit; binário `git` do
  sistema para push/pull/fetch/stash/merge/clone.

### 2.6 Extras — ✅

- **Histórico** de execuções (localStorage), detalhes expansíveis, limpar.
- **Import/Export** de coleção (JSON) — *ver ressalva em §3*.
- **Autocomplete preditivo** (`internal/predict`): ghost-text de URL/body/header/
  param, 100% local, ranking por frecency (meia-vida 30d) + n-gram de path.
  Invariante de segurança: só **chaves** entram no índice, nunca valores.
- **Temas** (ultra-dark / ultra-white / off-white) + escala de UI.
- **Welcome** e **command menu** (⌘K).

### 2.7 Infra de build — ✅ multiplataforma

- Empacotamento para **Linux** (AppImage, deb/rpm via nfpm, `.desktop`),
  **Windows** (nsis, msix, ícone/manifest), **macOS** (Info.plist, icns),
  **Docker** (cross-compile + modo servidor headless).
- `Taskfile.yml` com DX caprichada: `dev` com barra de progresso, `check`
  (espelho do CI), `typecheck` (hard gate), `bindings`, gates Go.

---

## 3. O que falta — capacidade pronta no backend, sem UI

Estas não são features quebradas: o motor existe e está testável, mas **não há
binding/tela** que as exponha ao usuário.

| # | Lacuna | Detalhe | Onde |
|---|---|---|---|
| 1 | **Fluxo de PR / code review** | O pacote `github` implementa ~20 métodos de PR (criar, listar, merge, reviews, comentários inline, arquivos, commits) — **nenhum** exposto pelo `SyncService`. Toda a capacidade de review está pronta e sem UI. | `internal/github/github.go` |
| 2 | **Histórico/branches/diff de git na UI** | `git.Service` tem `Log`, `ListBranches`, `Checkout`, `CreateBranch`, `StashPush/Pop`, `CommitDiff`, `FileDiff`, `AheadBehind`, `DiscardFile(s)` — nenhum chega ao frontend. Só `Status` é agregado. | `internal/git/` |
| 3 | **Import de coleção raso** | `CollectionsService.Import` reconstrói só metadados (name/description/deprecated). **Descarta requests, folders e environments** do arquivo exportado — não há round-trip completo export→import. | `internal/services/collections.go` |
| 4 | **Tela de perfil** | `features/profile/view.tsx` (38 LOC) é um card informativo estático (“conta local”), sem funcionalidade. Único componente sem lógica real. | `frontend/src/features/profile` |

---

## 4. Dívidas de qualidade

### 4.1 Testes de frontend: **ZERO** — maior lacuna de qualidade

- Nenhum `*.test.*` / `*.spec.*` em `frontend/src`.
- Sem runner instalado (nenhum Vitest/Jest/Testing Library no `package.json`),
  sem script `test`.
- As peças mais complexas ficam sem cobertura: `request.service.ts` (170 LOC),
  `sync.store.ts` (189 LOC), o editor (564 LOC) e a resposta (903 LOC).

### 4.2 CI não bloqueia regressões de frontend

- Job `frontend` só roda `tsc -b` como gate bloqueante. **Lint e format são
  `continue-on-error`** — não barram merge.
- Nenhuma execução de código/teste no frontend.
- **Sem build de macOS no CI** (config darwin existe, mas não é validada).
- Sem gate de segurança/deps (`bun audit`, `govulncheck`, Dependabot, CodeQL).
- Sem medição de cobertura em nenhuma camada.

### 4.3 Cobertura de testes do backend (existe, com buracos)

| Pacote | Testes | Observação |
|---|---|---|
| `predict` | ~28 | Melhor coberto. |
| `services` | 13 | Cobre Collections/Environments/Requests/Tests + 1 de concorrência. **Sem** teste de Folders, Workspaces, Workspace, Prediction, Sync. |
| `store` | 3 | Inclui concorrência (no lost-update). |
| `git` | 4 | |
| `github` | 3 | |
| `config` | 1 | |

Gate positivo: `go test -race ./...` é **bloqueante** no CI e em `task check`.

### 4.4 Inconsistências menores de organização

- `frontend/src/services/enviroments.service.ts` — **typo** no nome do arquivo
  ("enviroments").
- `workspace.service.ts` **e** `workspaces.service.ts` coexistem — confirmar se
  não há duplicação (o backend tem os dois serviços: singular = escolher pasta
  root; plural = gerenciar workspaces dentro do root).

### 4.5 Decisões que podem virar lacuna funcional

- **`updated_at` de Request não é rastreado** — o DTO espelha `created_at`.
  Decisão consciente (git é a fonte de verdade), mas quebra ordenação por
  modificação se a UI precisar.
- `UpdateRequest` no store faz **replace total**, preservando só
  `IsActive`/`IsFavorite`/`CreatedAt`/`CollectionID`.
- `StartGitHubLogin` dispara goroutine e **descarta o erro** do
  `PollDeviceToken` — a UI detecta falha pela ausência do evento, sem feedback
  explícito.

---

## 5. Prioridades sugeridas

Plano detalhado em [`ROADMAP.md`](./ROADMAP.md). Ordem acordada:

1. ✅ **Corrigir o README** (§6) — feito; estava factualmente errado sobre a
   persistência.
2. **Higiene** — typo `enviroments.service.ts`, duplicação de service, `updated_at`.
3. **Fechar buracos de teste de service no backend** (Folders/Workspaces/Sync) —
   dá rede de segurança para as entregas de git/PR.
4. **Expor histórico/branches/diff de git na UI** (§3.2).
5. **Expor o fluxo de PR/review** (§3.1) — a maior capacidade pronta e ociosa.
6. **Round-trip completo de import/export** de coleção (§3.3).
7. **Base de testes de frontend + gates de CI** — **adiado por priorização**.
   Segue sendo a maior dívida de qualidade; tornar lint/format bloqueantes é uma
   antecipação barata e independente.

---

## 6. Discrepâncias de documentação a corrigir

O `README.md` atual afirma coisas que **não** correspondem ao código:

| README diz | Realidade |
|---|---|
| “Database: SQLite (`modernc.org/sqlite`)” | Não há DB. Persistência é YAML em `internal/store/`. `internal/db/` **não existe**. |
| Estrutura mostra `internal/db/` | Diretórios reais: `config`, `git`, `github`, `predict`, `services`, `store`. |
| Lista só 3 services (collections/requests/environments) | São **9** serviços registrados (+ folders, tests, workspace, workspaces, prediction, sync). |
| “DB fica em `$XDG_CONFIG_HOME/putch/putch.db`” | Dados ficam no diretório do workspace escolhido pelo usuário (YAML versionável por git). |

---

*Fim do documento. Nenhum `TODO`/`FIXME`/`panic`/stub foi encontrado no código —
as lacunas acima são de superfície exposta e de qualidade automatizada, não de
implementação quebrada.*
