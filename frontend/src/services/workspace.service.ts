import { WorkspaceService as Wails } from "@bindings/services";

export const WorkspaceService = {
  getPath() {
    return Wails.GetPath();
  },

  // Abre o diálogo nativo de pasta. Retorna o path em uso (novo ou, se
  // cancelado/erro, o atual inalterado).
  choose() {
    return Wails.Choose();
  },

  resetToDefault() {
    return Wails.ResetToDefault();
  },
};
