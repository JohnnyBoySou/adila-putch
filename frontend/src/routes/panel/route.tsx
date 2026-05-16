import { createFileRoute } from "@tanstack/react-router";
import { useEnvironmentsStore } from "@/stores/environments.store";
import { useWorkspacesStore } from "@/stores/workspaces.store";
import PanelLayout from "./-layout";

export const Route = createFileRoute("/panel")({
  // Workspaces e environments carregados no nível do painel: os switchers da
  // sidebar (workspace ativo + ambiente ativo daquele workspace) ficam
  // disponíveis em todas as páginas. Ao trocar de workspace o router invalida
  // estas rotas e os environments recarregam no escopo do novo workspace.
  loader: () =>
    Promise.all([
      useWorkspacesStore.getState().load(),
      useEnvironmentsStore.getState().load(),
    ]),
  component: PanelLayout,
});
