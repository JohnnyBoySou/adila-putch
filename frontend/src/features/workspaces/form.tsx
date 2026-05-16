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
import { cn } from "@/lib/utils";
import type { WorkspaceInput } from "@/services/workspaces.service";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const COLOR_OPTIONS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#64748b"];

const ICON_OPTIONS = ["📦", "🚀", "🧪", "🔧", "🌐", "💼", "⭐", "🐞"];

export type WorkspaceFormValues = WorkspaceInput;

interface WorkspaceFormProps {
  title: string;
  initialValues?: Partial<WorkspaceFormValues>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (input: WorkspaceFormValues) => Promise<void>;
}

const EMPTY: WorkspaceFormValues = {
  name: "",
  description: "",
  color: "",
  icon: "",
  pinned: false,
};

export default function WorkspaceForm({
  title,
  initialValues,
  submitLabel,
  pendingLabel,
  onSubmit,
}: WorkspaceFormProps) {
  const [form, setForm] = useState<WorkspaceFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
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
            placeholder="Meu workspace"
            required
          />
        </div>

        <div className="space-y-1">
          <Label>Descrição</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Para que serve este workspace (opcional)"
            rows={3}
          />
        </div>

        <Row className="space-y-2 items-center justify-between">
          <Label>Cor</Label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-label="Sem cor"
              aria-pressed={form.color === ""}
              onClick={() => setForm({ ...form, color: "" })}
              className={cn(
                "h-8 w-8 rounded-full border-2 bg-muted text-xs text-muted-foreground transition-colors",
                form.color === ""
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/40",
              )}
            >
              ✕
            </button>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                aria-pressed={form.color === c}
                onClick={() => setForm({ ...form, color: c })}
                style={{ backgroundColor: c }}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                  form.color === c ? "border-primary" : "border-transparent",
                )}
              />
            ))}
          </div>
        </Row>

        <Row className="space-y-2 items-center justify-between">
          <Label>Ícone</Label>
          <div className="flex flex-wrap items-center gap-2">
            {ICON_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Ícone ${emoji}`}
                aria-pressed={form.icon === emoji}
                onClick={() => setForm({ ...form, icon: emoji })}
                className={cn(
                  "h-9 w-9 rounded-md border-2 text-lg transition-colors",
                  form.icon === emoji
                    ? "border-primary"
                    : "border-transparent hover:border-muted-foreground/40",
                )}
              >
                {emoji}
              </button>
            ))}
            <Input
              aria-label="Ícone personalizado"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="ou cole um emoji"
              className="w-40"
            />
          </div>
        </Row>

        <Row className="flex items-center justify-between">
          <Label>Fixar no topo</Label>
          <Switch checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: v })} />
        </Row>
      </Column>

      <Row className="gap-2">
        <Button variant="ghost" className="w-full" type="link" to="/panel/workspaces">
          Voltar
        </Button>
        <Button className="w-full" onClick={handleSubmit} disabled={loading || !form.name.trim()}>
          {loading ? pendingLabel : submitLabel}
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        </Button>
      </Row>
    </Container>
  );
}
