import WorkspaceUpdate from "@/features/workspaces/update";
import { useWorkspacesStore } from "@/stores/workspaces.store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/workspaces/$workspaceId/update")({
  loader: () => useWorkspacesStore.getState().load(),
  component: WorkspaceUpdate,
});
