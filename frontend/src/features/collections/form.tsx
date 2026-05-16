import Folder from "@/components/functional/folder";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Container,
  Input,
  Label,
  Switch,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CollectionInput } from "@/services/collections.service";
import { ChevronLeftIcon, Loader2 } from "lucide-react";
import { useState } from "react";

// Quantidade de fundos disponíveis (folder-bg-1..6 em src/assets).
const BG_OPTIONS = [0, 1, 2, 3, 4, 5];

export type CollectionFormValues = CollectionInput;

interface CollectionFormProps {
  title: string;
  /** Valores iniciais — preenchidos na edição, vazios na criação. */
  initialValues?: Partial<CollectionFormValues>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (input: CollectionFormValues) => Promise<void>;
}

const EMPTY: CollectionFormValues = {
  name: "",
  description: "",
  pinned: false,
  deprecated: false,
  bg: 0,
};

export default function CollectionForm({
  title,
  initialValues,
  submitLabel,
  pendingLabel,
  onSubmit,
}: CollectionFormProps) {
  const [form, setForm] = useState<CollectionFormValues>({
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
    <Container className="p-6">
      <Button size="icon" variant="ghost" type="link" to="/panel/collections" aria-label="Voltar">
        <ChevronLeftIcon className="w-4 h-4" />
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Coleção de APIs"
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Para que serve esta coleção (opcional)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Fundo</Label>
            <div className="flex flex-wrap gap-3">
              {BG_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-label={`Fundo ${opt + 1}`}
                  aria-pressed={form.bg === opt}
                  onClick={() => setForm({ ...form, bg: opt })}
                  className={cn(
                    "relative h-22 w-22 overflow-hidden rounded-md border-2 transition-colors",
                    form.bg === opt
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground/40",
                  )}
                >
                  <Folder
                    option={opt}
                    className="absolute top-0 left-0 origin-top-left scale-50"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Fixar no topo</Label>
              <p className="text-xs text-muted-foreground">
                Coleções fixadas aparecem antes das demais.
              </p>
            </div>
            <Switch
              checked={form.pinned}
              onCheckedChange={(v) => setForm({ ...form, pinned: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Marcar como obsoleta</Label>
              <p className="text-xs text-muted-foreground">
                Sinaliza que a coleção não deve mais ser usada.
              </p>
            </div>
            <Switch
              checked={form.deprecated}
              onCheckedChange={(v) => setForm({ ...form, deprecated: v })}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={loading || !form.name.trim()}>
            {loading ? pendingLabel : submitLabel}
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          </Button>
        </CardFooter>
      </Card>
    </Container>
  );
}
