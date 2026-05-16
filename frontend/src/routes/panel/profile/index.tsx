import { createFileRoute } from "@tanstack/react-router";
import ProfileView from "@/features/profile/view";

export const Route = createFileRoute("/panel/profile/")({
  component: ProfileView,
});
