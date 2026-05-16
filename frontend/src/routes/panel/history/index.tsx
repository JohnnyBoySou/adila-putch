import HistoryView from "@/features/history/view";
import { createFileRoute } from "@tanstack/react-router";

// Dados do histórico vivem na store client-side (localStorage) — sem loader.
export const Route = createFileRoute("/panel/history/")({
  component: HistoryView,
});
