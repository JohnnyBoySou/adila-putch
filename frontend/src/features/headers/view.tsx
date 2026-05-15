import { useState } from "react";
import VariableAutocomplete from "@/components/functional/variable-autocomplete";

interface HeadersEditorProps {
  headers: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
  collectionId?: string;
}

export default function HeadersEditor({ headers, onChange, collectionId }: HeadersEditorProps) {
  const [headerEntries, setHeaderEntries] = useState<Array<{ key: string; value: string }>>(
    Object.entries(headers).map(([key, value]) => ({ key, value }))
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
        <h3 className="text-sm font-semibold text-gray-700">HTTP Headers</h3>
        <button
          onClick={addHeader}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + Add Header
        </button>
      </div>

      {headerEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p>No headers. Click "Add Header" to add one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {headerEntries.map((header, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={header.key}
                onChange={(e) => updateHeader(index, "key", e.target.value)}
                placeholder="Header name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <VariableAutocomplete
                value={header.value}
                onChange={(value) => updateHeader(index, "value", value)}
                placeholder="Header value"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                collectionId={collectionId}
              />
              <button
                onClick={() => removeHeader(index)}
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

