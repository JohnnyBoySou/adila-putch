import { Button } from "@/components/ui/button";
import BodyEditor from "./view";
import FormDataEditor from "./form-data";

/**
 * Interface CONGELADA (consumida por features/editor/view.tsx). Não alterar a
 * assinatura sem ajustar o editor.
 *
 * `bodyType` segue a convenção do backend (internal/services/requests.go
 * `buildBody`): "" = raw (usa `body`, Content-Type pelo header do usuário),
 * "form" = x-www-form-urlencoded a partir de `form`, "multipart" = `form`
 * (campos texto) + `files` (campo→caminho de arquivo, lido do disco pelo Go).
 */
export interface BodyPanelProps {
  body: string;
  bodyType: string;
  form: Record<string, string>;
  files: Record<string, string>;
  method: string;
  onChange: (next: {
    body: string;
    bodyType: string;
    form: Record<string, string>;
    files: Record<string, string>;
  }) => void;
}

const MODES: Array<{ value: string; label: string }> = [
  { value: "", label: "Raw" },
  { value: "form", label: "Form URL-encoded" },
  { value: "multipart", label: "Multipart" },
];

export default function BodyPanel({
  body,
  bodyType,
  form,
  files,
  method,
  onChange,
}: BodyPanelProps) {
  const setMode = (mode: string) => onChange({ body, bodyType: mode, form, files });

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex gap-2">
        {MODES.map((m) => (
          <Button
            key={m.value || "raw"}
            size="sm"
            variant={bodyType === m.value ? "default" : "ghost"}
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {bodyType === "form" || bodyType === "multipart" ? (
          <FormDataEditor
            form={form}
            files={files}
            multipart={bodyType === "multipart"}
            onChange={(next) =>
              onChange({ body, bodyType, form: next.form, files: next.files })
            }
          />
        ) : (
          <BodyEditor
            body={body}
            method={method}
            onChange={(next) => onChange({ body: next, bodyType, form, files })}
          />
        )}
      </div>
    </div>
  );
}
