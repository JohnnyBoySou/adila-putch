import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import WorkspaceForm, { type WorkspaceFormValues } from "./form";

export default function WorkspaceCreate() {
  const { createWorkspace } = useWorkspaces();
  const navigate = useNavigate();

  const handleSubmit = async (input: WorkspaceFormValues) => {
    try {
      await createWorkspace(input);
      toast.success("Workspace criado com sucesso");
      navigate({ to: "/panel/workspaces" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar workspace");
    }
  };

  return (
    <WorkspaceForm
      title="Criar novo workspace"
      submitLabel="Criar"
      pendingLabel="Criando..."
      onSubmit={handleSubmit}
    />
  );
}
