import { createFileRoute } from "@tanstack/react-router";
import PanelLayout from "./-layout";

export const Route = createFileRoute("/panel")({
  component: PanelLayout,
});
