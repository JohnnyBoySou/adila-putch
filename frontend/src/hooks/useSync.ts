import { useSyncStore } from "@/stores/sync.store";
import { useShallow } from "zustand/react/shallow";

/**
 * Lê o estado de sincronização git/GitHub via selectors.
 * O carregamento inicial acontece no `loader` da rota, não em useEffect.
 */
export function useSync() {
  return useSyncStore(
    useShallow((s) => ({
      account: s.account,
      status: s.status,
      device: s.device,
      repos: s.repos,
      lastPull: s.lastPull,
      loading: s.loading,
      busy: s.busy,
      error: s.error,

      load: s.load,
      refreshStatus: s.refreshStatus,

      startLogin: s.startLogin,
      cancelLogin: s.cancelLogin,
      logout: s.logout,
      loadRepos: s.loadRepos,

      commit: s.commit,
      push: s.push,
      pull: s.pull,
      resolve: s.resolve,

      connect: s.connect,
      clone: s.clone,
    })),
  );
}
