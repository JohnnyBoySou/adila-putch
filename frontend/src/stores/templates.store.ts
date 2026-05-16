import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

// Templates de request reutilizáveis salvos client-side. Persistência manual
// em localStorage, no mesmo estilo das outras stores (sem middleware persist).
const STORAGE_KEY = "requestTemplates";

export interface RequestTemplate {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  createdAt: number;
}

function loadInitial(): RequestTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RequestTemplate[]) : [];
  } catch {
    return [];
  }
}

function persist(templates: RequestTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
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

interface TemplatesState {
  templates: RequestTemplate[]; // mais recente primeiro
  add: (input: {
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  }) => void;
  remove: (id: string) => void;
}

export const useTemplatesStore = create<TemplatesState>((set) => ({
  templates: loadInitial(),

  add: ({ name, method, url, headers, body }) => {
    const template: RequestTemplate = {
      id: makeId(),
      name,
      method,
      url,
      headers,
      body,
      createdAt: Date.now(),
    };
    set((s) => {
      const templates = [template, ...s.templates];
      persist(templates);
      return { templates };
    });
  },

  remove: (id) =>
    set((s) => {
      const templates = s.templates.filter((t) => t.id !== id);
      persist(templates);
      return { templates };
    }),
}));

/** Selector reativo: lista de templates (mais recente primeiro). */
export function useTemplates(): RequestTemplate[] {
  return useTemplatesStore((s) => s.templates);
}

export function useTemplateActions() {
  return useTemplatesStore(
    useShallow((s) => ({ add: s.add, remove: s.remove })),
  );
}
