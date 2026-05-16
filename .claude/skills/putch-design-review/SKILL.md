---
name: putch-design-review
description: Use para revisar/auditar consistência visual de telas existentes do frontend do putch — quando o usuário pedir "revisar o design/UI", reclamar de tela "fora do padrão", ou após mexer em vários arquivos de src/features/**. Verifica tokens vs cores hardcoded, componentes canônicos, tri-tema, acessibilidade e reduce-motion.
---

# Revisão de design — putch

Auditoria de consistência. Rode os checks abaixo nos arquivos em escopo e reporte achados como lista acionável (arquivo:linha → problema → correção).

## Checklist

### 1. Cores hardcoded (bug de tema — prioridade alta)
Procure por classes Tailwind de paleta fixa e hex/rgb literais:

```
grep -rnE "(bg|text|border|ring|fill|stroke)-(zinc|slate|gray|neutral|stone|red|green|blue|amber|emerald|sky|violet)-[0-9]" src/features src/components/functional
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(" src/features src/components/functional
```
Toda ocorrência → trocar por token (`bg-background/card/muted`, `text-foreground/muted-foreground`, `bg-primary`, `border-border`, semânticos `success/warning/info`, code-* para JSON). Validar nos 3 temas: `ultra-dark`, `ultra-white`, `off-white`.

### 2. Primitivos recriados em vez do barrel
Sinais: `<button class=...>` cru, `<input>`/`<select>` nativos estilizados à mão, Card/Dialog reimplementados. Devem vir de `@/components/ui`. Estruturas de página devem usar `Container/Column/Row/Title/Label` (não `<div>` solto com paddings mágicos).

### 3. Button mal tipado
Wrapper que sempre renderiza `<button>` tipando via `ButtonProps` sem `Exclude<ButtonProps,{type:"link"}>` → `onClick` ambíguo. Link de navegação deve usar `type="link"` + `to=`, não `<a href>` nem `onClick`+navigate.

### 4. Radius
Estado atual: `--radius: 0.5rem` (cantos arredondados). Sinalize `rounded-none`/`border-radius:0` forçado e qualquer comentário/instrução afirmando "design flat / radius 0" como **obsoleto**.

### 5. Acessibilidade mínima
Botão só-ícone sem `aria-label`/`title`/`tooltip`; `cursor` já é tratado em `globals.css` (não duplicar); foco visível não removido; contraste do texto sobre superfície (muted-foreground em muted é o limite — não inventar tons).

### 6. Reduce-motion
Animações `motion`/framer devem respeitar `reduceMotion` do `usePreferences()` (`@/contexts/preferences.context`) — `transition={reduceMotion ? {duration:0} : ...}`. CSS já é coberto por `[data-reduce-motion="true"]` em globals.css; JS (motion) **não** é automático. Detalhes: skill `putch-motion`.

### 7. Drag region (frameless)
Em `app-header.tsx` / qualquer drag region: elemento interativo sem `--wails-draggable: no-drag` vira área de arrasto e não clica (ver CLAUDE.md).

### 8. i18n/idioma
Texto de UI e comentários em pt-br com acentuação correta.

## Saída
Não corrija silenciosamente em massa. Liste os achados priorizados (tema > componente > a11y > polish) e proponha o patch; aplique após confirmação salvo correção trivial e local. Feche com `task typecheck` (ignore os erros pré-existentes da migração backend em editor/tests/request.service).
