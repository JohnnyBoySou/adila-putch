import { useState, useRef } from "react";
import VariableAutocomplete, {
  VariableAutocompleteRef,
} from "@/components/functional/variable-autocomplete";
import CodeEditor from "@/components/functional/code-editor";
import { Button } from "@/components/ui/button";
import { Variable } from "lucide-react";

interface BodyEditorProps {
  body: string;
  method: string;
  onChange: (body: string) => void;
}

const BODY_TYPES = ["JSON", "Text", "XML", "Form Data"];

export default function BodyEditor({ body, method, onChange }: BodyEditorProps) {
  const [bodyType, setBodyType] = useState<string>("JSON");
  const [isValidJson, setIsValidJson] = useState(true);
  const bodyInputRef = useRef<VariableAutocompleteRef>(null);

  const hasBody = ["POST", "PUT", "PATCH"].includes(method.toUpperCase());

  if (!hasBody) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <p>Requests {method} normalmente não têm body.</p>
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
      // JSON inválido, não dá para formatar
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          {BODY_TYPES.map((type) => (
            <Button
              key={type}
              size="sm"
              variant={bodyType === type ? "default" : "ghost"}
              onClick={() => setBodyType(type)}
            >
              {type}
            </Button>
          ))}
        </div>
        {bodyType === "JSON" && (
          <Button size="sm" variant="outline" onClick={formatJson}>
            Formatar JSON
          </Button>
        )}
      </div>

      {bodyType === "JSON" ? (
        // JSON usa o CodeMirror (syntax highlight, line numbers, fold).
        // O autocomplete de variáveis `{{}}` depende de manipulação direta
        // de selection em <textarea>/<input>, incompatível com o modelo de
        // documento do CodeMirror — por isso não está disponível neste modo.
        <div
          className={`flex-1 overflow-hidden relative ${
            !isValidJson && body.trim() !== "" ? "ring-1 ring-destructive rounded-md" : ""
          }`}
        >
          <CodeEditor
            value={body}
            onChange={handleBodyChange}
            language="json"
            placeholder={'{\n  "key": "value"\n}'}
            className="h-full"
          />
        </div>
      ) : (
        <div className="flex-1 border border-border rounded-lg overflow-hidden relative">
          <VariableAutocomplete
            ref={bodyInputRef}
            value={body}
            onChange={(value) => handleBodyChange(value)}
            as="textarea"
            className="w-full h-full p-3 pr-10 font-mono text-sm resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder={
              bodyType === "XML"
                ? '<?xml version="1.0"?>\n<root></root>'
                : "Digite o conteúdo do body..."
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => bodyInputRef.current?.openVariableMenu()}
            className="absolute top-2 right-2 h-7 w-7 bg-transparent text-muted-foreground hover:text-foreground"
            title="Inserir variável (Ctrl+Space)"
          >
            <Variable size={16} />
          </Button>
        </div>
      )}

      {bodyType === "JSON" && !isValidJson && body.trim() !== "" && (
        <div className="mt-2 text-sm text-destructive">Sintaxe JSON inválida</div>
      )}
    </div>
  );
}
