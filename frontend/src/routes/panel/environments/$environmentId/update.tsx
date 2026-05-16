import EnvironmentUpdate from "@/features/environments/update";
import { useEnvironmentsStore } from "@/stores/environments.store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/environments/$environmentId/update")({
  loader: () => useEnvironmentsStore.getState().load(),
  component: EnvironmentUpdate,
});
