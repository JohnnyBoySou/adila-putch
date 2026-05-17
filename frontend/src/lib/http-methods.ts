// Cor única de método HTTP, compartilhada entre a listagem de requests
// (badge) e o seletor ao lado da URL no editor. Tokens semânticos do
// design system → acompanham os 3 temas (claro/escuro/sépia).
//
// IMPORTANTE: as classes são literais completas (não `text-${x}`) — o
// scanner do Tailwind só inclui o que aparece por extenso no código.
// `text` e `badge` da mesma linha usam a MESMA matiz, então os dois
// lugares ficam sempre consistentes. Não duplicar este mapa.
const METHOD_STYLES: Record<string, { text: string; badge: string }> = {
  GET: { text: "text-success", badge: "bg-green-500 text-white" },
  POST: { text: "text-info", badge: "bg-blue-500 text-back" },
  PUT: { text: "text-warning", badge: "bg-warning text-black" },
  PATCH: { text: "text-amber-300", badge: "bg-amber-300 text-black" },
  DELETE: { text: "text-red-500", badge: "bg-red-500 text-white" },
};

// Fallback (HEAD, OPTIONS e métodos desconhecidos) = muted.
const FALLBACK = {
  text: "text-muted-foreground",
  badge: "bg-muted text-muted-foreground",
} as const;

// Só a cor do texto — usado no SelectTrigger/itens do editor.
export function methodTextClass(method: string): string {
  return (METHOD_STYLES[method.toUpperCase()] ?? FALLBACK).text;
}

// Fundo suave + texto — usado no Badge da listagem de requests.
export function methodBadgeClass(method: string): string {
  return (METHOD_STYLES[method.toUpperCase()] ?? FALLBACK).badge;
}
