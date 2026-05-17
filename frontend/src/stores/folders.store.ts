import { type Folder, FolderService } from "@/services/folders.service";
import { useRequestsStore } from "@/stores/requests.store";
import { create } from "zustand";

/**
 * Ordem manual por container. Chave "" = raiz da coleção; demais chaves são
 * folderIds. Cada valor é a lista ordenada de ids filhos (folders + requests
 * misturados). Espelha o manifesto .putch-order.yml versionável do backend.
 */
type OrderMap = Record<string, string[]>;

interface FoldersState {
  collectionId: string | null;
  folders: Folder[];
  orders: OrderMap;
  loading: boolean;
  error: string | null;
  load: (collectionId?: string) => Promise<void>;
  createFolder: (parentId: string, name: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  moveFolder: (id: string, newParentId: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  setOrder: (folderId: string, ids: string[]) => Promise<void>;
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  collectionId: null,
  folders: [],
  orders: {},
  loading: false,
  error: null,

  load: async (collectionId) => {
    if (!collectionId) {
      set({ collectionId: null, folders: [], orders: {} });
      return;
    }
    set({ collectionId, loading: true, error: null });
    try {
      const [folders, ordersRaw] = await Promise.all([
        FolderService.findByCollectionId(collectionId),
        // GetOrders devolve map[folderId][]ids ("" = raiz). O binding tipa os
        // valores como string[] | undefined (map do Go) — normalizamos.
        FolderService.getOrders(collectionId).catch(
          () => ({}) as Record<string, string[] | undefined>,
        ),
      ]);
      const orders: OrderMap = {};
      for (const [k, v] of Object.entries(ordersRaw ?? {})) {
        // O binding tipa os valores como `string[] | undefined` (map do Go);
        // Array.isArray estreita p/ array e descarta chaves sem ordem.
        if (Array.isArray(v)) orders[k] = v;
      }
      set({ folders, orders, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load folders",
        loading: false,
      });
    }
  },

  createFolder: async (parentId, name) => {
    const collectionId = get().collectionId;
    if (!collectionId) throw new Error("Sem coleção ativa");
    set({ error: null });
    try {
      const created = await FolderService.create(collectionId, parentId, name);
      set((s) => ({ folders: [...s.folders, created] }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create folder" });
      throw err;
    }
  },

  renameFolder: async (id, name) => {
    set({ error: null });
    try {
      await FolderService.update(id, name);
      set((s) => ({
        folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to rename folder" });
      throw err;
    }
  },

  moveFolder: async (id, newParentId) => {
    const collectionId = get().collectionId;
    set({ error: null });
    try {
      await FolderService.move(id, newParentId);
      // ParentID é derivado do scan do backend (a hierarquia é o caminho no
      // disco) — não dá pra atualizar otimista de forma confiável; recarrega
      // folders + ordens. As requests acompanham a pasta fisicamente, mas
      // seu folder_id não muda, então o requestsStore não precisa recarregar.
      await get().load(collectionId ?? undefined);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to move folder" });
      throw err;
    }
  },

  deleteFolder: async (id) => {
    const collectionId = get().collectionId;
    set({ error: null });
    try {
      await FolderService.delete(id);
      // Delete é recursivo no backend (subfolders + requests). Em vez de
      // recalcular descendentes na mão, recarrega folders+orders e as
      // requests (que vivem no requestsStore e podem ter sumido).
      await Promise.all([
        get().load(collectionId ?? undefined),
        useRequestsStore.getState().load(collectionId ?? undefined),
      ]);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete folder" });
      throw err;
    }
  },

  setOrder: async (folderId, ids) => {
    const collectionId = get().collectionId;
    if (!collectionId) return;
    const prev = get().orders;
    // Otimista: a UI reflete a nova ordem imediatamente.
    set({ orders: { ...prev, [folderId]: ids } });
    try {
      await FolderService.setOrder(collectionId, folderId, ids);
    } catch (err) {
      // Reverte em caso de falha de persistência.
      set({ orders: prev, error: err instanceof Error ? err.message : "Failed to save order" });
      throw err;
    }
  },
}));
