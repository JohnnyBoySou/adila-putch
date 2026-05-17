import { useFoldersStore } from "@/stores/folders.store";
import { useShallow } from "zustand/react/shallow";

/**
 * Lê o estado compartilhado de folders + ordem manual via selectors.
 * O carregamento por collectionId acontece no `loader` da rota, não em
 * useEffect (mesmo padrão de useRequests/useCollections).
 */
export function useFolders() {
  return useFoldersStore(
    useShallow((s) => ({
      folders: s.folders,
      orders: s.orders,
      loading: s.loading,
      error: s.error,
      loadFolders: s.load,
      createFolder: s.createFolder,
      renameFolder: s.renameFolder,
      moveFolder: s.moveFolder,
      deleteFolder: s.deleteFolder,
      setOrder: s.setOrder,
    })),
  );
}
