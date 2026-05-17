import { useEnvironmentsStore } from "@/stores/environments.store";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import EnvironmentForm, { type EnvironmentFormValues } from "./form";

export default function EnvironmentCreate() {
  const { create } = useEnvironmentsStore();
  const navigate = useNavigate();

  const handleSubmit = async (values: EnvironmentFormValues) => {
    try {
      await create(values);
      toast.success("Ambiente criado com sucesso");
      navigate({ to: "/panel/environments" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar ambiente");
    }
  };

  return (
    <EnvironmentForm
      title="Criar novo ambiente"
      submitLabel="Criar"
      pendingLabel="Criando..."
      onSubmit={handleSubmit}
    />
  );
}
