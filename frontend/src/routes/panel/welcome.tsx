import WelcomeView from "@/features/welcome/view";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/panel/welcome")({
  component: WelcomeView,
});
