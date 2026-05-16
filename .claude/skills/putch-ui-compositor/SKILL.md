---
name: putch-ui-compositor
description: Use ao criar ou montar uma tela/feature/componente novo no frontend do putch (qualquer arquivo em src/features/** ou src/components/**). Garante uso do design system real — componentes de @/components/ui, tokens oklch tri-tema, layout Container/Column/Row, Button união discriminada, data-fetching via loader+store. NÃO use para apenas ler código.
---

# Compositor de UI — putch (shadcn moderno)

Objetivo: telas novas que já nascem consistentes com o design system, sem retrabalho de migração depois.

## 1. Sempre componha com o barrel `@/components/ui`

Importe de `@/components/ui` (barrel) — nunca recrie primitivos. Disponíveis (não-exaustivo):
`Button, Card, CardHeader, CardTitle, CardContent, Dialog, Tabs, Select, Input, Textarea, Checkbox, Switch, Tooltip, DropdownMenu, Popover, Collapsible, Badge, Separator, ScrollArea, Skeleton, Command, Resizable, Avatar, Accordion` e o layout/texto: `Container, Column, Row, Title, Label, Text`.

Esqueleto canônico de uma tela (espelha `src/features/settings/view.tsx`):

```tsx
import { Container, Column, Title, Label, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

export default function MinhaView() {
  return (
    <Container className="p-6">
      <Column>
        <Title>Título da tela</Title>
        <Label>Subtítulo / descrição curta.</Label>
        {/* conteúdo em Cards / Tabs */}
      </Column>
    </Container>
  );
}
```

## 2. Cores: SOMENTE tokens oklch (nunca Tailwind hardcoded)

`src/globals.css` define os tokens por tema: `:root`/`[data-theme="ultra-dark"]`, `[data-theme="ultra-white"]`, `[data-theme="off-white"]`. Cor hardcoded (`bg-zinc-900`, `text-slate-500`, `#fff`) **fura a troca de tema** — bug garantido nos 3 temas.

Use as classes que mapeiam tokens:
- Superfícies: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-sidebar`
- Texto: `text-foreground`, `text-muted-foreground`, `text-card-foreground`
- Ação/realce: `bg-primary text-primary-foreground`, `bg-secondary`, `bg-accent`
- Estado: `bg-destructive`, e os semânticos `--success/--warning/--info` (+ `-foreground`)
- Código/JSON: `--code-key/--code-string/--code-number/--code-boolean`
- Bordas/inputs: `border-border`, `border-input`, `ring-ring`

## 3. Radius (ATUALIZADO — não é mais flat)

`--radius: 0.5rem` com escala derivada `--radius-sm/md/lg/xl`. Use `rounded-md`/`rounded-lg` etc. (Notas antigas de "tudo radius 0 / flat" estão obsoletas — ignore.)

## 4. Button é união discriminada

`ButtonProps` (ver `src/components/ui/button.tsx`): ramo `button` (`type?: "button"|"submit"|"reset"`, `asChild?`) vs ramo `link` (`type: "link"` → usa `<Link>` do `@tanstack/react-router`). Para um wrapper que sempre renderiza `<button>` e tipa via `ButtonProps`, estreite com `Exclude<ButtonProps, { type: "link" }>` (senão `onClick` fica ambíguo button/anchor).

## 5. Dados: loader + store, sem useEffect

Padrão do projeto: TanStack Router `loader` carrega; estado em Zustand store; hooks são selectors. **Não** busque dado em `useEffect`. Rota nova file-based em `src/routes/...`; após criar o arquivo de rota, regenere o `routeTree.gen.ts` (o `task dev`/Vite regenera; sem dev rodando, use o `@tanstack/router-generator` programaticamente).

## 6. Idioma & gates

- Comentários e textos de UI em **pt-br** com acentuação correta.
- Antes de considerar pronto: `task typecheck` (hard gate, espelha o CI). Erros pré-existentes em editor/tests/request.service são da migração backend — verifique se o erro é nos *seus* arquivos.
- Não regenere `tsconfig.json` (ver CLAUDE.md: `allowJs/checkJs` obrigatórios, sem `baseUrl`).

## 7. Header / drag region (janela frameless)

UI interativa dentro da drag region precisa resetar `--wails-draggable: no-drag` (ver CLAUDE.md). A header é `src/components/functional/app-header.tsx`, montada no `SidebarProvider` em `src/routes/panel/-layout.tsx`.

Animações: delegue à skill `putch-motion`. Antes de "adicionar" algo, cheque se já existe (ex.: command-menu ⌘K é canônico).
