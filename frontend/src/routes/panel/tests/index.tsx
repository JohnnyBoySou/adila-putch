import { createFileRoute } from "@tanstack/react-router";
import TestsView from "@/features/tests/view";
import { useRequestsIndexStore } from "@/stores/requests-index.store";
import { useTestsStore } from "@/stores/tests.store";

export const Route = createFileRoute("/panel/tests/")({
  loader: () =>
    Promise.all([
      useTestsStore.getState().load(),
      useRequestsIndexStore.getState().load(),
    ]),
  component: TestsView,
});
