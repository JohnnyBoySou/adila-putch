import {
  Button,
  Column,
  Container,
  Input,
  Label,
  Row,
  Separator,
  Switch,
  Textarea,
  Title,
} from "@/components/ui";
import { strMap } from "@/lib/utils";
import type { EnvironmentInput } from "@/services/environments.service";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import VariablesEditor from "./variables-editor";

export type EnvironmentFormValues = EnvironmentInput;

interface EnvironmentFormProps {
  title: string;
  /** Valores iniciais — preenchidos na edição, vazios na criação. */
  initialValues?: Partial<EnvironmentFormValues>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: EnvironmentFormValues) => Promise<void>;
}

const EMPTY: EnvironmentFormValues = {
  name: "",
  description: "",
  pinned: false,
  deprecated: false,
  variables: {},
};

export default function EnvironmentForm({
  title,
  initialValues,
  submitLabel,
  pendingLabel,
  onSubmit,
}: EnvironmentFormProps) {
  const [form, setForm] = useState<EnvironmentFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [loading, setLoading] = useState(false);

  const nameInvalid = !form.name.trim();

  const handleSubmit = async () => {
    if (nameInvalid || loading) return;
    setLoading(true);
    try {
      await onSubmit({ ...form, name: form.name.trim() });
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
        <div className="space-y-1">
          <Label>Nome</Label>
          <Input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Produção, Desenvolvimento, etc."
            aria-invalid={nameInvalid}
            required
          />
        </div>

        <div className="space-y-1">
          <Label>Descrição</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Para que serve este ambiente (opcional)"
            rows={3}
          />
        </div>

        <div className="rounded-lg border border-border p-4">
          <VariablesEditor
            variables={strMap(form.variables)}
            onChange={(variables) => setForm({ ...form, variables })}
          />
        </div>

        <Row className="flex items-center justify-between">
          <Label>Fixar no topo</Label>
          <Switch
            checked={form.pinned}
            onCheckedChange={(v) => setForm({ ...form, pinned: v })}
          />
        </Row>

        <Row className="flex items-center justify-between">
          <Label>Marcar como obsoleto</Label>
          <Switch
            checked={form.deprecated}
            onCheckedChange={(v) => setForm({ ...form, deprecated: v })}
          />
        </Row>
      </Column>

      <Row className="gap-2">
        <Button variant="ghost" className="w-full" type="link" to="/panel/environments">
          Voltar
        </Button>
        <Button className="w-full" onClick={handleSubmit} disabled={loading || nameInvalid}>
          {loading ? pendingLabel : submitLabel}
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        </Button>
      </Row>
    </Container>
  );
}
