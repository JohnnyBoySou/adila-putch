import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Download,
  FileText,
  GitCompare,
  Search,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDiffBaseline } from "@/stores/history.store";
import { strMap } from "../../lib/utils";
import { ResponseData } from "../../services/request.service";

interface ResponseViewProps {
  response: ResponseData;
}

interface TabState {
  payload: boolean;
  headers: boolean;
  timing: boolean;
}

const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) return "text-success";   // 2xx — sucesso
  if (status >= 300 && status < 400) return "text-info";      // 3xx — redirecionamento
  if (status >= 400 && status < 500) return "text-warning";   // 4xx — erro do cliente
  if (status >= 500) return "text-destructive";               // 5xx — erro do servidor
  return "text-muted-foreground";
};

const isDateString = (value: string): boolean => {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?$/;
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T|\s|$)/;
  return isoDateRegex.test(value) || dateRegex.test(value);
};

// Formata um tamanho em bytes como B / KB / MB (1 casa decimal).
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Escapa caracteres HTML perigosos antes de qualquer marcação.
const escapeHtml = (src: string): string =>
  src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Aplica syntax highlighting leve em JSON já formatado.
// IMPORTANTE: escapa o HTML PRIMEIRO; os spans são inseridos apenas
// sobre a string já escapada (nunca sobre input cru).
const highlightJson = (src: string): string => {
  const escaped = escapeHtml(src);

  // Strings (incluindo as que são chave de objeto, detectadas pelo ":" seguinte),
  // depois booleanos/null e por fim números.
  return escaped
    .replace(
      /"(?:\\.|[^"\\])*"(\s*:)?/g,
      (match, isKey) =>
        isKey
          // Chave de objeto → token semântico de chave
          ? `<span class="text-code-key">${match.slice(0, -1)}</span><span class="text-muted-foreground">:</span>`
          // String valor → token semântico de string
          : `<span class="text-code-string">${match}</span>`,
    )
    .replace(
      /\b(true|false)\b/g,
      // Boolean → token semântico de boolean
      '<span class="text-code-boolean">$1</span>',
    )
    .replace(
      /\bnull\b/g,
      // null → neutro (muted), como pontuação
      '<span class="text-muted-foreground">null</span>',
    )
    .replace(
      /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g,
      // Número → token semântico de número
      '<span class="text-code-number">$&</span>',
    )
    .replace(
      // Pontuação/estrutura ({, }, [, ], ,) → neutro (muted)
      /[{}[\],]/g,
      '<span class="text-muted-foreground">$&</span>',
    );
};

const jsonToTypeScript = (
  obj: any,
  interfaceName: string = "Response",
  depth: number = 0,
  keyName: string = "",
): string => {
  if (depth > 10) return "any";

  if (obj === null) return "null";
  if (obj === undefined) return "undefined";

  const objType = typeof obj;

  if (objType === "boolean") return "boolean";
  if (objType === "number") return "number";
  if (objType === "string") {
    const isDateKey = /(date|time|timestamp|created|updated|deleted|at|on)$/i.test(keyName);
    if (isDateString(obj) || isDateKey) {
      return "Date | string";
    }
    return "string";
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "any[]";
    const itemType = jsonToTypeScript(obj[0], "", depth + 1, keyName);
    return `${itemType}[]`;
  }

  if (objType === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "Record<string, never>";

    const properties = entries
      .map(([key, value]) => {
        const sanitizedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
        const valueType = jsonToTypeScript(value, "", depth + 1, key);
        const optional = value === null || value === undefined ? "?" : "";
        return `  ${sanitizedKey}${optional}: ${valueType};`;
      })
      .join("\n");

    if (depth === 0) {
      return `interface ${interfaceName} {\n${properties}\n}`;
    }
    return `{\n${properties}\n}`;
  }

  return "any";
};

// Cores das folhas da árvore, coerentes com os tokens de highlightJson.
const leafColorClass = (value: unknown): string => {
  if (value === null) return "text-muted-foreground"; // null → neutro
  switch (typeof value) {
    case "string":
      return "text-code-string";   // string → token semântico
    case "number":
      return "text-code-number";   // número → token semântico
    case "boolean":
      return "text-code-boolean";  // boolean → token semântico
    default:
      return "text-muted-foreground";
  }
};

// Renderiza o valor textual de uma folha (strings entre aspas).
const renderLeafValue = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
};

// Realça (case-insensitive) as ocorrências de `query` dentro de `text`.
const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let idx = lower.indexOf(q, from);
  let chunk = 0;
  while (idx !== -1) {
    if (idx > from) parts.push(text.slice(from, idx));
    parts.push(
      // Realce de busca → bg-warning/15 (token semântico de destaque/atenção)
      <mark key={`m-${chunk++}`} className="bg-warning/15 text-inherit rounded-sm">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    from = idx + q.length;
    idx = lower.indexOf(q, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
};

// Indica se um nó (ou qualquer descendente) casa com a busca, considerando
// chave, caminho e valor — case-insensitive.
const nodeMatchesQuery = (value: unknown, keyLabel: string, query: string): boolean => {
  if (!query) return false;
  const q = query.toLowerCase();
  if (keyLabel.toLowerCase().includes(q)) return true;

  if (value !== null && typeof value === "object") {
    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>);
    return entries.some(([k, v]) => nodeMatchesQuery(v, k, query));
  }

  return renderLeafValue(value).toLowerCase().includes(q);
};

// Uma linha do diff unificado: contexto (igual), adicionada ou removida.
type DiffLine = { type: "ctx" | "add" | "del"; text: string };

// Diff linha a linha clássico via LCS (subsequência comum mais longa).
// `a` é a versão antiga (baseline) e `b` a atual; linhas só em `a` viram
// "del", só em `b` viram "add" e as comuns viram "ctx".
const diffLines = (a: string[], b: string[]): DiffLine[] => {
  const n = a.length;
  const m = b.length;

  // Matriz de comprimentos da LCS: lcs[i][j] = LCS de a[i:] e b[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Reconstrói a sequência de operações percorrendo a matriz.
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "ctx", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
};

interface JsonNodeProps {
  // Rótulo da chave (ou índice) deste nó; vazio na raiz.
  nodeKey: string;
  value: unknown;
  // Caminho acumulado, usado como identidade de expansão.
  path: string;
  depth: number;
  query: string;
}

// Nó recursivo da árvore de JSON. Objetos/arrays viram nós expansíveis com
// contagem de filhos; folhas são coloridas por tipo.
function JsonNode({ nodeKey, value, path, depth, query }: JsonNodeProps) {
  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);

  // Filhos quando container.
  const entries: Array<readonly [string, unknown]> = isObject
    ? isArray
      ? (value as unknown[]).map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>)
    : [];

  // Ramo casa diretamente (chave/valor) — usado para realçar o rótulo.
  const selfMatch = query
    ? nodeKey.toLowerCase().includes(query.toLowerCase()) ||
      (!isObject && renderLeafValue(value).toLowerCase().includes(query.toLowerCase()))
    : false;

  // Algum descendente casa — força expandir o ramo durante a busca.
  const subtreeMatch = query
    ? isObject && entries.some(([k, v]) => nodeMatchesQuery(v, k, query))
    : false;

  // Raiz e dois primeiros níveis expandidos por padrão; resto colapsado.
  const [expanded, setExpanded] = useState(depth < 2);

  const open = expanded || selfMatch || subtreeMatch;

  if (!isObject) {
    return (
      <div className="flex items-start gap-1 py-0.5 pl-1">
        {nodeKey !== "" && (
          <>
            {/* Chave da folha → token semântico de chave */}
            <span className="text-code-key">{highlightMatch(nodeKey, query)}</span>
            <span className="text-muted-foreground">:</span>
          </>
        )}
        <span className={leafColorClass(value)}>
          {highlightMatch(renderLeafValue(value), query)}
        </span>
      </div>
    );
  }

  const childCount = entries.length;
  const summary = isArray
    ? `[…] ${childCount} ${childCount === 1 ? "item" : "itens"}`
    : `{…} ${childCount} ${childCount === 1 ? "chave" : "chaves"}`;

  return (
    <div className="py-0.5">
      {/* role=button proposital: span aninhado num nó clicável da árvore — <button> dentro de <button> é HTML inválido */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <span role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="inline-flex items-center gap-1 cursor-pointer select-none rounded hover:bg-accent/30"
      >
        {open ? (
          <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
        )}
        {nodeKey !== "" && (
          <>
            {/* Chave do nó expansível → token semântico de chave */}
            <span className="text-code-key">{highlightMatch(nodeKey, query)}</span>
            <span className="text-muted-foreground">:</span>
          </>
        )}
        {/* Resumo do container ({…} / […]) → neutro */}
        <span className="text-muted-foreground">{summary}</span>
      </span>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-l border-border ml-[6px] pl-3"
          >
            {entries.map(([k, v]) => (
              <JsonNode
                key={`${path}/${k}`}
                nodeKey={k}
                value={v}
                path={`${path}/${k}`}
                depth={depth + 1}
                query={query}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ResponseView({ response }: ResponseViewProps) {
  const [viewMode, setViewMode] = useState<"pretty" | "raw" | "tree" | "diff">(
    "pretty",
  );
  const [treeQuery, setTreeQuery] = useState("");
  // Corpo da resposta da execução anterior da mesma request (null se não há
  // base de comparação). Habilita o modo "Diff".
  const diffBaseline = useDiffBaseline();
  const [isJson, setIsJson] = useState(false);
  const [showTypeScript, setShowTypeScript] = useState(false);
  const [typeScriptInterface, setTypeScriptInterface] = useState<string>("");
  const [tabsOpen, setTabsOpen] = useState<TabState>({
    payload: true,
    headers: false,
    timing: false,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      JSON.parse(response.body);
      setIsJson(true);
    } catch {
      setIsJson(false);
      // Tree só existe para JSON; volta a pretty se a resposta deixou de ser JSON.
      setViewMode((mode) => (mode === "tree" ? "pretty" : mode));
    }
  }, [response.body]);

  // Diff só existe se há execução anterior comparável; sem base, volta a pretty.
  useEffect(() => {
    if (diffBaseline === null) {
      setViewMode((mode) => (mode === "diff" ? "pretty" : mode));
    }
  }, [diffBaseline]);

  const formatBody = () => {
    if (isJson && viewMode === "pretty") {
      try {
        return JSON.stringify(JSON.parse(response.body), null, 2);
      } catch {
        return response.body;
      }
    }
    return response.body;
  };

  const handleConvertToTypeScript = () => {
    if (!isJson) return;

    try {
      const parsed = JSON.parse(response.body);
      const interfaceCode = jsonToTypeScript(parsed, "Response");
      setTypeScriptInterface(interfaceCode);
      setShowTypeScript(true);
    } catch (error) {
      console.error("Error converting to TypeScript:", error);
    }
  };

  const handleCopyTypeScript = async () => {
    try {
      await navigator.clipboard.writeText(typeScriptInterface);
      toast.success("Interface TypeScript copiada");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  const toggleTab = (tab: keyof TabState) => {
    setTabsOpen((prev) => ({
      ...prev,
      [tab]: !prev[tab],
    }));
  };

  const handleCopyHeader = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(`${key}: ${value}`);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error("Error copying header:", error);
    }
  };

  // Tamanho do corpo da resposta em bytes (UTF-8), memoizado.
  const bodySize = useMemo(
    () => new TextEncoder().encode(response.body).length,
    [response.body],
  );

  // JSON parseado para a árvore; null se não for JSON válido.
  const parsedBody = useMemo<unknown>(() => {
    if (!isJson) return null;
    try {
      return JSON.parse(response.body);
    } catch {
      return null;
    }
  }, [isJson, response.body]);

  // Diff linha a linha entre a execução anterior (baseline) e a atual.
  // Se ambos forem JSON válido, compara as versões "pretty" para um diff
  // estável (ordem/identação normalizadas); senão compara texto cru.
  const diffResult = useMemo<DiffLine[] | null>(() => {
    if (diffBaseline === null) return null;

    const normalize = (src: string): string => {
      try {
        return JSON.stringify(JSON.parse(src), null, 2);
      } catch {
        return src;
      }
    };

    let oldText = diffBaseline;
    let newText = response.body;
    // Só normaliza como JSON se AMBOS forem JSON válido.
    try {
      JSON.parse(diffBaseline);
      JSON.parse(response.body);
      oldText = normalize(diffBaseline);
      newText = normalize(response.body);
    } catch {
      // Ao menos um não é JSON — mantém o texto cru dos dois.
    }

    if (oldText === newText) return [];
    return diffLines(oldText.split("\n"), newText.split("\n"));
  }, [diffBaseline, response.body]);

  // Baixa o corpo da resposta como arquivo (.json se JSON, senão .txt).
  const handleDownload = () => {
    const blob = new Blob([response.body], {
      type: isJson ? "application/json" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = isJson ? "response.json" : "response.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(formatBody());
      setCopiedKey("__payload__");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error("Error copying payload:", error);
    }
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return "N/A";
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Barra de status */}
      <div className="border-b border-border bg-muted/40 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${getStatusColor(response.status)}`}>
            {response.status}
          </span>
          <span className="text-sm text-muted-foreground">
            {response.status >= 200 && response.status < 300 ? "OK" : "Erro"}
          </span>
          {/* Tamanho do corpo da resposta */}
          <span className="text-xs text-muted-foreground">{formatBytes(bodySize)}</span>
        </div>
        <div className="flex gap-2">
          {isJson && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleConvertToTypeScript}
              title="Converter para interface TypeScript"
            >
              To TypeScript
            </Button>
          )}
          <Button
            size="sm"
            variant={viewMode === "pretty" ? "default" : "ghost"}
            onClick={() => setViewMode("pretty")}
          >
            Pretty
          </Button>
          <Button
            size="sm"
            variant={viewMode === "raw" ? "default" : "ghost"}
            onClick={() => setViewMode("raw")}
          >
            Raw
          </Button>
          {/* Tree só faz sentido com JSON; some quando não for, como o To TypeScript */}
          {isJson && (
            <Button
              size="sm"
              variant={viewMode === "tree" ? "default" : "ghost"}
              onClick={() => setViewMode("tree")}
            >
              Tree
            </Button>
          )}
          {/* Diff só aparece quando há execução anterior comparável */}
          {diffBaseline !== null && (
            <Button
              size="sm"
              variant={viewMode === "diff" ? "default" : "ghost"}
              onClick={() => setViewMode("diff")}
              title="Comparar com a execução anterior"
            >
              <GitCompare size={14} />
              Diff
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownload}
            title="Baixar corpo da resposta"
          >
            <Download size={14} />
            Baixar
          </Button>
        </div>
      </div>

      {/* Seções */}
      <div className="flex-1 overflow-y-auto">
        {/* Payload */}
        <div className="border-b border-border">
          <button
            onClick={() => toggleTab("payload")}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: tabsOpen.payload ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight size={16} className="text-muted-foreground" />
              </motion.div>
              <Code size={16} className="text-muted-foreground" />
              <span className="font-medium text-foreground">Payload</span>
            </div>
            {/* Botão copiar: span com role=button para não aninhar <button> no toggle */}
            {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
            <span role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleCopyPayload();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCopyPayload();
                }
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent transition-colors"
              title="Copiar payload"
              aria-label="Copiar payload"
            >
              {copiedKey === "__payload__" ? (
                <Check size={14} className="text-success" />
              ) : (
                <Copy size={14} className="text-muted-foreground" />
              )}
            </span>
          </button>
          <AnimatePresence>
            {tabsOpen.payload && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {/* Fundo do bloco de código → bg-card (token semântico, se adapta ao tema) */}
                <div className="bg-card text-code-string font-mono text-sm max-h-96 overflow-y-auto">
                  {viewMode === "diff" && diffResult !== null ? (
                    <div className="p-4 space-y-2">
                      {/* Legenda do diff → muted */}
                      <div className="text-xs text-muted-foreground select-none">
                        Comparando com a execução anterior
                      </div>
                      {diffResult.length === 0 ? (
                        <div className="text-muted-foreground italic">
                          Sem diferenças em relação à execução anterior.
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap break-words">
                          {diffResult.map((line, idx) => {
                            // Linha adicionada → success; removida → destructive; contexto → neutro
                            const cls =
                              line.type === "add"
                                ? "bg-success/15 border-l-2 border-success text-success"
                                : line.type === "del"
                                  ? "bg-destructive/10 border-l-2 border-destructive text-destructive"
                                  : "border-l-2 border-transparent text-muted-foreground";
                            const prefix =
                              line.type === "add"
                                ? "+"
                                : line.type === "del"
                                  ? "-"
                                  : " ";
                            return (
                              <div
                                key={`diff-${idx}`}
                                className={`${cls} pl-2 pr-1`}
                              >
                                <span className="select-none text-muted-foreground mr-2">
                                  {prefix}
                                </span>
                                {line.text}
                              </div>
                            );
                          })}
                        </pre>
                      )}
                    </div>
                  ) : isJson && viewMode === "tree" ? (
                    <div className="p-4">
                      {/* Busca dentro da árvore: filtra por chave/valor e realça */}
                      <div className="relative mb-3">
                        <Search
                          size={14}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                        />
                        <Input
                          value={treeQuery}
                          onChange={(e) => setTreeQuery(e.target.value)}
                          placeholder="Buscar na resposta…"
                          className="h-8 pl-8 bg-muted/60 border-border text-foreground"
                        />
                      </div>
                      <JsonNode
                        nodeKey=""
                        value={parsedBody}
                        path=""
                        depth={0}
                        query={treeQuery.trim()}
                      />
                    </div>
                  ) : isJson && viewMode === "pretty" ? (
                    // highlightJson escapa o HTML antes de inserir os spans;
                    // dangerouslySetInnerHTML só recebe a string já escapada.
                    <pre
                      className="p-4 whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={{ __html: highlightJson(formatBody()) }}
                    />
                  ) : (
                    <pre className="p-4 whitespace-pre-wrap break-words">{formatBody()}</pre>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Headers */}
        <div className="border-b border-border">
          <button
            onClick={() => toggleTab("headers")}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: tabsOpen.headers ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight size={16} className="text-muted-foreground" />
              </motion.div>
              <FileText size={16} className="text-muted-foreground" />
              <span className="font-medium text-foreground">Headers</span>
              <span className="text-xs text-muted-foreground">
                ({Object.keys(response.headers).length})
              </span>
            </div>
          </button>
          <AnimatePresence>
            {tabsOpen.headers && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-muted/40 space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(strMap(response.headers)).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2 p-2 bg-card rounded border border-border hover:border-ring transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground mb-1">{key}</div>
                        <div className="text-xs text-muted-foreground break-all">{value}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyHeader(key, value)}
                        className="h-7 w-7 flex-shrink-0 bg-transparent"
                        title="Copiar header"
                        aria-label="Copiar header"
                      >
                        {copiedKey === key ? (
                          <Check size={14} className="text-success" />
                        ) : (
                          <Copy size={14} className="text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Timing */}
        <div className="border-b border-border">
          <button
            onClick={() => toggleTab("timing")}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: tabsOpen.timing ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight size={16} className="text-muted-foreground" />
              </motion.div>
              <Timer size={16} className="text-muted-foreground" />
              <span className="font-medium text-foreground">Timing</span>
            </div>
            {response.duration_ms && (
              <span className="text-sm font-semibold text-primary">
                {formatDuration(response.duration_ms)}
              </span>
            )}
          </button>
          <AnimatePresence>
            {tabsOpen.timing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-muted/40">
                  <div className="bg-card rounded border border-border p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          Tempo de resposta:
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          {formatDuration(response.duration_ms)}
                        </span>
                      </div>
                      {response.duration_ms && (
                        <div className="pt-2 border-t border-border">
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>
                              <span className="font-medium">Milissegundos:</span>{" "}
                              {response.duration_ms.toFixed(2)}ms
                            </div>
                            <div>
                              <span className="font-medium">Segundos:</span>{" "}
                              {(response.duration_ms / 1000).toFixed(3)}s
                            </div>
                          </div>
                        </div>
                      )}
                      {!response.duration_ms && (
                        <div className="text-sm text-muted-foreground italic">
                          Informação de timing não disponível
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal TypeScript */}
      <Dialog open={showTypeScript} onOpenChange={setShowTypeScript}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Interface TypeScript</DialogTitle>
          </DialogHeader>
          {/* Fundo do bloco TypeScript → bg-card (token semântico) */}
          <div className="max-h-[60vh] overflow-y-auto rounded-md bg-card p-4 font-mono text-sm text-code-string">
            <pre className="whitespace-pre-wrap break-words">{typeScriptInterface}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTypeScript(false)}>
              Fechar
            </Button>
            <Button onClick={handleCopyTypeScript}>Copiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
