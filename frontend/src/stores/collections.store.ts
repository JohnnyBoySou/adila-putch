import {
  type Collection,
  type CollectionInput,
  CollectionsService,
} from "@/services/collections.service";
import { create } from "zustand";

interface CollectionsState {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (input: CollectionInput) => Promise<Collection>;
  remove: (id: string) => Promise<void>;
  update: (id: string, input: CollectionInput) => Promise<void>;
  importFromFile: (fileContent: string) => Promise<Collection>;
}

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
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

  create: async (input) => {
    set({ error: null });
    try {
      const created = await CollectionsService.create(input);
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

  update: async (id, input) => {
    set({ error: null });
    try {
      await CollectionsService.update(id, input);
      // Merge otimista dos campos editáveis; updated_at/updated_author são
      // geridos pelo backend e atualizam no próximo load da rota.
      set((s) => ({
        collections: s.collections.map((c) => (c.id === id ? { ...c, ...input } : c)),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update collection" });
      throw err;
    }
  },

  importFromFile: async (fileContent) => {
    set({ error: null });
    try {
      const imported = await CollectionsService.import(fileContent);
      // Recarrega tudo: a importação cria também as requests, então o
      // request_count e a lista precisam vir do snapshot do backend.
      await get().load();
      return imported;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to import collection" });
      throw err;
    }
  },
}));
