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
  remove: (id: string) => Promise<void>;
  update: (id: string, data: Partial<Request>) => Promise<void>;
}

export const useRequestsStore = create<RequestsState>((set) => ({
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
    try {
      await RequestService.update(id, data);
      set((s) => ({
        requests: s.requests.map((r) => (r.id === id ? { ...r, ...data } : r)),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update request" });
      throw err;
    }
  },
}));
