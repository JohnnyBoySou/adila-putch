import { useEffect, useState } from "react";
import { Dialogs } from "@wailsio/runtime";
import { FolderOpenIcon, PaperclipIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Interface CONGELADA (consumida por features/body/panel.tsx). Não alterar a
 * assinatura sem ajustar o panel.
 *
 * `form`  → campos texto (x-www-form-urlencoded ou parte texto do multipart).
 * `files` → campo → CAMINHO DE ARQUIVO no disco (o Go faz os.Open; precisa do
 *           file dialog nativo do Wails, não do <input type=file> do browser).
 * `multipart` → quando true, exibe a seção de arquivos.
 */
export interface FormDataEditorProps {
  form: Record<string, string>;
  files: Record<string, string>;
  multipart: boolean;
  onChange: (next: { form: Record<string, string>; files: Record<string, string> }) => void;
}

type Row = { key: string; value: string };

const toRows = (m: Record<string, string>): Row[] => {
  const rows = Object.entries(m).map(([key, value]) => ({ key, value }));
  return rows.length > 0 ? rows : [{ key: "", value: "" }];
};

const toMap = (rows: Row[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const { key, value } of rows) {
    if (key.trim()) out[key.trim()] = value;
  }
  return out;
};

type FileRowProps = {
  row: Row;
  onKeyChange: (key: string) => void;
  onValueChange: (value: string) => void;
  onRemove: () => void;
};

/**
 * O backend faz `os.Open(path)` com o caminho que chega em `files[campo]`,
 * portanto precisa de um caminho absoluto no disco — não de um File do browser.
 * O seletor nativo do Wails (Dialogs.OpenFile) retorna o caminho real;
 * fora do runtime (ex.: `vite dev` no browser), cai no fallback de input manual.
 */
function FileRow({ row, onKeyChange, onValueChange, onRemove }: FileRowProps) {
  const [wailsUnavailable, setWailsUnavailable] = useState(false);

  const handleChooseFile = async () => {
    try {
      const result = await Dialogs.OpenFile({ Title: "Selecionar arquivo" });
      // OpenFile retorna array (ou null/undefined → defaultado para [])
      const path = Array.isArray(result) ? result[0] : result;
      if (path) onValueChange(path);
    } catch {
      // Fora do runtime Wails (ex.: browser de dev) o IPC não existe;
      // exibe o input manual como fallback.
      setWailsUnavailable(true);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={row.key}
        onChange={(e) => onKeyChange(e.target.value)}
        placeholder="Nome do campo"
        className="flex-1"
      />
      <div className="flex flex-1 gap-1">
        {/* Caminho escolhido: somente-leitura quando seletor nativo disponível */}
        {wailsUnavailable ? (
          <Input
            value={row.value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="/caminho/do/arquivo"
            className="flex-1"
          />
        ) : (
          <Input
            value={row.value}
            readOnly
            placeholder="Nenhum arquivo selecionado"
            title={row.value}
            className="flex-1 cursor-default truncate"
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleChooseFile}
          aria-label="Escolher arquivo"
        >
          <FolderOpenIcon className="h-4 w-4" />
          Escolher
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="bg-transparent text-muted-foreground hover:text-destructive"
        aria-label="Remover arquivo"
      >
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function FormDataEditor({
  form,
  files,
  multipart,
  onChange,
}: FormDataEditorProps) {
  const [formRows, setFormRows] = useState<Row[]>(toRows(form));
  const [fileRows, setFileRows] = useState<Row[]>(toRows(files));

  useEffect(() => {
    setFormRows(toRows(form));
  }, [form]);
  useEffect(() => {
    setFileRows(toRows(files));
  }, [files]);

  const pushForm = (rows: Row[]) => {
    setFormRows(rows);
    onChange({ form: toMap(rows), files: toMap(fileRows) });
  };
  const pushFiles = (rows: Row[]) => {
    setFileRows(rows);
    onChange({ form: toMap(formRows), files: toMap(rows) });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Campos do formulário</h3>
          <Button size="sm" onClick={() => pushForm([...formRows, { key: "", value: "" }])}>
            <PlusIcon className="h-4 w-4" />
            Adicionar campo
          </Button>
        </div>
        <div className="space-y-2">
          {formRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={row.key}
                onChange={(e) =>
                  pushForm(formRows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))
                }
                placeholder="Nome do campo"
                className="flex-1"
              />
              <Input
                value={row.value}
                onChange={(e) =>
                  pushForm(formRows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                }
                placeholder="Valor"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => pushForm(formRows.filter((_, j) => j !== i))}
                className="bg-transparent text-muted-foreground hover:text-destructive"
                aria-label="Remover campo"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {multipart && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Arquivos</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => pushFiles([...fileRows, { key: "", value: "" }])}
            >
              <PaperclipIcon className="h-4 w-4" />
              Adicionar arquivo
            </Button>
          </div>
          <div className="space-y-2">
            {fileRows.map((row, i) => (
              <FileRow
                key={i}
                row={row}
                onKeyChange={(key) =>
                  pushFiles(fileRows.map((r, j) => (j === i ? { ...r, key } : r)))
                }
                onValueChange={(value) =>
                  pushFiles(fileRows.map((r, j) => (j === i ? { ...r, value } : r)))
                }
                onRemove={() => pushFiles(fileRows.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
