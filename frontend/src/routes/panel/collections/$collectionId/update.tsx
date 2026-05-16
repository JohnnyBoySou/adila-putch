import CollectionUpdate from "@/features/collections/update";
import { useCollectionsStore } from "@/stores/collections.store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/collections/$collectionId/update")({
  loader: () => useCollectionsStore.getState().load(),
  component: CollectionUpdate,
});
