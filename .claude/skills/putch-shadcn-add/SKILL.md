---
name: putch-shadcn-add
description: Use quando precisar trazer um componente novo do shadcn/ui para o frontend do putch (o barrel @/components/ui não tem o primitivo necessário). Cobre o comando correto com bun, a adequação ao tema/tokens/idioma e o registro no barrel.
---

# Adicionar componente shadcn — putch

O frontend já tem shadcn configurado (`frontend/components.json`, alias `ui: @/components/ui`, base color/oklch). Só adicione um componente novo se o barrel realmente não cobrir — primeiro confira `src/components/ui/index.ts`.

## Passos

1. **Cheque duplicidade**: `grep <Componente> src/components/ui/index.ts`. Existe? Use o existente. Variante de algo que já existe? Estenda, não duplique.

2. **Adicione via CLI (bun — o projeto usa bun.lock)**, a partir de `frontend/`:
   ```
   bunx shadcn@latest add <componente>
   ```
   Aceita instalar deps Radix necessárias. Não deixe o CLI sobrescrever componentes já customizados (revise o diff).

3. **Adeque ao design system** (o template do shadcn vem genérico):
   - Cores → tokens do projeto: `bg-background/card/popover/muted`, `text-foreground/muted-foreground`, `bg-primary`, `border-border`, `ring-ring`. Remova qualquer cor de paleta fixa.
   - Radius: usa `--radius` (0.5rem) e escala `--radius-sm/md/lg/xl` — mantenha as classes `rounded-*` do template (NÃO force `rounded-none`; "flat/radius 0" é nota obsoleta).
   - Padrão de API moderno do projeto: `data-slot`, `cva` para variantes, `asChild` via `radix-ui` Slot — siga o estilo dos vizinhos (ex.: `button.tsx`, `sidebar.tsx`).
   - Comentários/textos em **pt-br** com acentuação.

4. **Registre no barrel**: adicione `export * from "./<componente>"` em `src/components/ui/index.ts` (ordem alfabética como o arquivo já segue).

5. **Se o componente tem estado de animação** (accordion/collapsible/dialog/sheet): garanta compatibilidade com reduce-motion — ver skill `putch-motion`.

6. **tsconfig**: não regenere (`allowJs/checkJs` obrigatórios, sem `baseUrl` — CLAUDE.md).

7. **Gate**: `task typecheck`. Os erros pré-existentes em editor/tests/request.service são da migração backend — confirme que o novo componente não introduz erro próprio.

## Nota
Mantenha o componente "burro" (apresentação). Lógica de dados continua no padrão loader+store; o componente só recebe props/children.
