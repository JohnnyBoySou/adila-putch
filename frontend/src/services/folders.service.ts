import { FoldersService as Wails } from "@bindings/services";

export type { Folder } from "@bindings/services";

export const FolderService = {
  findByCollectionId(collectionId: string) {
    return Wails.FindByCollectionID(collectionId);
  },

  findById(id: string) {
    return Wails.FindByID(id);
  },

  // parentId === "" cria um folder direto na coleção; != "" cria subpasta
  // aninhada dentro do folder pai.
  create(collectionId: string, parentId: string, name: string) {
    return Wails.Create(collectionId, parentId, name);
  },

  update(id: string, name: string) {
    return Wails.Update(id, name);
  },

  // Reparenta um folder. newParentId === "" move para a raiz da coleção;
  // != "" move para dentro do folder de id newParentId.
  move(id: string, newParentId: string) {
    return Wails.Move(id, newParentId);
  },

  delete(id: string) {
    return Wails.Delete(id);
  },

  // Ordem manual por container da coleção: chave "" = raiz; demais = folderId.
  getOrders(collectionId: string) {
    return Wails.GetOrders(collectionId);
  },

  // folderId === "" persiste a ordem da raiz da coleção.
  setOrder(collectionId: string, folderId: string, ids: string[]) {
    return Wails.SetOrder(collectionId, folderId, ids);
  },
};
