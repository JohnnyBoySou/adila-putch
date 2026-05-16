import { useWorkspacesStore } from "@/stores/workspaces.store";
import { useShallow } from "zustand/react/shallow";

/**
 * Lê o estado compartilhado de workspaces via selectors.
 * O carregamento inicial acontece no `loader` da rota /panel, não em useEffect.
 */
export function useWorkspaces() {
  return useWorkspacesStore(
    useShallow((s) => ({
      workspaces: s.workspaces,
      activeId: s.activeId,
      loading: s.loading,
      error: s.error,
      loadWorkspaces: s.load,
      createWorkspace: s.create,
      updateWorkspace: s.update,
      deleteWorkspace: s.remove,
      setActiveWorkspace: s.setActive,
    })),
  );
}
