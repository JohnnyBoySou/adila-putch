import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  // Pré-carrega o loader da rota ao passar o mouse/foco sobre um <Link>,
  // tornando o clique instantâneo (dados já hidratados na store).
  defaultPreload: "intent",
  // Dados ficam "frescos" por 30s: revisitar uma rota dentro da janela
  // não re-executa o loader (sem round-trip IPC com o Go nem re-render).
  defaultStaleTime: 30_000,
  // Cache de loader preservado por 5min mesmo sem rota montada.
  defaultGcTime: 5 * 60_000,
  // Não re-disparar o loader só por hover se os dados ainda estão frescos.
  defaultPreloadStaleTime: 30_000,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
