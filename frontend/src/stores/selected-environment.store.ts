import { create } from "zustand";

const STORAGE_PREFIX = "selectedEnvironment_";

function loadInitial(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) out[key.slice(STORAGE_PREFIX.length)] = value;
    }
  }
  return out;
}

interface SelectedEnvironmentState {
  // Environments são de workspace; a seleção ativa é por workspace.
  byWorkspace: Record<string, string>;
  setSelectedEnvironmentId: (id: string | null, workspaceId: string) => void;
}

export const useSelectedEnvironmentStore = create<SelectedEnvironmentState>((set) => ({
  byWorkspace: loadInitial(),

  setSelectedEnvironmentId: (id, workspaceId) => {
    if (id) {
      localStorage.setItem(`${STORAGE_PREFIX}${workspaceId}`, id);
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${workspaceId}`);
    }
    set((s) => {
      const next = { ...s.byWorkspace };
      if (id) {
        next[workspaceId] = id;
      } else {
        delete next[workspaceId];
      }
      return { byWorkspace: next };
    });
  },
}));

/** Reactive selector: re-renders only when this workspace's selection changes. */
export function useSelectedEnvironmentId(workspaceId: string | undefined): string | null {
  return useSelectedEnvironmentStore((s) =>
    workspaceId ? (s.byWorkspace[workspaceId] ?? null) : null,
  );
}

export function useSetSelectedEnvironmentId() {
  return useSelectedEnvironmentStore((s) => s.setSelectedEnvironmentId);
}
