import { useState, useEffect } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface VariablesEditorProps {
  variables: Record<string, string>;
  onChange: (variables: Record<string, string>) => void;
}

export default function VariablesEditor({ variables, onChange }: VariablesEditorProps) {
  const [variableEntries, setVariableEntries] = useState<Array<{ key: string; value: string }>>(
    Object.entries(variables).map(([key, value]) => ({ key, value })),
  );

  useEffect(() => {
    const entries = Object.entries(variables).map(([key, value]) => ({ key, value }));
    setVariableEntries(entries.length > 0 ? entries : [{ key: "", value: "" }]);
  }, [variables]);

  const updateVariables = (entries: Array<{ key: string; value: string }>) => {
    setVariableEntries(entries);
    const newVariables: Record<string, string> = {};
    entries.forEach(({ key, value }) => {
      if (key.trim()) {
        newVariables[key.trim()] = value.trim();
      }
    });
    onChange(newVariables);
  };

  const addVariable = () => {
    updateVariables([...variableEntries, { key: "", value: "" }]);
  };

  const removeVariable = (index: number) => {
    const newEntries = variableEntries.filter((_, i) => i !== index);
    if (newEntries.length === 0) {
      updateVariables([{ key: "", value: "" }]);
    } else {
      updateVariables(newEntries);
    }
  };

  const updateVariable = (index: number, field: "key" | "value", value: string) => {
    const newEntries = [...variableEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    updateVariables(newEntries);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-foreground">Variáveis</h3>
        <Button size="sm" onClick={addVariable}>
          <PlusIcon className="h-4 w-4" />
          Adicionar variável
        </Button>
      </div>

      {variableEntries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <p>Nenhuma variável. Clique em "Adicionar variável".</p>
        </div>
      ) : (
        <div className="space-y-2">
          {variableEntries.map((variable, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="text"
                value={variable.key}
                onChange={(e) => updateVariable(index, "key", e.target.value)}
                placeholder="Nome da variável"
                className="flex-1"
              />
              <Input
                type="text"
                value={variable.value}
                onChange={(e) => updateVariable(index, "value", e.target.value)}
                placeholder="Valor da variável"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeVariable(index)}
                className="bg-transparent text-muted-foreground hover:text-destructive"
                aria-label="Remover variável"
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
