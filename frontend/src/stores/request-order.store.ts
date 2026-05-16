import { create } from "zustand";

// Ordem manual das requests por coleção. O modelo `Request` do backend não tem
// campo de ordem/posição persistível (só id, name, collection_id, folder_id,
// url, method, headers, body, created_at, updated_at, is_favorite, is_active),
// então a ordem escolhida por drag-and-drop vive apenas no client.
//
// Persistência manual em localStorage, no mesmo estilo das outras stores
// (`selected-environment.store.ts`, `history.store.ts`) — sem middleware
// persist. A ordem é guardada por coleção: para cada `collectionId`, um array
// de ids de request na ordem desejada.
const STORAGE_KEY = "requestOrder";

type OrderMap = Record<string, string[]>;

function loadInitial(): OrderMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Aceita só objetos simples; qualquer outra coisa cai no default vazio.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as OrderMap;
    }
    return {};
  } catch {
    return {};
  }
}

function persist(map: OrderMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage cheio/indisponível — ignora silenciosamente
  }
}

interface RequestOrderState {
  byCollection: OrderMap;
  setOrder: (collectionId: string, ids: string[]) => void;
}

export const useRequestOrderStore = create<RequestOrderState>((set) => ({
  byCollection: loadInitial(),

  setOrder: (collectionId, ids) => {
    if (!collectionId) return;
    set((s) => {
      const next = { ...s.byCollection, [collectionId]: ids };
      persist(next);
      return { byCollection: next };
    });
  },
}));

// Referência estável para coleção sem ordem salva — evita devolver um array
// novo a cada render (o que dispararia re-render no selector reativo).
const EMPTY_ORDER: readonly string[] = [];

/**
 * Selector reativo: ordem de ids persistida para uma coleção. Re-renderiza
 * apenas quando a ordem desta coleção muda. Retorna array vazio (referência
 * estável) quando não há ordem salva.
 */
export function useRequestOrder(collectionId: string | undefined): readonly string[] {
  return useRequestOrderStore((s) =>
    collectionId ? (s.byCollection[collectionId] ?? EMPTY_ORDER) : EMPTY_ORDER,
  );
}

export function useSetRequestOrder() {
  return useRequestOrderStore((s) => s.setOrder);
}
