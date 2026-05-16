import { useWorkspaces } from "@/hooks/useWorkspaces";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import WorkspaceForm, { type WorkspaceFormValues } from "./form";

const routeApi = getRouteApi("/panel/workspaces/$workspaceId/update");

export default function WorkspaceUpdate() {
  const { workspaceId } = routeApi.useParams();
  const { workspaces, updateWorkspace } = useWorkspaces();
  const navigate = useNavigate();

  const workspace = workspaces.find((w) => w.id === workspaceId);

  if (!workspace) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Workspace não encontrado.</div>
    );
  }

  const handleSubmit = async (values: WorkspaceFormValues) => {
    try {
      await updateWorkspace(workspace.id, values);
      toast.success("Workspace atualizado com sucesso");
      navigate({ to: "/panel/workspaces" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar workspace");
    }
  };

  return (
    <WorkspaceForm
      title="Editar workspace"
      submitLabel="Salvar"
      pendingLabel="Salvando..."
      initialValues={{
        name: workspace.name,
        description: workspace.description,
        color: workspace.color,
        icon: workspace.icon,
        pinned: workspace.pinned,
      }}
      onSubmit={handleSubmit}
    />
  );
}
