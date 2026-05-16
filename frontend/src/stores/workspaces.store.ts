import {
  type Workspace,
  type WorkspaceInput,
  WorkspacesService,
} from "@/services/workspaces.service";
import { create } from "zustand";

interface WorkspacesState {
  workspaces: Workspace[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (input: WorkspaceInput) => Promise<Workspace>;
  update: (id: string, input: WorkspaceInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setActive: (id: string) => Promise<void>;
}

function activeIdOf(list: Workspace[]): string | null {
  return list.find((w) => w.is_active)?.id ?? null;
}

export const useWorkspacesStore = create<WorkspacesState>((set, get) => ({
  workspaces: [],
  activeId: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await WorkspacesService.findAll();
      set({ workspaces: data, activeId: activeIdOf(data), loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load workspaces",
        loading: false,
      });
    }
  },

  create: async (input) => {
    set({ error: null });
    try {
      const created = await WorkspacesService.create(input);
      set((s) => ({ workspaces: [created, ...s.workspaces] }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create workspace" });
      throw err;
    }
  },

  update: async (id, input) => {
    set({ error: null });
    try {
      await WorkspacesService.update(id, input);
      // Merge otimista dos campos editáveis; updated_at/updated_author são
      // geridos pelo backend e atualizam no próximo load da rota.
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...input } : w)),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update workspace" });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await WorkspacesService.delete(id);
      await get().load();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete workspace" });
      throw err;
    }
  },

  setActive: async (id) => {
    set({ error: null });
    try {
      await WorkspacesService.setActive(id);
      set((s) => ({
        activeId: id,
        workspaces: s.workspaces.map((w) => ({ ...w, is_active: w.id === id })),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to switch workspace" });
      throw err;
    }
  },
}));
