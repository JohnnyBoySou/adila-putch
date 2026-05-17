import { useRequestsStore } from "@/stores/requests.store";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import RequestForm, { type RequestFormValues } from "./form";

export default function RequestCreate({ collectionId }: { collectionId: string }) {
  const create = useRequestsStore((s) => s.create);
  const navigate = useNavigate();

  const handleSubmit = async (values: RequestFormValues) => {
    try {
      await create({ ...values, collection_id: collectionId, folder_id: "" });
      toast.success("Request criada com sucesso");
      navigate({
        to: "/panel/collections/$collectionId/requests",
        params: { collectionId },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar request");
    }
  };

  return (
    <RequestForm
      title="Criar nova request"
      collectionId={collectionId}
      submitLabel="Criar"
      pendingLabel="Criando..."
      onSubmit={handleSubmit}
    />
  );
}
