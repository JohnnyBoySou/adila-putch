# putch — cliente HTTP desktop

Um cliente HTTP **local-first**, rápido e leve (estilo Insomnia/Postman), feito com
**Go + Wails 3**, **React 19**, **Vite** e **TailwindCSS**.

Os dados ficam em **arquivos YAML versionáveis por git** — não há banco de dados.
Um workspace é uma pasta que pode ser um repositório git, o que habilita
**colaboração via GitHub** (login por Device Flow, commit/push/pull, resolução de
conflitos) tratando suas coleções como código.

## ✨ Recursos

- **Fluxo HTTP completo**: métodos, query params, headers, body (raw / form
  url-encoded / multipart com upload de arquivos), auth (Bearer / Basic / API-Key),
  timeout e cancelamento por request.
- **Scripts pré/pós** estilo Postman em JavaScript (motor `goja`, sandbox sem
  acesso a fs/rede), com a superfície `pm.*`.
- **Resposta rica**: syntax highlight de JSON, visão pretty/tree/raw, busca,
  **diff linha-a-linha** contra a execução anterior, **geração de interface
  TypeScript** a partir do JSON e download do corpo.
- **Organização**: coleções, pastas aninhadas, árvore com drag-and-drop,
  favoritos e ordenação manual persistida.
- **Workspaces & Environments** com interpolação `{{variavel}}`; segredos
  separados em arquivos `.local.yml` (gitignored).
- **Testes**: suítes que encadeiam requests com asserções
  (`status`, `body_contains`, `header_exists`, `jsonpath`) e capturas.
- **Git/GitHub**: login por Device Flow, status, commit, push, pull, resolução de
  conflitos, conectar remote e clonar workspace.
- **Autocomplete preditivo** de URL/body/headers/params (100% local).
- **Temas** (ultra-dark / ultra-white / off-white) e escala de UI ajustável.
- **Import/Export** de coleção e command menu (⌘K).

## 📋 Pré-requisitos

1. **Go 1.25+** — https://go.dev/dl/
2. **Bun** — https://bun.sh
3. **Wails 3 CLI** (alpha)
   ```bash
   go install github.com/wailsapp/wails/v3/cmd/wails3@latest
   ```
4. **Task** (taskfile.dev) — https://taskfile.dev/installation/

Em Linux, instale as dependências de sistema GTK4 + WebKitGTK-6.0 (exigidas pelo
runtime Wails a partir do `alpha.95`). No Ubuntu 24.04:

```bash
sudo apt install libgtk-4-dev libwebkitgtk-6.0-dev
```

Para outras distros, consulte https://wails.io. O `build/dev.sh` já desabilita o
sandbox do WebKit no `task dev` (necessário no Ubuntu 24.04, que bloqueia user
namespaces não-privilegiados) — veja detalhes em [`CLAUDE.md`](./CLAUDE.md).

## 🚀 Como rodar

```bash
# Modo dev (hot reload Go + Vite), com barra de progresso da cadeia de build
task dev

# Logs completos (passthrough cru do wails3 dev)
task dev -- --verbose

# Build de produção
task build

# Empacotar para a plataforma atual (AppImage/deb/rpm, nsis/msix, .app…)
task package
```

## ✅ Gates de qualidade

```bash
task typecheck   # tsc -b — hard gate, espelha o CI
task check       # espelho completo do CI: gofmt + vet + go test -race + build + typecheck
task test        # go test -race ./...
```

`go test -race ./...` é gate **bloqueante** no CI. `task typecheck` é obrigatório
antes de considerar qualquer mudança de frontend pronta.

## 📁 Estrutura

```
putch/
├── main.go                   # Entry point Wails: registra os 9 serviços
├── internal/
│   ├── config/               # Config transversal (settings.json)
│   ├── store/                # Persistência YAML (CRUD, escrita atômica, mutex)
│   ├── services/             # Serviços Go expostos ao front (bindings Wails)
│   │   ├── collections.go    #   + folders, requests, environments, tests,
│   │   ├── requests.go       #     workspace(s), prediction, sync
│   │   └── ...               #   requests.go é o motor HTTP (Send/Cancel)
│   ├── git/                  # Motor git (go-git + binário git do sistema)
│   ├── github/               # API REST + OAuth Device Flow
│   └── predict/              # Autocomplete preditivo (frecency + n-gram)
├── frontend/
│   ├── src/                  # React 19 + TypeScript (routes/, features/, stores/…)
│   ├── bindings/             # Gerado por `wails3 generate bindings` (gitignored)
│   ├── package.json
│   └── vite.config.ts
├── build/                    # Empacotamento Linux/Windows/macOS/Docker
├── docs/
│   └── STATUS.md             # Estado do projeto: o que temos / o que falta
└── Taskfile.yml
```

## 🛠️ Tecnologias

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS 4; TanStack Router;
  Zustand; shadcn/ui; motion; CodeMirror; dnd-kit.
- **Backend**: Go 1.25 + Wails 3 (`v3.0.0-alpha.95`).
- **Persistência**: arquivos YAML no diretório do workspace (versionável por git).
- **HTTP**: `net/http` (stdlib). **Git**: `go-git` + binário `git`.
  **Scripts**: `goja` (JS puro em Go, sem cgo).

## 💡 Notas

- As bindings TS são geradas a partir das structs/métodos Go.
  Regenerar: `task bindings` (ou `wails3 generate bindings -clean=true`).
- A versão do `@wailsio/runtime` (frontend) **deve** bater exatamente com a de
  `github.com/wailsapp/wails/v3` (go.mod) — ambas em `alpha.95`, pinadas sem `^`.
- Detalhes de arquitetura (janela frameless, drag region, resize no Linux) estão
  em [`CLAUDE.md`](./CLAUDE.md). Estado atual e roadmap em
  [`docs/STATUS.md`](./docs/STATUS.md).
