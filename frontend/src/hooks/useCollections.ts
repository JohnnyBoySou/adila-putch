import { useCollectionsStore } from "@/stores/collections.store";
import { useShallow } from "zustand/react/shallow";

/**
 * Lê o estado compartilhado de collections via selectors.
 * O carregamento inicial acontece no `loader` da rota, não em useEffect.
 */
export function useCollections() {
  return useCollectionsStore(
    useShallow((s) => ({
      collections: s.collections,
      loading: s.loading,
      error: s.error,
      loadCollections: s.load,
      createCollection: s.create,
      deleteCollection: s.remove,
      updateCollection: s.update,
    })),
  );
}
