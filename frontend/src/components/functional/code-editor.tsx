import { useMemo } from "react";
import CodeMirror, { EditorView, type Extension } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { autocompletion, type Completion } from "@codemirror/autocomplete";
import { tags as t } from "@lezer/highlight";
import { cn } from "@/lib/utils";

/**
 * Realce de sintaxe atrelado às CSS vars OKLCH do app (3 temas). A paleta do
 * design system é monocromática, então diferenciamos por peso/opacidade em vez
 * de matiz — chaves em destaque, valores e pontuação mais sóbrios. Como usa
 * `var(--…)`, acompanha automaticamente claro/escuro/sépia.
 */
const themedHighlight = HighlightStyle.define([
  { tag: [t.propertyName, t.definition(t.propertyName)], color: "var(--foreground)", fontWeight: "600" },
  { tag: t.string, color: "var(--muted-foreground)" },
  { tag: [t.number, t.bool, t.null, t.keyword], color: "var(--foreground)" },
  { tag: [t.punctuation, t.brace, t.bracket, t.separator], color: "var(--muted-foreground)" },
]);

interface CodeEditorProps {
  value: string;
  onChange: (v: string) => void;
  /** "json" aplica a extensão de linguagem JSON; "text" (default) é texto puro. */
  language?: "json" | "text";
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  /** Altura mínima do editor (ex.: "200px", "100%"). Default "100%". */
  minHeight?: string;
  /**
   * Fonte de completar preditiva (motor do backend). Recebe o texto do início
   * do doc até o cursor; devolve candidatos canônicos. Quando definida, o
   * editor ganha um `autocompletion` cuja seleção substitui o doc inteiro pelo
   * candidato (pretty-printed se for JSON) — o caso de uso é "preencher o body
   * com o esqueleto previsto". Sem ela, o editor não tem autocomplete.
   */
  predictSuggestions?: (prefix: string) => Promise<string[]>;
}

// prettyJSON formata se for JSON válido; senão devolve cru. O esqueleto vem
// canônico/compacto do backend — pretty-printed é muito mais usável como body.
function prettyJSON(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

/**
 * Wrapper fino em volta do `@uiw/react-codemirror`.
 *
 * Tema: o app define cores via `data-theme` no `<html>` com CSS vars OKLCH.
 * Usamos `theme="none"` — `theme={undefined}` NÃO desliga o tema: o
 * `@uiw/react-codemirror` tem `theme = 'light'` como default param, então
 * `undefined` cai no tema CLARO (fundo branco) e ignora os 3 temas. Com
 * `"none"` não há tema embutido; fundo transparente + caret/seleção/texto e
 * realce de sintaxe vêm das CSS vars, acompanhando automaticamente os 3 temas.
 */
export default function CodeEditor({
  value,
  onChange,
  language = "text",
  placeholder,
  readOnly = false,
  className,
  minHeight = "100%",
  predictSuggestions,
}: CodeEditorProps) {
  const extensions = useMemo<Extension[]>(() => {
    const exts: Extension[] = [
      // Quebra de linha em vez de scroll horizontal — combina melhor com bodies.
      EditorView.lineWrapping,
      // Fundos transparentes para herdar o tema do container; tipografia mono.
      // theme="none" remove o tema embutido do CodeMirror — então caret,
      // seleção e cor do texto precisam vir explicitamente das CSS vars,
      // senão ficam no default do browser.
      EditorView.theme({
        "&": {
          backgroundColor: "transparent",
          color: "var(--foreground)",
          fontSize: "0.875rem",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          border: "none",
          color: "var(--muted-foreground)",
        },
        ".cm-activeLine": { backgroundColor: "transparent" },
        ".cm-activeLineGutter": { backgroundColor: "transparent" },
        "&.cm-focused": { outline: "none" },
        ".cm-content": {
          caretColor: "var(--foreground)",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },
        ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
          { backgroundColor: "var(--accent)" },
        ".cm-placeholder": { color: "var(--muted-foreground)" },
      }),
      syntaxHighlighting(themedHighlight),
    ];
    if (language === "json") exts.push(json());
    if (predictSuggestions) {
      exts.push(
        autocompletion({
          override: [
            async (ctx) => {
              const prefix = ctx.state.doc.sliceString(0, ctx.pos);
              // Não sugere com doc vazio (ruído) nem dentro de uma `{{var}}`.
              if (prefix.trim() === "" || prefix.includes("{{")) return null;
              let texts: string[];
              try {
                texts = await predictSuggestions(prefix);
              } catch {
                return null;
              }
              if (ctx.aborted || texts.length === 0) return null;
              const options: Completion[] = texts.map((s, i) => ({
                // boost decrescente preserva a ordem por score do backend.
                label: s,
                detail: "previsto",
                boost: 100 - i,
                // Substitui o doc inteiro pelo esqueleto (pretty p/ JSON).
                apply: (view) => {
                  const text = language === "json" ? prettyJSON(s) : s;
                  view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: text },
                    selection: { anchor: text.length },
                  });
                },
              }));
              // from:0 — o candidato representa o doc inteiro, não um token.
              return { from: 0, options, filter: false };
            },
          ],
        }),
      );
    }
    return exts;
  }, [language, predictSuggestions]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      minHeight={minHeight}
      theme="none"
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
      className={cn(
        "rounded-md border border-input bg-transparent text-sm text-foreground",
        className,
      )}
    />
  );
}
