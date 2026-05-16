import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VariableAutocomplete from "@/components/functional/variable-autocomplete";

interface HeadersEditorProps {
  headers: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
}

const autocompleteClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  const [headerEntries, setHeaderEntries] = useState<Array<{ key: string; value: string }>>(
    Object.entries(headers).map(([key, value]) => ({ key, value })),
  );

  const updateHeaders = (entries: Array<{ key: string; value: string }>) => {
    setHeaderEntries(entries);
    const newHeaders: Record<string, string> = {};
    entries.forEach(({ key, value }) => {
      if (key.trim()) {
        newHeaders[key.trim()] = value.trim();
      }
    });
    onChange(newHeaders);
  };

  const addHeader = () => {
    updateHeaders([...headerEntries, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    updateHeaders(headerEntries.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: "key" | "value", value: string) => {
    const newEntries = [...headerEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    updateHeaders(newEntries);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-foreground">HTTP Headers</h3>
        <Button size="sm" onClick={addHeader}>
          <PlusIcon className="h-4 w-4" />
          Adicionar header
        </Button>
      </div>

      {headerEntries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <p>Nenhum header. Clique em "Adicionar header".</p>
        </div>
      ) : (
        <div className="space-y-2">
          {headerEntries.map((header, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="text"
                value={header.key}
                onChange={(e) => updateHeader(index, "key", e.target.value)}
                placeholder="Nome do header"
                className="flex-1"
              />
              <VariableAutocomplete
                value={header.value}
                onChange={(value) => updateHeader(index, "value", value)}
                placeholder="Valor do header"
                className={autocompleteClass}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeHeader(index)}
                className="bg-transparent text-muted-foreground hover:text-destructive"
                aria-label="Remover header"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
