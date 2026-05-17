import { createFileRoute } from "@tanstack/react-router";
import RequestsView from "@/features/requests/view";
import { useCollectionsStore } from "@/stores/collections.store";
import { useEnvironmentsStore } from "@/stores/environments.store";
import { useFoldersStore } from "@/stores/folders.store";
import { useRequestsStore } from "@/stores/requests.store";

export const Route = createFileRoute("/panel/collections/$collectionId/requests/")({
  loader: ({ params }) =>
    Promise.all([
      useRequestsStore.getState().load(params.collectionId),
      // Folders + ordem manual (manifesto YAML versionável) da coleção.
      useFoldersStore.getState().load(params.collectionId),
      useEnvironmentsStore.getState().load(),
      // Coleções carregadas aqui também para o menu/diálogo de edição no header.
      useCollectionsStore.getState().load(),
    ]),
  component: RequestsView,
});
