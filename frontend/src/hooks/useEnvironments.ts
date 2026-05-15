import { useEnvironmentsStore } from "@/stores/environments.store";
import { useShallow } from "zustand/react/shallow";

/**
 * Lê o estado compartilhado de environments via selectors.
 * O carregamento por collectionId acontece no `loader` da rota, não em useEffect.
 */
export function useEnvironments() {
  return useEnvironmentsStore(
    useShallow((s) => ({
      environments: s.environments,
      loading: s.loading,
      error: s.error,
      loadEnvironments: s.load,
      createEnvironment: s.create,
      deleteEnvironment: s.remove,
      updateEnvironment: s.update,
    })),
  );
}
