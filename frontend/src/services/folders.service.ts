import { FoldersService as Wails } from "@bindings/services";

export type { Folder } from "@bindings/services";

export const FolderService = {
  findByCollectionId(collectionId: string) {
    return Wails.FindByCollectionID(collectionId);
  },

  findById(id: string) {
    return Wails.FindByID(id);
  },

  create(collectionId: string, name: string) {
    return Wails.Create(collectionId, name);
  },

  update(id: string, name: string) {
    return Wails.Update(id, name);
  },

  delete(id: string) {
    return Wails.Delete(id);
  },
};
