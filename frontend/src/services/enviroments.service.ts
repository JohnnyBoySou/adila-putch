import { EnvironmentsService as Wails } from "@bindings/services";

export type { Environment } from "@bindings/services";

export const EnvironmentService = {
  findAll(collectionId?: string) {
    return Wails.FindAll(collectionId ?? "");
  },

  create(collectionId: string, name: string, variables: Record<string, string>) {
    return Wails.Create(collectionId, name, variables);
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
