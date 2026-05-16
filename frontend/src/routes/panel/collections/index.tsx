import CollectionsView from "@/features/collections/view";
import { useCollectionsStore } from "@/stores/collections.store";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/collections/")({
  loader: () => useCollectionsStore.getState().load(),
  component: CollectionsView,
});
