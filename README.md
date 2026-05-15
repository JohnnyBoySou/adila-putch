# putch - API Client

Um clone leve e rápido do Insomnia feito com **Go (Wails 3)**, **React**, **Vite** e **TailwindCSS**.

## 📋 Pré-requisitos

1. **Go 1.25+** — https://go.dev/dl/
2. **Bun** — https://bun.sh
3. **Wails 3 CLI** (alpha)
   ```bash
   go install github.com/wailsapp/wails/v3/cmd/wails3@latest
   ```
4. **Task** (taskfile.dev) — https://taskfile.dev/installation/

Em Linux, instale também as dependências de WebKit do sistema (consulte https://wails.io para a sua distro).

## 🚀 Como rodar

```bash
# Modo dev (hot reload Go + Vite)
wails3 dev

# ou via Task:
task dev

# Build de produção
task build
```

A aplicação:
1. ✅ Compila o backend Go com bindings tipados
2. ✅ Inicia o Vite (bun) na porta padrão
3. ✅ Abre a janela desktop

## 📁 Estrutura

```
putch/
├── main.go                   # Entry point Wails
├── internal/
│   ├── db/                   # SQLite (modernc.org/sqlite, puro Go)
│   └── services/             # Services Go expostos ao front
│       ├── collections.go
│       ├── requests.go
│       └── environments.go
├── frontend/
│   ├── src/                  # React 19 + TypeScript
│   ├── bindings/             # Gerado por wails3 generate bindings
│   ├── package.json
│   └── vite.config.ts
├── build/                    # Assets de empacotamento Wails
└── Taskfile.yml
```

## 🛠️ Tecnologias

- **Front-end**: React 19 + TypeScript + Vite + TailwindCSS
- **Back-end**: Go + Wails 3
- **Database**: SQLite (modernc.org/sqlite, puro Go, sem CGO)
- **HTTP Client**: net/http (stdlib)

## 💡 Dicas

- Bindings TS são geradas automaticamente a partir das structs/methods Go
- O DB SQLite fica em `$XDG_CONFIG_HOME/putch/putch.db` (ou equivalente por OS)
- Para regenerar bindings manualmente: `wails3 generate bindings -clean=true`
