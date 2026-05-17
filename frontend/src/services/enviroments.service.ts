import { EnvironmentInput, EnvironmentsService as Wails } from "@bindings/services";

export type { Environment, EnvironmentInput } from "@bindings/services";

// Environments agora são de workspace (compartilhados por todas as collections
// do workspace ativo). O backend escopa pelo workspace ativo do store.
export const EnvironmentService = {
  findAll() {
    return Wails.FindAll();
  },

  // Constrói via `new EnvironmentInput(...)` (não literal cru): o construtor
  // gerado preenche campos ausentes com o zero-value do Go, sobrevivendo a
  // adições futuras de campos no backend.
  create(input: EnvironmentInput) {
    return Wails.Create(new EnvironmentInput(input));
  },

  delete(id: string) {
    return Wails.Delete(id);
  },

  update(id: string, input: EnvironmentInput) {
    return Wails.Update(id, new EnvironmentInput(input));
  },

  findById(id: string) {
    return Wails.FindByID(id);
  },

  interpolate(text: string, variables: Record<string, string>) {
    return Wails.Interpolate(text, variables);
  },
};
