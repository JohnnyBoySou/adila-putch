import { EnvironmentsService as Wails } from "@bindings/services";

export type { Environment } from "@bindings/services";

// Environments agora são de workspace (compartilhados por todas as collections
// do workspace ativo). O backend escopa pelo workspace ativo do store.
export const EnvironmentService = {
  findAll() {
    return Wails.FindAll();
  },

  create(name: string, variables: Record<string, string>) {
    return Wails.Create(name, variables);
  },

  delete(id: string) {
    return Wails.Delete(id);
  },

  update(id: string, name: string, variables: Record<string, string>) {
    return Wails.Update(id, name, variables);
  },

  findById(id: string) {
    return Wails.FindByID(id);
  },

  interpolate(text: string, variables: Record<string, string>) {
    return Wails.Interpolate(text, variables);
  },
};
