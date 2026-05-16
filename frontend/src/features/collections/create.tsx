import { useCollectionsStore } from "@/stores/collections.store";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import CollectionForm, { type CollectionFormValues } from "./form";

export default function CollectionCreate() {
  const { create } = useCollectionsStore();
  const navigate = useNavigate();

  const handleSubmit = async (input: CollectionFormValues) => {
    try {
      const collection = await create(input);
      toast.success("Coleção criada com sucesso");
      navigate({
        to: "/panel/collections/$collectionId/requests",
        params: { collectionId: collection.id },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar coleção");
    }
  };

  return (
    <CollectionForm
      title="Criar nova coleção"
      submitLabel="Criar"
      pendingLabel="Criando..."
      onSubmit={handleSubmit}
    />
  );
}
