import { useState, useEffect } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VariableAutocomplete from "@/components/functional/variable-autocomplete";

interface QueryParamsEditorProps {
  params: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
}

const autocompleteClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function QueryParamsEditor({ params, onChange }: QueryParamsEditorProps) {
  const [paramEntries, setParamEntries] = useState<Array<{ key: string; value: string }>>(
    Object.entries(params).map(([key, value]) => ({ key, value })),
  );

  useEffect(() => {
    const entries = Object.entries(params).map(([key, value]) => ({ key, value }));
    setParamEntries(entries.length > 0 ? entries : [{ key: "", value: "" }]);
  }, [params]);

  const updateParams = (entries: Array<{ key: string; value: string }>) => {
    setParamEntries(entries);
    const newParams: Record<string, string> = {};
    entries.forEach(({ key, value }) => {
      if (key.trim()) {
        newParams[key.trim()] = value.trim();
      }
    });
    onChange(newParams);
  };

  const addParam = () => {
    updateParams([...paramEntries, { key: "", value: "" }]);
  };

  const removeParam = (index: number) => {
    const newEntries = paramEntries.filter((_, i) => i !== index);
    if (newEntries.length === 0) {
      updateParams([{ key: "", value: "" }]);
    } else {
      updateParams(newEntries);
    }
  };

  const updateParam = (index: number, field: "key" | "value", value: string) => {
    const newEntries = [...paramEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    updateParams(newEntries);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-foreground">Query Parameters</h3>
        <Button size="sm" onClick={addParam}>
          <PlusIcon className="h-4 w-4" />
          Adicionar parâmetro
        </Button>
      </div>

      {paramEntries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <p>Nenhum parâmetro. Clique em "Adicionar parâmetro".</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paramEntries.map((param, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="text"
                value={param.key}
                onChange={(e) => updateParam(index, "key", e.target.value)}
                placeholder="Nome do parâmetro"
                className="flex-1"
              />
              <VariableAutocomplete
                value={param.value}
                onChange={(value) => updateParam(index, "value", value)}
                placeholder="Valor do parâmetro"
                className={autocompleteClass}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeParam(index)}
                className="bg-transparent text-muted-foreground hover:text-destructive"
                aria-label="Remover parâmetro"
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
