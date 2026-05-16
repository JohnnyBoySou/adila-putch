import { CollectionsService } from "@/services/collections.service";
import {
  type CreateRequestData,
  type Request,
  RequestService,
} from "@/services/request.service";
import { create } from "zustand";

interface RequestsState {
  collectionId: string | null;
  collectionName: string;
  requests: Request[];
  loading: boolean;
  error: string | null;
  load: (collectionId?: string) => Promise<void>;
  create: (data: CreateRequestData) => Promise<Request>;
  duplicate: (id: string) => Promise<Request>;
  remove: (id: string) => Promise<void>;
  update: (id: string, data: Partial<Request>) => Promise<void>;
}

export const useRequestsStore = create<RequestsState>((set, get) => ({
  collectionId: null,
  collectionName: "",
  requests: [],
  loading: false,
  error: null,

  load: async (collectionId) => {
    if (!collectionId) {
      set({ collectionId: null, requests: [], collectionName: "" });
      return;
    }
    set({ collectionId, loading: true, error: null });
    try {
      const [requests, collection] = await Promise.all([
        RequestService.findByCollectionId(collectionId),
        CollectionsService.findById(collectionId).catch(() => null),
      ]);
      set({
        requests,
        collectionName: collection?.name ?? "Unknown Collection",
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load requests",
        loading: false,
      });
    }
  },

  create: async (data) => {
    set({ error: null });
    try {
      const created = await RequestService.create(data);
      set((s) => ({ requests: [...s.requests, created] }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create request" });
      throw err;
    }
  },

  duplicate: async (id) => {
    set({ error: null });
    // RequestService.duplicate faz FindByID + Create no backend (clona todos os
    // campos com o nome sufixado " (cópia)"). Aqui só anexamos o resultado.
    try {
      const copy = await RequestService.duplicate(id);
      set((s) => ({ requests: [...s.requests, copy] }));
      return copy;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to duplicate request" });
      throw err;
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await RequestService.delete(id);
      set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete request" });
      throw err;
    }
  },

  update: async (id, data) => {
    set({ error: null });
    // store.UpdateRequest (Go) faz REPLACE TOTAL do registro (só preserva
    // id/collection/created_at/is_active/is_favorite). Por isso mandamos a
    // request completa mesclada com o patch — passar só o patch zeraria todos
    // os campos não editados no YAML (name/url/headers/body/...).
    const current = get().requests.find((r) => r.id === id);
    const merged: Partial<Request> = current ? { ...current, ...data } : data;
    try {
      await RequestService.update(id, merged);
      set((s) => ({
        requests: s.requests.map((r) => (r.id === id ? { ...r, ...data } : r)),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update request" });
      throw err;
    }
  },
}));
