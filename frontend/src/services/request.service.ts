import { RequestsService as Wails } from "@bindings/services";
import type { Request, RequestConfig, RequestInput } from "@bindings/services";
import { ALL_ITEMS } from "./pagination";

export type { Request, RequestConfig, ResponseData } from "@bindings/services";

/**
 * Dados aceitos ao criar uma request. Espelha o RequestInput do Go,
 * deixando opcionais os campos que o service preenche com default.
 */
export type CreateRequestData = Pick<RequestInput, "name" | "collection_id" | "url" | "method"> &
  Partial<Pick<RequestInput, "folder_id" | "headers" | "body">>;

export const RequestService = {
  findAll(page = 1, limit = ALL_ITEMS) {
    return Wails.FindAll(page, limit);
  },

  findByCollectionId(collectionId: string, page = 1, limit = ALL_ITEMS) {
    return Wails.FindByCollectionID(collectionId, page, limit);
  },

  findByFolderId(folderId: string, page = 1, limit = ALL_ITEMS) {
    return Wails.FindByFolderID(folderId, page, limit);
  },

  findById(id: string) {
    return Wails.FindByID(id);
  },

  findByQuery(query: string, page = 1, limit = ALL_ITEMS) {
    return Wails.FindByQuery(query, page, limit);
  },

  create(data: CreateRequestData) {
    return Wails.Create({
      name: data.name,
      collection_id: data.collection_id,
      folder_id: data.folder_id ?? "",
      url: data.url,
      method: data.method,
      headers: data.headers ?? {},
      body: data.body ?? "",
    });
  },

  update(id: string, data: Partial<Request>) {
    return Wails.Update(id, {
      name: data.name ?? "",
      folder_id: data.folder_id ?? "",
      url: data.url ?? "",
      method: data.method ?? "",
      headers: data.headers ?? {},
      body: data.body ?? "",
    });
  },

  delete(id: string) {
    return Wails.Delete(id);
  },

  send(config: RequestConfig) {
    return Wails.Send({
      url: config.url,
      method: config.method,
      headers: config.headers ?? {},
      body: config.body ?? "",
    });
  },
};
