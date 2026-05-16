import { type Request, RequestService } from "@/services/request.service";
import { create } from "zustand";

/**
 * Lista achatada de todas as requests do workspace ativo. Usada por seletores
 * (ex.: montar os passos de um Test), não confundir com `requests.store`, que
 * é escopado a uma collection. Carregada via loader de rota.
 */
interface RequestsIndexState {
  requests: Request[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export const useRequestsIndexStore = create<RequestsIndexState>((set) => ({
  requests: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const requests = await RequestService.findAll();
      set({ requests, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load requests",
        loading: false,
      });
    }
  },
}));
