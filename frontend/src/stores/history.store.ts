import type { RequestConfig, ResponseData } from "@/services/request.service";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

// Histórico de requisições executadas. Persistência manual em localStorage,
// no mesmo estilo das outras stores (sem middleware persist).
const STORAGE_KEY = "requestHistory";
const MAX_ENTRIES = 100;

export interface HistoryEntry {
  id: string;
  // Identidade lógica da request (`MÉTODO url`) — usada para agrupar e para
  // o baseline do diff.
  key: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  status: number; // 0 quando houve erro de rede (sem resposta)
  ok: boolean;
  durationMs: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  error?: string;
  timestamp: number; // Date.now()
}

function strRecord(
  h: RequestConfig["headers"] | ResponseData["headers"] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h ?? {})) {
    if (v != null) out[k] = String(v);
  }
  return out;
}

function loadInitial(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage cheio/indisponível — ignora silenciosamente
  }
}

function makeId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

interface HistoryState {
  entries: HistoryEntry[]; // mais recente primeiro
  record: (input: {
    config: RequestConfig;
    response?: ResponseData | null;
    error?: string;
  }) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  entries: loadInitial(),

  record: ({ config, response, error }) => {
    const entry: HistoryEntry = {
      id: makeId(),
      key: `${config.method} ${config.url}`,
      method: config.method,
      url: config.url,
      requestHeaders: strRecord(config.headers),
      requestBody: config.body ?? "",
      status: response?.status ?? 0,
      ok: !!response && response.status >= 200 && response.status < 400,
      durationMs: response?.duration_ms ?? 0,
      responseHeaders: strRecord(response?.headers),
      responseBody: response?.body ?? "",
      error,
      timestamp: Date.now(),
    };
    set((s) => {
      const entries = [entry, ...s.entries].slice(0, MAX_ENTRIES);
      persist(entries);
      return { entries };
    });
  },

  remove: (id) =>
    set((s) => {
      const entries = s.entries.filter((e) => e.id !== id);
      persist(entries);
      return { entries };
    }),

  clear: () => {
    persist([]);
    set({ entries: [] });
  },
}));

/** Selector reativo: lista de execuções (mais recente primeiro). */
export function useHistory(): HistoryEntry[] {
  return useHistoryStore((s) => s.entries);
}

export function useHistoryActions() {
  return useHistoryStore(
    useShallow((s) => ({ remove: s.remove, clear: s.clear })),
  );
}

/**
 * Corpo da resposta da execução ANTERIOR da mesma request da execução mais
 * recente registrada — base para o modo "Diff" do response viewer. Retorna
 * null se não houver execução anterior com a mesma chave.
 */
export function useDiffBaseline(): string | null {
  return useHistoryStore((s) => {
    const [latest, ...rest] = s.entries;
    if (!latest) return null;
    const prev = rest.find((e) => e.key === latest.key);
    return prev ? prev.responseBody : null;
  });
}
