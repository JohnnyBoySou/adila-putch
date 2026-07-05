import {
  type Environment,
  type EnvironmentInput,
  EnvironmentService,
} from "@/services/environments.service";
import { create } from "zustand";

interface EnvironmentsState {
  environments: Environment[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (input: EnvironmentInput) => Promise<Environment>;
  remove: (id: string) => Promise<void>;
  update: (id: string, input: EnvironmentInput) => Promise<void>;
}

export const useEnvironmentsStore = create<EnvironmentsState>((set) => ({
  environments: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await EnvironmentService.findAll();
      set({ environments: data, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load environments",
        loading: false,
      });
    }
  },

  create: async (input) => {
    set({ error: null });
    try {
      const created = await EnvironmentService.create(input);
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

  update: async (id, input) => {
    set({ error: null });
    try {
      await EnvironmentService.update(id, input);
      // Merge otimista dos campos editáveis; updated_at é gerido pelo backend
      // e atualiza no próximo load da rota.
      set((s) => ({
        environments: s.environments.map((e) =>
          e.id === id ? { ...e, ...input } : e,
        ),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update environment" });
      throw err;
    }
  },
}));
