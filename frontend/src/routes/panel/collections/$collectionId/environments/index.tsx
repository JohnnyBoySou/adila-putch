import { createFileRoute } from "@tanstack/react-router";
import EnvironmentsView from "@/features/environments/view";
import { useEnvironmentsStore } from "@/stores/environments.store";

export const Route = createFileRoute("/panel/collections/$collectionId/environments/")({
  loader: ({ params }) => useEnvironmentsStore.getState().load(params.collectionId),
  component: EnvironmentsView,
});
