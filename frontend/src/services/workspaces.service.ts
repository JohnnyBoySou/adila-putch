import { WorkspacesService as Wails } from "@bindings/services";
import type { WorkspaceInput } from "@bindings/services";

export type { Workspace, WorkspaceInput } from "@bindings/services";

// Workspaces (plural): entidades dentro do root versionado. Não confundir com
// WorkspaceService (singular, workspace.service.ts) que escolhe a PASTA root.
export const WorkspacesService = {
  findAll() {
    return Wails.FindAll();
  },

  getActive() {
    return Wails.GetActive();
  },

  create(input: WorkspaceInput) {
    return Wails.Create(input);
  },

  update(id: string, input: WorkspaceInput) {
    return Wails.Update(id, input);
  },

  delete(id: string) {
    return Wails.Delete(id);
  },

  setActive(id: string) {
    return Wails.SetActive(id);
  },
};
