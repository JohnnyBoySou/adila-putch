import { useCollections } from "@/hooks/useCollections";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import CollectionForm, { type CollectionFormValues } from "./form";

const routeApi = getRouteApi("/panel/collections/$collectionId/update");

export default function CollectionUpdate() {
  const { collectionId } = routeApi.useParams();
  const { collections, updateCollection } = useCollections();
  const navigate = useNavigate();

  const collection = collections.find((c) => c.id === collectionId);

  if (!collection) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Coleção não encontrada.</div>
    );
  }

  const handleSubmit = async (input: CollectionFormValues) => {
    try {
      await updateCollection(collection.id, input);
      toast.success("Coleção atualizada com sucesso");
      navigate({ to: "/panel/collections" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar coleção");
    }
  };

  return (
    <CollectionForm
      title="Editar coleção"
      submitLabel="Salvar"
      pendingLabel="Salvando..."
      initialValues={{
        name: collection.name,
        description: collection.description,
        pinned: collection.pinned,
        deprecated: collection.deprecated,
        bg: collection.bg,
      }}
      onSubmit={handleSubmit}
    />
  );
}
