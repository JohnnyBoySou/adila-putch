import { type Test, type TestInput, type TestRunResult, TestService } from "@/services/tests.service";
import { create } from "zustand";

interface TestsState {
  tests: Test[];
  loading: boolean;
  error: string | null;
  // Resultado da última execução, por id de teste.
  runs: Record<string, TestRunResult>;
  running: Record<string, boolean>;
  load: () => Promise<void>;
  create: (input: TestInput) => Promise<Test>;
  update: (id: string, input: TestInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  run: (id: string) => Promise<TestRunResult>;
}

export const useTestsStore = create<TestsState>((set) => ({
  tests: [],
  loading: false,
  error: null,
  runs: {},
  running: {},

  load: async () => {
    set({ loading: true, error: null });
    try {
      const data = await TestService.findAll();
      set({ tests: data, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load tests",
        loading: false,
      });
    }
  },

  create: async (input) => {
    set({ error: null });
    try {
      const created = await TestService.create(input);
      set((s) => ({ tests: [created, ...s.tests] }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create test" });
      throw err;
    }
  },

  update: async (id, input) => {
    set({ error: null });
    try {
      await TestService.update(id, input);
      set((s) => ({
        tests: s.tests.map((t) => (t.id === id ? { ...t, ...input } : t)),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update test" });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await TestService.delete(id);
      set((s) => ({ tests: s.tests.filter((t) => t.id !== id) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete test" });
      throw err;
    }
  },

  run: async (id) => {
    set((s) => ({ running: { ...s.running, [id]: true }, error: null }));
    try {
      const result = await TestService.run(id);
      set((s) => ({
        runs: { ...s.runs, [id]: result },
        running: { ...s.running, [id]: false },
      }));
      return result;
    } catch (err) {
      set((s) => ({
        running: { ...s.running, [id]: false },
        error: err instanceof Error ? err.message : "Failed to run test",
      }));
      throw err;
    }
  },
}));

