import { type Collection, CollectionsService } from "@/services/collections.service";
import { create } from "zustand";

interface CollectionsState {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (name: string) => Promise<Collection>;
  remove: (id: string) => Promise<void>;
  update: (id: string, name: string) => Promise<void>;
}

export const useCollectionsStore = create<CollectionsState>((set) => ({
  collections: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await CollectionsService.findAll();
      set({ collections: data, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load collections",
        loading: false,
      });
    }
  },

  create: async (name) => {
    set({ error: null });
    try {
      const created = await CollectionsService.create(name);
      set((s) => ({ collections: [...s.collections, created] }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create collection" });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await CollectionsService.delete(id);
      set((s) => ({ collections: s.collections.filter((c) => c.id !== id) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete collection" });
      throw err;
    }
  },

  update: async (id, name) => {
    set({ error: null });
    try {
      await CollectionsService.update(id, name);
      set((s) => ({
        collections: s.collections.map((c) => (c.id === id ? { ...c, name } : c)),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update collection" });
      throw err;
    }
  },
}));
