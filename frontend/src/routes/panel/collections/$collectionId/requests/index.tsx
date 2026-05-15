import { createFileRoute } from "@tanstack/react-router";
import RequestsView from "@/features/requests/view";
import { useEnvironmentsStore } from "@/stores/environments.store";
import { useRequestsStore } from "@/stores/requests.store";

export const Route = createFileRoute("/panel/collections/$collectionId/requests/")({
  loader: ({ params }) =>
    Promise.all([
      useRequestsStore.getState().load(params.collectionId),
      useEnvironmentsStore.getState().load(params.collectionId),
    ]),
  component: RequestsView,
});
