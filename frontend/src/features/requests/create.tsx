import { useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateRequestData } from "../../services/request.service";
import { useTemplates } from "../../stores/templates.store";

interface RequestCreateProps {
  collectionId: string;
  onSubmit: (data: CreateRequestData) => Promise<void>;
  onCancel: () => void;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export default function RequestCreate({ collectionId, onSubmit, onCancel }: RequestCreateProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [loading, setLoading] = useState(false);
  // Headers/body só são preenchidos ao aplicar um template; o formulário não
  // os edita diretamente, mas precisam ser persistidos no create.
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");

  const templates = useTemplates();

  // Aplica um template pré-preenchendo os campos do formulário (sem enviar).
  // O nome só é sobrescrito se ainda estiver vazio.
  const applyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setUrl(tpl.url);
    setMethod(tpl.method);
    setHeaders(tpl.headers);
    setBody(tpl.body);
    if (!name.trim()) setName(tpl.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        collection_id: collectionId,
        url: url.trim(),
        method,
        headers,
        body,
      });
      setName("");
      setUrl("");
      setMethod("GET");
      setHeaders({});
      setBody("");
    } catch {
      // Erro tratado pelo componente pai
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="m-2 mb-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Nova request</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        {templates.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Template</Label>
            <Select onValueChange={applyTemplate}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Aplicar um template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Minha request"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Método</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">URL</Label>
          <Input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
            required
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            className="flex-1"
            disabled={loading || !name.trim() || !url.trim()}
          >
            {loading ? "Criando…" : "Criar"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
