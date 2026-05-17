import {
  RequestConfig,
  RequestInput,
  RequestsService as Wails,
  RequestUpdate,
} from "@bindings/services";
import type { Request } from "@bindings/services";
import { ALL_ITEMS } from "./pagination";

export type { Request, RequestConfig, ResponseData } from "@bindings/services";

/**
 * Dados aceitos ao criar uma request. Espelha o RequestInput do Go,
 * deixando opcionais os campos que o service preenche com default
 * (incl. os campos novos do backend: params/body_type/form/files/auth/timeout).
 */
export type CreateRequestData = Pick<
  RequestInput,
  "name" | "collection_id" | "url" | "method"
> &
  Partial<
    Pick<
      RequestInput,
      | "folder_id"
      | "headers"
      | "body"
      | "params"
      | "body_type"
      | "form"
      | "files"
      | "auth_type"
      | "auth_value"
      | "timeout_ms"
    >
  >;

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
    // Construído via RequestInput: o construtor preenche qualquer campo novo
    // do backend com o zero-value do Go — à prova de futuras adições.
    return Wails.Create(
      new RequestInput({
        name: data.name,
        collection_id: data.collection_id,
        folder_id: data.folder_id ?? "",
        url: data.url,
        method: data.method,
        params: data.params ?? {},
        headers: data.headers ?? {},
        body: data.body ?? "",
        body_type: data.body_type ?? "",
        form: data.form ?? {},
        files: data.files ?? {},
        auth_type: data.auth_type ?? "",
        auth_value: data.auth_value ?? "",
        timeout_ms: data.timeout_ms ?? 0,
      }),
    );
  },

  /**
   * IMPORTANTE: `store.UpdateRequest` (Go) faz **replace total** do registro
   * (só preserva id/collection/created_at/is_active/is_favorite). Por isso o
   * caller (requests.store) DEVE mesclar o patch sobre a request completa
   * antes de chamar isto — `data` aqui é a request inteira, não um patch.
   * Os `?? `/defaults abaixo são só salvaguarda contra campos ausentes.
   */
  update(id: string, data: Partial<Request>) {
    return Wails.Update(
      id,
      new RequestUpdate({
        name: data.name ?? "",
        folder_id: data.folder_id ?? "",
        url: data.url ?? "",
        method: data.method ?? "",
        params: data.params ?? {},
        headers: data.headers ?? {},
        body: data.body ?? "",
        body_type: data.body_type ?? "",
        form: data.form ?? {},
        files: data.files ?? {},
        auth_type: data.auth_type ?? "",
        auth_value: data.auth_value ?? "",
        timeout_ms: data.timeout_ms ?? 0,
      }),
    );
  },

  delete(id: string) {
    return Wails.Delete(id);
  },

  // Único caminho para o "fixar": Update faz replace total mas preserva
  // is_favorite no backend de propósito.
  setFavorite(id: string, favorite: boolean) {
    return Wails.SetFavorite(id, favorite);
  },

  // Move a request para outro folder (folderId === "" = raiz da coleção).
  // Preserva todos os campos — diferente de update().
  move(id: string, folderId: string) {
    return Wails.Move(id, folderId);
  },

  /**
   * Duplica uma request client-side: lê a original e cria uma cópia (mesmo
   * collection/folder) com sufixo " (cópia)" no nome. Não há método dedicado
   * no backend — FindByID + Create cobrem o caso sem mexer no Go.
   */
  async duplicate(id: string) {
    const src = await Wails.FindByID(id);
    return Wails.Create(
      new RequestInput({
        name: `${src.name} (cópia)`,
        collection_id: src.collection_id,
        folder_id: src.folder_id,
        url: src.url,
        method: src.method,
        params: src.params,
        headers: src.headers,
        body: src.body,
        body_type: src.body_type,
        form: src.form,
        files: src.files,
        auth_type: src.auth_type,
        auth_value: src.auth_value,
        timeout_ms: src.timeout_ms,
      }),
    );
  },

  send(config: RequestConfig) {
    return Wails.Send(
      new RequestConfig({
        url: config.url,
        method: config.method,
        params: config.params ?? {},
        headers: config.headers ?? {},
        body: config.body ?? "",
        body_type: config.body_type ?? "",
        form: config.form ?? {},
        files: config.files ?? {},
        auth_type: config.auth_type ?? "",
        auth_value: config.auth_value ?? "",
        timeout_ms: config.timeout_ms ?? 0,
        client_req_id: config.client_req_id ?? "",
      }),
    );
  },
};
