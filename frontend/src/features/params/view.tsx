import { useState, useEffect } from "react";
import VariableAutocomplete from "@/components/functional/variable-autocomplete";

interface QueryParamsEditorProps {
  params: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
  collectionId?: string;
}

export default function QueryParamsEditor({ params, onChange, collectionId }: QueryParamsEditorProps) {
  const [paramEntries, setParamEntries] = useState<Array<{ key: string; value: string }>>(
    Object.entries(params).map(([key, value]) => ({ key, value }))
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
        <h3 className="text-sm font-semibold text-gray-700">Query Parameters</h3>
        <button
          onClick={addParam}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + Add Parameter
        </button>
      </div>

      {paramEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p>No parameters. Click "Add Parameter" to add one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paramEntries.map((param, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={param.key}
                onChange={(e) => updateParam(index, "key", e.target.value)}
                placeholder="Parameter name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <VariableAutocomplete
                value={param.value}
                onChange={(value) => updateParam(index, "value", value)}
                placeholder="Parameter value"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                collectionId={collectionId}
              />
              <button
                onClick={() => removeParam(index)}
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

