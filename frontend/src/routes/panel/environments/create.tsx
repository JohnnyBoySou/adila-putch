import EnvironmentCreate from "@/features/environments/create";
import { useEnvironmentsStore } from "@/stores/environments.store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/environments/create")({
  loader: () => useEnvironmentsStore.getState().load(),
  component: EnvironmentCreate,
});
