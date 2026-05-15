import { type Environment, EnvironmentService } from "@/services/enviroments.service";
import { create } from "zustand";

interface EnvironmentsState {
  collectionId: string | null;
  environments: Environment[];
  loading: boolean;
  error: string | null;
  load: (collectionId?: string) => Promise<void>;
  create: (name: string, variables: Record<string, string>) => Promise<Environment>;
  remove: (id: string) => Promise<void>;
  update: (id: string, name: string, variables: Record<string, string>) => Promise<void>;
}

export const useEnvironmentsStore = create<EnvironmentsState>((set, get) => ({
  collectionId: null,
  environments: [],
  loading: false,
  error: null,

  load: async (collectionId) => {
    if (!collectionId) {
      set({ collectionId: null, environments: [] });
      return;
    }
    set({ collectionId, loading: true, error: null });
    try {
      const data = await EnvironmentService.findAll(collectionId);
      set({ environments: data, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load environments",
        loading: false,
      });
    }
  },

  create: async (name, variables) => {
    const { collectionId } = get();
    if (!collectionId) throw new Error("Collection ID is required");
    set({ error: null });
    try {
      const created = await EnvironmentService.create(collectionId, name, variables);
      set((s) => ({ environments: [...s.environments, created] }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create environment" });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await EnvironmentService.delete(id);
      set((s) => ({ environments: s.environments.filter((e) => e.id !== id) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete environment" });
      throw err;
    }
  },

  update: async (id, name, variables) => {
    set({ error: null });
    try {
      await EnvironmentService.update(id, name, variables);
      set((s) => ({
        environments: s.environments.map((e) =>
          e.id === id ? { ...e, name, variables } : e,
        ),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update environment" });
      throw err;
    }
  },
}));
