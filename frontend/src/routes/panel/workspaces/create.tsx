import WorkspaceCreate from "@/features/workspaces/create";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/workspaces/create")({
  component: WorkspaceCreate,
});
