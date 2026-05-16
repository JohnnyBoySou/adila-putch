#!/usr/bin/env bash
# Wrapper de DX para `task dev`.
#
# Sem flags: roda `wails3 dev` escondendo o ruído e mostrando uma barra de
# progresso que avança a cada etapa (go mod tidy → .desktop → build frontend
# → build Go → vite dev server → app conectado).
#
# Modo verbose (qualquer um abaixo): repassa TODA a saída original, sem barra,
# comportamento idêntico ao `wails3 dev` cru.
#   task dev -- --verbose
#   task dev VERBOSE=1
#   DEV_VERBOSE=1 task dev
#
# A barra é desenhada em /dev/tty (não no stdout), porque o Task entrega o
# stdout do processo via pipe — sem isso o `\r` da barra não funcionaria.

set -uo pipefail

VERBOSE=0
for a in "$@"; do
  case "$a" in
  -v | --verbose) VERBOSE=1 ;;
  esac
done
[ "${DEV_VERBOSE:-}" = "1" ] && VERBOSE=1
case "${VERBOSE_VAR:-}" in 1 | true | TRUE | yes) VERBOSE=1 ;; esac

PORT="${VITE_PORT:-9245}"
CMD=(wails3 dev -config ./build/config.yml -port "$PORT")

# Verbose: vira um passthrough puro. exec substitui o processo, então sinais
# (Ctrl-C) e exit code chegam intactos.
if [ "$VERBOSE" = "1" ]; then
  exec "${CMD[@]}"
fi

# ── etapas (ordem importa; cada linha casa o regex ERE e avança a barra) ──
STAGES=(
  'Refresh Starting|Changing Working Directory'
  'go:mod:tidy'
  'generate:dotdesktop|generate \.desktop'
  'build:frontend'
  'built in [0-9]'
  'build:native|\] go build'
  'Waiting for frontend dev server'
  'VITE v[0-9]|ready in [0-9]'
  'Connected to frontend dev server'
)
LABELS=(
  'Inicializando'
  'go mod tidy'
  'Gerando .desktop'
  'Compilando frontend (Vite)'
  'Frontend compilado'
  'Compilando binário Go'
  'Subindo Vite dev server'
  'Vite pronto'
  'App conectado'
)
TOTAL=${#STAGES[@]}
step=0
DONE=0
START=$SECONDS

# Saída da UI: /dev/tty se houver terminal controlador; senão stdout (modo
# "milestone", uma linha por etapa, sem barra animada — bom p/ CI/logs).
if { exec 3>/dev/tty; } 2>/dev/null; then
  OUT=3
  TTY=1
else
  OUT=1
  TTY=0
fi

LOG="$(mktemp -t putch-dev.XXXXXX.log)"

cleanup() {
  [ "$TTY" = 1 ] && printf '\033[?25h\n' >&$OUT 2>/dev/null
  rm -f "$LOG"
}
trap cleanup EXIT INT TERM

render() {
  [ "$TTY" = 1 ] || return 0
  local width=26 on i bar="" pct el
  on=$((step * width / TOTAL))
  for ((i = 0; i < width; i++)); do
    if [ "$i" -lt "$on" ]; then bar+="█"; else bar+="░"; fi
  done
  pct=$((step * 100 / TOTAL))
  el=$((SECONDS - START))
  printf '\r\033[K\033[36m▸\033[0m [\033[32m%s\033[0m] %3d%%  %s \033[90m(%ss)\033[0m' \
    "$bar" "$pct" "${LABELS[step]}" "$el" >&$OUT
}

reset_progress() { # rebuild após mudança de arquivo
  step=0
  DONE=0
  START=$SECONDS
  [ "$TTY" = 1 ] && printf '\n\033[90m↻ Alteração detectada — rebuild...\033[0m\n' >&$OUT
}

finish() {
  DONE=1
  if [ "$TTY" = 1 ]; then
    printf '\r\033[K\033[32m✓\033[0m putch rodando em \033[1mhttp://localhost:%s\033[0m  ' "$PORT" >&$OUT
    printf '\033[90m· %ss · `task dev -- --verbose` p/ logs completos\033[0m\n' "$((SECONDS - START))" >&$OUT
  else
    printf '✓ putch rodando em http://localhost:%s\n' "$PORT" >&$OUT
  fi
}

[ "$TTY" = 1 ] && printf '\033[?25l' >&$OUT
[ "$TTY" = 1 ] && printf '\033[1m▶ putch dev\033[0m \033[90mhttp://localhost:%s\033[0m\n' "$PORT" >&$OUT

"${CMD[@]}" 2>&1 | while IFS= read -r line; do
  printf '%s\n' "$line" >>"$LOG"

  # rebuild: volta a barra ao início
  if [ "$DONE" = 1 ] && printf '%s' "$line" | grep -Eq 'Refresh Starting|Changing Working Directory'; then
    reset_progress
  fi

  # avança até a maior etapa que casar (tolera etapas puladas / "up to date")
  i=$((step + 1))
  while [ "$i" -le "$TOTAL" ]; do
    if printf '%s' "$line" | grep -Eq "${STAGES[$((i - 1))]}"; then
      step=$i
    fi
    i=$((i + 1))
  done

  if [ "$step" -ge "$TOTAL" ] && [ "$DONE" = 0 ]; then
    finish
    continue
  fi

  # erros sempre aparecem, mesmo no modo limpo
  if printf '%s' "$line" | grep -Eqi 'panic:|fatal|error:|\bFAIL\b|cannot find|undefined:|no such file|exit status [1-9]'; then
    [ "$TTY" = 1 ] && printf '\r\033[K' >&$OUT
    printf '\033[31m%s\033[0m\n' "$line" >&$OUT
  fi

  if [ "$DONE" = 0 ]; then
    render
  fi
done

code=${PIPESTATUS[0]}

# Falha no build inicial: despeja o log pra não deixar o usuário no escuro.
if [ "$DONE" = 0 ] && [ "$code" -ne 0 ] && [ "$code" -ne 130 ]; then
  [ "$TTY" = 1 ] && printf '\r\033[K' >&$OUT
  printf '\033[31m✗ task dev falhou (exit %s). Saída completa:\033[0m\n' "$code" >&$OUT
  tail -n 60 "$LOG" >&$OUT
fi

exit "$code"
