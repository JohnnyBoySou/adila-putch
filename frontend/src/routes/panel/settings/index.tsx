import { createFileRoute } from "@tanstack/react-router";
import SettingsView from "@/features/settings/view";
import { WorkspaceService } from "@/services/workspace.service";

export const Route = createFileRoute("/panel/settings/")({
  loader: () => WorkspaceService.getPath(),
  component: SettingsView,
});
