import { useMemo } from "react";
import CodeMirror, { EditorView, type Extension } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { cn } from "@/lib/utils";

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
}

/**
 * Wrapper fino em volta do `@uiw/react-codemirror`.
 *
 * Tema: o app define cores via `data-theme` no `<html>` com CSS vars OKLCH.
 * Para herdar, não passamos um tema do CodeMirror (`theme={undefined}`) e
 * deixamos os fundos transparentes; a cor do texto vem de `text-foreground`
 * no container. Assim o editor acompanha automaticamente os 3 temas.
 */
export default function CodeEditor({
  value,
  onChange,
  language = "text",
  placeholder,
  readOnly = false,
  className,
  minHeight = "100%",
}: CodeEditorProps) {
  const extensions = useMemo<Extension[]>(() => {
    const exts: Extension[] = [
      // Quebra de linha em vez de scroll horizontal — combina melhor com bodies.
      EditorView.lineWrapping,
      // Fundos transparentes para herdar o tema do container; tipografia mono.
      EditorView.theme({
        "&": {
          backgroundColor: "transparent",
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
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },
        ".cm-placeholder": { color: "var(--muted-foreground)" },
      }),
    ];
    if (language === "json") exts.push(json());
    return exts;
  }, [language]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      placeholder={placeholder}
      minHeight={minHeight}
      theme={undefined}
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
