import { CollectionsService as Wails } from "@bindings/services";
import type { CollectionInput } from "@bindings/services";
import { ALL_ITEMS } from "./pagination";

export type { Collection, CollectionInput } from "@bindings/services";

export const CollectionsService = {
  findAll(page = 1, limit = ALL_ITEMS) {
    return Wails.FindAll(page, limit);
  },

  create(input: CollectionInput) {
    return Wails.Create(input);
  },

  delete(id: string) {
    return Wails.Delete(id);
  },

  update(id: string, input: CollectionInput) {
    return Wails.Update(id, input);
  },

  findById(id: string) {
    return Wails.FindByID(id);
  },

  findByQuery(query: string, page = 1, limit = ALL_ITEMS) {
    return Wails.FindByQuery(query, page, limit);
  },

  export(id: string) {
    return Wails.Export(id);
  },

  import(fileContent: string) {
    return Wails.Import(fileContent);
  },
};
