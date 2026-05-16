import { createFileRoute } from "@tanstack/react-router";
import WorkspacesView from "@/features/workspaces/view";
import { useWorkspacesStore } from "@/stores/workspaces.store";

export const Route = createFileRoute("/panel/workspaces/")({
  loader: () => useWorkspacesStore.getState().load(),
  component: WorkspacesView,
});
