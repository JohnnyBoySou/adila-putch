import { WorkspaceService as Wails } from "@bindings/services";

// WorkspaceService (singular): escolhe/gerencia a PASTA root do store no disco
// (diálogo nativo, path atual, reset). Não confundir com WorkspacesService
// (plural, workspaces.service.ts), que faz CRUD dos workspaces DENTRO do root.
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
