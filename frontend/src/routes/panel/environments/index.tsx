import { createFileRoute } from "@tanstack/react-router";
import EnvironmentsView from "@/features/environments/view";
import { useEnvironmentsStore } from "@/stores/environments.store";

export const Route = createFileRoute("/panel/environments/")({
  loader: () => useEnvironmentsStore.getState().load(),
  component: EnvironmentsView,
});
