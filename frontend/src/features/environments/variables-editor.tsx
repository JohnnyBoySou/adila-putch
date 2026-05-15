import { useState, useEffect } from "react";

interface VariablesEditorProps {
  variables: Record<string, string>;
  onChange: (variables: Record<string, string>) => void;
}

export default function VariablesEditor({ variables, onChange }: VariablesEditorProps) {
  const [variableEntries, setVariableEntries] = useState<Array<{ key: string; value: string }>>(
    Object.entries(variables).map(([key, value]) => ({ key, value }))
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
        <h3 className="text-sm font-semibold text-gray-700">Variables</h3>
        <button
          onClick={addVariable}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + Add Variable
        </button>
      </div>

      {variableEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p>No variables. Click "Add Variable" to add one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {variableEntries.map((variable, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={variable.key}
                onChange={(e) => updateVariable(index, "key", e.target.value)}
                placeholder="Variable name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <input
                type="text"
                value={variable.value}
                onChange={(e) => updateVariable(index, "value", e.target.value)}
                placeholder="Variable value"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <button
                onClick={() => removeVariable(index)}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

