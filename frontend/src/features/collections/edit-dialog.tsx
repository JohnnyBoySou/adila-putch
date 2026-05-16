import Folder from "@/components/functional/folder";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Textarea,
} from "@/components/ui";
import { useCollections } from "@/hooks/useCollections";
import { cn } from "@/lib/utils";
import type { Collection, CollectionInput } from "@/services/collections.service";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Mesmos fundos do CollectionForm (folder-bg-1..6 em src/assets).
const BG_OPTIONS = [0, 1, 2, 3, 4, 5];

interface CollectionEditDialogProps {
  collection: Collection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CollectionEditDialog({
  collection,
  open,
  onOpenChange,
}: CollectionEditDialogProps) {
  const { updateCollection } = useCollections();
  const [form, setForm] = useState<CollectionInput>({
    name: collection.name,
    description: collection.description,
    pinned: collection.pinned,
    deprecated: collection.deprecated,
    bg: collection.bg,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) return;
    setLoading(true);
    try {
      await updateCollection(collection.id, { ...form, name });
      toast.success("Coleção atualizada com sucesso");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar coleção");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar coleção</DialogTitle>
          <DialogDescription>
            Altere o nome e outras propriedades desta coleção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Coleção de APIs"
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !form.name.trim()}>
            {loading ? "Salvando..." : "Salvar"}
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
