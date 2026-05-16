import CollectionCreate from "@/features/collections/create";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/collections/create")({
  component: CollectionCreate,
});
