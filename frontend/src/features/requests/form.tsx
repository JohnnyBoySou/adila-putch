import { Button, Column, Container, Input, Label, Row, Separator, Title } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTemplates } from "../../stores/templates.store";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

// Campos editáveis no formulário. headers/body só são preenchidos ao aplicar
// um template — o create wrapper completa collection_id/folder_id.
export interface RequestFormValues {
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

interface RequestFormProps {
  title: string;
  /** Coleção dona da request — usada no link "Voltar". */
  collectionId: string;
  initialValues?: Partial<RequestFormValues>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: RequestFormValues) => Promise<void>;
}

const EMPTY: RequestFormValues = {
  name: "",
  method: "GET",
  url: "",
  headers: {},
  body: "",
};

export default function RequestForm({
  title,
  collectionId,
  initialValues,
  submitLabel,
  pendingLabel,
  onSubmit,
}: RequestFormProps) {
  const [form, setForm] = useState<RequestFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [loading, setLoading] = useState(false);

  const templates = useTemplates();

  const invalid = !form.name.trim() || !form.url.trim();

  // Aplica um template pré-preenchendo os campos (sem enviar). O nome só é
  // sobrescrito se ainda estiver vazio.
  const applyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      url: tpl.url,
      method: tpl.method,
      headers: tpl.headers,
      body: tpl.body,
      name: f.name.trim() ? f.name : tpl.name,
    }));
  };

  const handleSubmit = async () => {
    if (invalid || loading) return;
    setLoading(true);
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        url: form.url.trim(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="p-6 space-y-6">
      <Row>
        <Title>{title}</Title>
      </Row>
      <Separator />
      <Column className="space-y-4">
        {templates.length > 0 && (
          <div className="space-y-1">
            <Label>Template</Label>
            <Select<string>
              onValueChange={(templateId) => templateId !== null && applyTemplate(templateId)}
            >
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
          <Label>Nome</Label>
          <Input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Minha request"
            required
          />
        </div>

        <div className="space-y-1">
          <Label>Método</Label>
          <Select
            value={form.method}
            onValueChange={(v) => v !== null && setForm({ ...form, method: v })}
          >
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
          <Label>URL</Label>
          <Input
            id="url"
            type="text"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://api.example.com/endpoint"
            required
          />
        </div>
      </Column>

      <Row className="gap-2">
        <Button
          variant="ghost"
          className="w-full"
          type="link"
          to="/panel/collections/$collectionId/requests"
          params={{ collectionId }}
        >
          Voltar
        </Button>
        <Button className="w-full" onClick={handleSubmit} disabled={loading || invalid}>
          {loading ? pendingLabel : submitLabel}
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        </Button>
      </Row>
    </Container>
  );
}
