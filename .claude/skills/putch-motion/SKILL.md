---
name: putch-motion
description: Use ao adicionar ou ajustar microinterações/animações no frontend do putch (transições, indicadores que deslizam, enter/exit, hover/press). Garante uso correto da lib `motion`, o padrão layoutId/FLIP e o respeito obrigatório ao reduceMotion do PreferencesContext.
---

# Microinterações com motion — putch

Lib: `motion` (v12) — importe de `motion/react` (`import { motion } from "motion/react"`). Não use `framer-motion` como nome de pacote; é `motion`.

## Regra inegociável: respeitar reduceMotion

O projeto tem dois sistemas de redução de movimento:
- **CSS**: `[data-reduce-motion="true"]` em `globals.css` zera `animation/transition` — cobre CSS/Tailwind automaticamente.
- **JS (motion)**: NÃO é coberto pelo CSS. Toda animação `motion` deve ler `reduceMotion` de `usePreferences()` (`@/contexts/preferences.context`) e degradar:

```tsx
const { reduceMotion } = usePreferences();
// ...
transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
```

Animação puramente CSS/Tailwind (sem motion) já é coberta — não precisa do hook.

## Padrão "indicador que segue o ativo" (layoutId / FLIP)

Referência canônica: `ActiveRail` em `src/components/functional/sidebar.tsx`. Um único `motion.span` com `layoutId` compartilhado, renderizado **apenas dentro do item ativo** — o motion move o MESMO elemento entre posições (FLIP), inclusive entre níveis (item de topo ↔ subitem):

```tsx
function ActiveRail({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.span
      layoutId="sidebar-active-rail"
      className="pointer-events-none absolute left-0.5 top-2 bottom-2 z-10 w-[2px] rounded-lg bg-foreground"
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
    />
  );
}
// uso: {active && <ActiveRail reduceMotion={reduceMotion} />} dentro do item (container relative)
```
Não duplique esse padrão com `useState`/medição manual de DOM — `layoutId` resolve.

## Diretrizes

- **Cor**: anime com tokens (`bg-foreground`, `bg-primary`, `bg-primary-foreground` quando sobre superfície primary). Nunca cor hardcoded.
- **Spring > tween** para movimento espacial (deslize, reorder); `stiffness` ~320–460, `damping` ~28–36. Tween curto (120–200ms) para opacidade/cor.
- **Enter/exit de listas**: `AnimatePresence`; mantenha `key` estável; saída idêntica e curta.
- **Hover/press**: prefira CSS/Tailwind (`transition-colors`, `active:`) — mais barato e já coberto por reduce-motion. Use motion só quando precisa de layout/spring.
- **Não anime layout caro** (width/height de containers grandes) sem `layout` prop e necessidade real; evite jank no app desktop (Wails/WebView).
- **Drag region**: animar dentro do header não muda a regra `--wails-draggable: no-drag` para elementos interativos (CLAUDE.md).

## Gate
`task typecheck` ao final. Verifique que o erro (se houver) é do seu arquivo, não dos pré-existentes da migração backend (editor/tests/request.service).
