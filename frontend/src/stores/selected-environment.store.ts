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
  byCollection: Record<string, string>;
  setSelectedEnvironmentId: (id: string | null, collectionId: string) => void;
}

export const useSelectedEnvironmentStore = create<SelectedEnvironmentState>((set) => ({
  byCollection: loadInitial(),

  setSelectedEnvironmentId: (id, collectionId) => {
    if (id) {
      localStorage.setItem(`${STORAGE_PREFIX}${collectionId}`, id);
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${collectionId}`);
    }
    set((s) => {
      const next = { ...s.byCollection };
      if (id) {
        next[collectionId] = id;
      } else {
        delete next[collectionId];
      }
      return { byCollection: next };
    });
  },
}));

/** Reactive selector: re-renders only when this collection's selection changes. */
export function useSelectedEnvironmentId(collectionId: string | undefined): string | null {
  return useSelectedEnvironmentStore((s) =>
    collectionId ? (s.byCollection[collectionId] ?? null) : null,
  );
}

export function useSetSelectedEnvironmentId() {
  return useSelectedEnvironmentStore((s) => s.setSelectedEnvironmentId);
}
