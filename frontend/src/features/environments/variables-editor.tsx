import { Button, Input } from "@/components/ui";
import { KeyRoundIcon, PlusIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

interface VariablesEditorProps {
  /** Mapa inicial — usado apenas para semear as linhas no mount (a edição
   *  acontece localmente; o pai recebe o mapa limpo via onChange). */
  variables: Record<string, string>;
  onChange: (variables: Record<string, string>) => void;
}

interface Row {
  /** id estável p/ key do React — preserva foco/seleção entre renders. */
  id: number;
  key: string;
  value: string;
}

// Constrói o mapa que vai pro store: chave trimada e não-vazia; o valor é
// preservado cru (tokens/segredos podem conter espaços — trimar destruiria).
function toMap(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (k) out[k] = r.value;
  }
  return out;
}

export default function VariablesEditor({ variables, onChange }: VariablesEditorProps) {
  const nextId = useRef(0);
  const makeRow = (key = "", value = ""): Row => ({ id: nextId.current++, key, value });

  // Semeia uma única vez (lazy initializer). O editor é dono das suas linhas;
  // o pai nunca empurra mudanças de volta — só recebe o mapa limpo.
  const [rows, setRows] = useState<Row[]>(() => {
    const seeded = Object.entries(variables).map(([k, v]) => makeRow(k, v));
    return seeded.length > 0 ? seeded : [makeRow()];
  });

  const commit = (next: Row[]) => {
    setRows(next);
    onChange(toMap(next));
  };

  const addRow = () => commit([...rows, makeRow()]);

  const removeRow = (id: number) => {
    const next = rows.filter((r) => r.id !== id);
    commit(next.length > 0 ? next : [makeRow()]);
  };

  const patchRow = (id: number, field: "key" | "value", value: string) =>
    commit(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const filled = rows.filter((r) => r.key.trim()).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium text-foreground">Variáveis</h3>
          <p className="text-xs text-muted-foreground">
            {filled === 0
              ? "Use {{nome}} nas requisições para referenciar."
              : `${filled} ${filled === 1 ? "variável definida" : "variáveis definidas"}.`}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          <PlusIcon className="size-4" />
          Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <div className="relative flex-1">
              <KeyRoundIcon
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={row.key}
                onChange={(e) => patchRow(row.id, "key", e.target.value)}
                placeholder="API_URL"
                aria-label="Nome da variável"
                autoComplete="off"
                spellCheck={false}
                className="pl-9 font-mono text-sm"
              />
            </div>
            <Input
              value={row.value}
              onChange={(e) => patchRow(row.id, "value", e.target.value)}
              placeholder="https://api.exemplo.com"
              aria-label="Valor da variável"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 font-mono text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(row.id)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Remover variável"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
