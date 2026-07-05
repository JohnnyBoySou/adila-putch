# putch — guia para o agente

## Janela frameless + drag region (Wails v3)

A janela é **frameless** (`Frameless: true` em `main.go`, dentro de
`application.WebviewWindowOptions`). Não existe titlebar nativa nem botões de
fechar/minimizar/maximizar — eles são reimplementados no frontend.

- A `<header>` em `src/components/functional/app-header.tsx` é a **drag
  region** da janela. Ela é montada dentro do `SidebarProvider` em
  `src/routes/panel/-layout.tsx` (não no `__root.tsx`) — assim a faixa
  esquerda do header acompanha a largura do sidebar via `useSidebar()`.
  O `__root.tsx` só renderiza `WindowResizeGrips` + `Outlet`.
- Controles custom: `src/components/functional/window-controls.tsx`
  (`import { Window } from "@wailsio/runtime"` → `Window.Minimise()`,
  `Window.ToggleMaximise()` / `Window.IsMaximised()`, `Window.Close()`).

### Resize no Linux: o runtime NÃO faz, grips manuais obrigatórios

`@wailsio/runtime/dist/drag.js` só detecta as bordas de resize de janela
frameless **no Windows** (`if (!resizable || !IsWindows()) return;`). No
Linux/macOS o runtime nunca emite `wails:resize:<edge>`, então uma janela
frameless fica **sem resize** — apesar de o backend Linux implementar
`startResize` (`gtk_window_begin_resize_drag`).

Solução no projeto: grips próprios em `src/components/functional/window-resize-grips.tsx`
(montado no topo do `__root.tsx`) que, no `pointerdown`, disparam
`wails:resize:<edge>` via `src/lib/wails-window.ts`. Esse helper replica o
canal interno do runtime (`window.webkit.messageHandlers.external.postMessage`
no Linux/macOS, `window.chrome.webview.postMessage` no Windows) — não há API
pública para isso. Edges válidas: `n/ne/e/se/s/sw/w/nw` + `-resize`.

### Versão do runtime DEVE bater com o Go

`@wailsio/runtime` (frontend) e `github.com/wailsapp/wails/v3` (go.mod) são
alpha sincronizados — **pinar exato**, sem `^`. Hoje ambos em `alpha.95`. Caret
em prerelease puxa alpha mais novo e descasa o IPC. Ao bumpar um, bumpar o
outro e rodar `bun install` + restart do `task dev`.

**Três lugares, não dois**: além de `go.mod` e `package.json`, o **CLI `wails3`**
(instalado global via `go install .../cmd/wails3@vX`) também precisa bater — é ele
que gera as bindings e roda `wails3 dev`. Ao bumpar, rode
`go install github.com/wailsapp/wails/v3/cmd/wails3@<versão>` e confira com
`wails3 version`. As bindings geradas por um CLI de versão errada podem descasar
do módulo.

### Deps de sistema (Linux): GTK4 + WebKitGTK-6.0 desde o alpha.95

A partir do `alpha.95` o runtime Linux migrou de **GTK3/WebKit2GTK-4.1** para
**GTK4 + WebKitGTK-6.0**. Sem as libs de dev o `go build` falha no pkg-config
(`Package 'gtk4' not found`). No Ubuntu 24.04:

```
sudo apt install libgtk-4-dev libwebkitgtk-6.0-dev
```

(`libsoup-3.0` e `gio-unix-2.0` já vêm com o webkit2gtk-4.1 anterior.)

### Sandbox do WebKit no dev — `WEBKIT_DISABLE_SANDBOX`

O WebKitGTK-6.0 isola os processos web num sandbox via `bwrap` (bubblewrap), que
exige **user namespaces não-privilegiados**. O Ubuntu 24.04 os bloqueia por padrão
(`kernel.apparmor_restrict_unprivileged_userns=1`) e o `bwrap` não é setuid — então
o app **aborta na inicialização**:

```
bwrap: setting up uid map: Permission denied
ERROR: Failed to fully launch dbus-proxy ... → SIGTRAP em cgo execution
```

Solução no projeto: `build/dev.sh` exporta
`WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` (herda por wails3 → binário → WebKit).
Escopo **apenas do `task dev`** — o build/pacote de produção não passa por
`dev.sh`. Desabilitar o sandbox destrava o dev local sem sudo e sem afrouxar
segurança do sistema. Alternativa (mantém o sandbox, precisa sudo):
`sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`.

### Regra crítica: `--wails-draggable` herda

`--wails-draggable` é uma CSS custom property — **herda para os filhos**. O
runtime do Wails (`@wailsio/runtime/dist/drag.js`) lê
`getComputedStyle(target).getPropertyValue("--wails-draggable")` no elemento
exato clicado.

Consequência: definir `--wails-draggable: drag` na header faz **toda zona
interativa dentro dela** (menus, botões, inputs) também virar área de arrasto —
cliques viram drag e não disparam.

**Sempre** que adicionar algo interativo dentro da header (ou de qualquer drag
region), envolva numa zona com `--wails-draggable: no-drag` reset explícito:

```tsx
// drag region
<header style={{ ["--wails-draggable" as string]: "drag" }}>
  {/* zona interativa: precisa resetar */}
  <Menubar style={{ ["--wails-draggable" as string]: "no-drag" }} />
  <WindowControls /> {/* já faz no-drag internamente */}
</header>
```

Qualquer valor diferente de exatamente `"drag"` (ex.: `"no-drag"`) desliga o
arrasto naquele elemento.

## tsconfig.json é mantido à mão — não regenerar

`frontend/tsconfig.json` **não** deve ser regenerado por ferramenta. Regenerações
anteriores reintroduziram duas quebras de CI:

1. `"baseUrl": "."` → erro TS5101 (deprecado no TS 7.0). Os `paths` já usam
   `./`; **não** adicionar `baseUrl`.
2. Remoção de `"allowJs": true` / `"checkJs": false` → as bindings do Wails são
   `.js` com JSDoc (sem `.d.ts`); sem essas flags o `tsc -b` cai em cascata de
   TS7016/TS7006. Ambas são obrigatórias.

## Button: união discriminada

`src/components/ui/button.tsx` exporta `ButtonProps` como **união
discriminada**: ramo `button` (`type?: "button" | "submit" | "reset"`,
`asChild?`) e ramo `link` (`type: "link"`, usa `<Link>` do
`@tanstack/react-router`). Componentes que sempre renderizam um `<button>` real
e tipam props via `ButtonProps` devem estreitar com
`Exclude<ButtonProps, { type: "link" }>`, senão `onClick` fica ambíguo entre
`HTMLButtonElement` e `HTMLAnchorElement` (ver `SidebarTrigger`).

## `task dev` — wrapper de DX (sem logs)

`task dev` **não** chama `wails3 dev` direto: passa por `build/dev.sh`, que
esconde o ruído da cadeia de build e mostra uma **barra de progresso** de 9
etapas (`go mod tidy → .desktop → frontend Vite → build Go → vite dev server →
app conectado`). Erros (`panic`/`error:`/`FAIL`/...) e falha de build (dump das
últimas 60 linhas) **sempre** aparecem — a ausência de logs é intencional, não
um bug.

A barra é desenhada em `/dev/tty` (o stdout vem via pipe do Task; `\r` não
funcionaria nele). Sem TTY → fallback de uma linha por etapa.

Para os logs completos (passthrough cru via `exec wails3 dev`, sinais/exit
code intactos):

```
task dev -- --verbose      # CLI_ARGS
task dev VERBOSE=1          # variável do Task
DEV_VERBOSE=1 task dev      # env
```

`task dev --verbose` (sem `--`) **não** funciona: `--verbose` é flag global do
próprio Task, não chega ao script. Ao editar as etapas/markers, ajustar os
arrays `STAGES`/`LABELS` em `build/dev.sh` (regex ERE casado linha a linha).

## Gates locais

- `task typecheck` (`tsc -b`) — **hard gate**, espelha o CI. Sempre rodar antes
  de considerar uma mudança de frontend pronta.
- `task check` — espelho completo do CI (gofmt/vet/`go test -race`/build Go +
  typecheck bloqueantes; lint/format informativos via `ignore_error`).
- `go test -race ./...` é **gate bloqueante** no CI (job `backend`) e em
  `task check`/`task test`. `internal/store` (incl. escrita YAML atômica e o
  `Store.mu`) e `internal/services` têm cobertura; manter verde ao mexer no
  store/services.

## Idioma

Comentários de código e comunicação são em **pt-br** com acentuação correta.
