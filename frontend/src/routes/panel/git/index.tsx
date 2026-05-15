import { createFileRoute } from "@tanstack/react-router";
import GitView from "@/features/git/view";
import { useSyncStore } from "@/stores/sync.store";

export const Route = createFileRoute("/panel/git/")({
  loader: () => useSyncStore.getState().load(),
  component: GitView,
});
