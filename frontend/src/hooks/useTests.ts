import { useTestsStore } from "@/stores/tests.store";
import { useShallow } from "zustand/react/shallow";

/**
 * Lê o estado compartilhado de tests via selectors.
 * O carregamento inicial acontece no `loader` da rota, não em useEffect.
 */
export function useTests() {
  return useTestsStore(
    useShallow((s) => ({
      tests: s.tests,
      loading: s.loading,
      error: s.error,
      runs: s.runs,
      running: s.running,
      loadTests: s.load,
      createTest: s.create,
      updateTest: s.update,
      deleteTest: s.remove,
      runTest: s.run,
    })),
  );
}
