import { createFileRoute } from "@tanstack/react-router";
import CollectionsView from "@/features/collections/view";
import { useCollectionsStore } from "@/stores/collections.store";

export const Route = createFileRoute("/panel/collections/")({
  loader: () => useCollectionsStore.getState().load(),
  component: CollectionsView,
});
