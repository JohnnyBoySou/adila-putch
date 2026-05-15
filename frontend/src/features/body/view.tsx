import { useState, useRef } from "react";
import VariableAutocomplete, { VariableAutocompleteRef } from "@/components/functional/variable-autocomplete";
import { Variable } from "lucide-react";
import { motion } from "motion/react";

interface BodyEditorProps {
  body: string;
  method: string;
  onChange: (body: string) => void;
  collectionId?: string;
}

const BODY_TYPES = ["JSON", "Text", "XML", "Form Data"];

export default function BodyEditor({ body, method, onChange, collectionId }: BodyEditorProps) {
  const [bodyType, setBodyType] = useState<string>("JSON");
  const [isValidJson, setIsValidJson] = useState(true);
  const bodyInputRef = useRef<VariableAutocompleteRef>(null);

  const hasBody = ["POST", "PUT", "PATCH"].includes(method.toUpperCase());

  if (!hasBody) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        <p>{method} requests typically don't have a body.</p>
      </div>
    );
  }

  const handleBodyChange = (value: string) => {
    onChange(value);
    if (bodyType === "JSON") {
      try {
        JSON.parse(value);
        setIsValidJson(true);
      } catch {
        setIsValidJson(value.trim() === "" || false);
      }
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(body);
      onChange(JSON.stringify(parsed, null, 2));
      setIsValidJson(true);
    } catch {
      // Invalid JSON, can't format
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          {BODY_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setBodyType(type)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                bodyType === type
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        {bodyType === "JSON" && (
          <button
            onClick={formatJson}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Format JSON
          </button>
        )}
      </div>

      <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden relative">
        <VariableAutocomplete
          ref={bodyInputRef}
          value={body}
          onChange={(value) => handleBodyChange(value)}
          as="textarea"
          className={`w-full h-full p-3 pr-10 font-mono text-sm resize-none focus:outline-none ${
            bodyType === "JSON" && !isValidJson ? "bg-red-50 border-red-300" : ""
          }`}
          placeholder={
            bodyType === "JSON"
              ? '{\n  "key": "value"\n}'
              : bodyType === "XML"
              ? '<?xml version="1.0"?>\n<root></root>'
              : "Enter body content..."
          }
          collectionId={collectionId}
        />
        <motion.button
          type="button"
          onClick={() => bodyInputRef.current?.openVariableMenu()}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors z-10"
          title="Insert variable (Ctrl+Space)"
        >
          <Variable size={16} />
        </motion.button>
      </div>

      {bodyType === "JSON" && !isValidJson && body.trim() !== "" && (
        <div className="mt-2 text-sm text-red-600">
          Invalid JSON syntax
        </div>
      )}
    </div>
  );
}

