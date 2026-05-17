import { useEnvironments } from "@/hooks/useEnvironments";
import { strMap } from "@/lib/utils";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import EnvironmentForm, { type EnvironmentFormValues } from "./form";

const routeApi = getRouteApi("/panel/environments/$environmentId/update");

export default function EnvironmentUpdate() {
  const { environmentId } = routeApi.useParams();
  const { environments, updateEnvironment } = useEnvironments();
  const navigate = useNavigate();

  const environment = environments.find((e) => e.id === environmentId);

  if (!environment) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Ambiente não encontrado.</div>
    );
  }

  const handleSubmit = async (values: EnvironmentFormValues) => {
    try {
      await updateEnvironment(environment.id, values);
      toast.success("Ambiente atualizado com sucesso");
      navigate({ to: "/panel/environments" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar ambiente");
    }
  };

  return (
    <EnvironmentForm
      title="Editar ambiente"
      submitLabel="Salvar"
      pendingLabel="Salvando..."
      initialValues={{
        name: environment.name,
        description: environment.description,
        pinned: environment.pinned,
        deprecated: environment.deprecated,
        variables: strMap(environment.variables),
      }}
      onSubmit={handleSubmit}
    />
  );
}
