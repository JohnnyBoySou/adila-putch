import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Row,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { useCollections } from "@/hooks/useCollections";
import { useFolders } from "@/hooks/useFolders";
import { useRequestsStore } from "@/stores/requests.store";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import {
  FolderOpenIcon,
  FolderPlusIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useRef, useState } from "react";
import { useRequests } from "../../hooks/useRequests";
import { Request } from "../../services/request.service";
import CollectionEditDialog from "../collections/edit-dialog";
import RequestEditor from "../editor/view";
import RequestsList from "./list";
import RequestUpdate from "./update";

const routeApi = getRouteApi("/panel/collections/$collectionId/requests/");

export default function RequestsView() {
  const { collectionId } = routeApi.useParams();
  const navigate = useNavigate();
  const {
    requests,
    collectionName,
    loading,
    error,
    createRequest,
    deleteRequest,
    updateRequest,
    duplicateRequest,
    setRequestFavorite,
    moveRequest,
  } = useRequests();
  const { folders, orders, createFolder, renameFolder, moveFolder, deleteFolder, setOrder } =
    useFolders();
  const { collections, deleteCollection } = useCollections();
  const collection = collections.find((c) => c.id === collectionId);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editCollectionOpen, setEditCollectionOpen] = useState(false);
  // Descreve qual exclusão está pendente de confirmação (null = nenhuma)
  const [pendingDelete, setPendingDelete] = useState<
    { kind: "collection" } | { kind: "request"; id: string } | { kind: "folder"; id: string } | null
  >(null);

  // Abre o diálogo de confirmação de exclusão da coleção
  const handleDeleteCollection = () => {
    if (!collection) return;
    setPendingDelete({ kind: "collection" });
  };

  // "Nova request": cria direto com defaults (no folder informado ou raiz) e
  // já abre no editor — sem passar pelo formulário de criação.
  const handleCreateDefault = async (folderId: string) => {
    if (!collectionId) return;
    const created = await createRequest({
      name: "Nova request",
      collection_id: collectionId,
      url: "",
      method: "GET",
      folder_id: folderId,
    });
    setSelectedRequest(created);
  };

  const handleUpdate = async (id: string, data: Partial<Request>) => {
    await updateRequest(id, data);
    // Atualiza selectedRequest se for a request sendo editada
    if (selectedRequest?.id === id) {
      // Mescla os dados atualizados com o selectedRequest atual
      setSelectedRequest((prev: Request | null) => (prev ? { ...prev, ...data } : null));
    }
    setEditingId(null);
  };

  // Abre o diálogo de confirmação de exclusão de uma request
  const handleDeleteRequest = (id: string) => {
    setPendingDelete({ kind: "request", id });
  };

  // Abre o diálogo de confirmação de exclusão de uma pasta (recursivo)
  const handleDeleteFolder = (id: string) => {
    setPendingDelete({ kind: "folder", id });
  };

  // Executa a exclusão pendente confirmada no AlertDialog
  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "collection") {
      if (!collection) return;
      await deleteCollection(collection.id);
      navigate({ to: "/panel/collections" });
    } else if (pendingDelete.kind === "request") {
      const { id } = pendingDelete;
      await deleteRequest(id);
      if (selectedRequest?.id === id) setSelectedRequest(null);
    } else {
      // Delete de pasta é recursivo no backend; o store recarrega requests.
      // Limpa a seleção se a request aberta sumiu junto com a subárvore.
      await deleteFolder(pendingDelete.id);
      const stillThere = useRequestsStore
        .getState()
        .requests.some((r) => r.id === selectedRequest?.id);
      if (!stillThere) setSelectedRequest(null);
    }
    setPendingDelete(null);
  };

  // "Nova pasta": cria na hora com um nome aleatório legível. O usuário
  // renomeia depois com duplo clique no nome (edição inline na árvore).
  const handleCreateFolder = async (parentId: string) => {
    const name = `Pasta ${Math.floor(Math.random() * 900 + 100)}`;
    await createFolder(parentId, name);
  };

  if (loading && requests.length === 0) {
    // Skeleton que imita a estrutura visual da sidebar: cabeçalho + 5 cards de request.
    return (
      <ResizablePanelGroup id="requests-layout" orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel
          id="requests-sidebar"
          defaultSize="24%"
          minSize="16%"
          maxSize="40%"
          className="border-r border-border flex flex-col bg-muted/40"
        >
          {/* Cabeçalho */}
          <div className="p-4 border-b border-border bg-card space-y-2">
            <Skeleton className="h-6 w-3/4" />
          </div>
          <div className="p-4 border-b border-border bg-card">
            <Skeleton className="h-9 w-full" />
          </div>
          {/* Itens da lista */}
          <div className="flex-1 overflow-hidden p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="rounded-lg border border-transparent bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-4/5" />
                <div className="flex gap-1">
                  <Skeleton className="h-7 flex-1 rounded-md" />
                  <Skeleton className="h-7 flex-1 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="requests-editor" className="flex flex-col overflow-hidden" />
      </ResizablePanelGroup>
    );
  }

  return (
    <ResizablePanelGroup id="requests-layout" orientation="horizontal" className="min-h-0 flex-1">
      {/* Sidebar de requests */}
      <ResizablePanel
        id="requests-sidebar"
        defaultSize="24%"
        minSize="16%"
        maxSize="40%"
        className="border-r border-border flex flex-col bg-muted/40"
      >
        <div className="p-4 border-b border-border bg-card">
          <div className="flex justify-between items-center gap-2 mb-2">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {/* Nome vem do collections store (vivo, atualizado pelo edit
                  dialog via merge otimista). collectionName do requests store
                  é só um snapshot do load — fallback até o collection carregar. */}
              {collection?.name ?? collectionName}
            </h2>
            <Row className="gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="size-7"
                    variant="ghost"
                    onClick={() => handleCreateDefault("")}
                    aria-label="Nova request"
                  >
                    <PlusIcon className="size-2" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Nova request</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="size-7"
                    variant="ghost"
                    onClick={() => handleCreateFolder("")}
                    aria-label="Nova pasta"
                  >
                    <FolderPlusIcon className="size-2" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Nova pasta</TooltipContent>
              </Tooltip>
              {collection && (
                <DropdownMenu>
                  {/* Aninhamento asChild: TooltipTrigger envolve o DropdownMenuTrigger
                    (que por sua vez clona o Button). Cada `asChild` consome um nível
                    distinto — não há dois competindo pelo mesmo elemento final. */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label="Ações da coleção"
                        >
                          <MoreVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Ações da coleção</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={() => setEditCollectionOpen(true)}>
                      <PencilIcon />
                      Editar coleção
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate({ to: "/panel/collections" })}>
                      <FolderOpenIcon />
                      Ver todas as coleções
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={handleDeleteCollection}>
                      <Trash2Icon />
                      Excluir coleção
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Row>
          </div>
        </div>

        {error && (
          <div className="m-4 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-4 relative">
          <RequestsList
            requests={requests}
            folders={folders}
            orders={orders}
            selectedId={selectedRequest?.id}
            onSelect={setSelectedRequest}
            onEditRequest={setEditingId}
            onDeleteRequest={handleDeleteRequest}
            onDeleteFolder={handleDeleteFolder}
            onCreateRequest={handleCreateDefault}
            onCreateFolder={handleCreateFolder}
            renameFolder={renameFolder}
            moveFolder={moveFolder}
            setOrder={setOrder}
            moveRequest={moveRequest}
            setFavorite={setRequestFavorite}
            duplicate={duplicateRequest}
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Área principal com editor */}
      <ResizablePanel id="requests-editor" className="flex flex-col overflow-hidden">
        {selectedRequest ? (
          <RequestEditor
            key={selectedRequest.id}
            request={selectedRequest}
            onUpdate={(data) => handleUpdate(selectedRequest.id, data)}
            onDelete={() => handleDeleteRequest(selectedRequest.id)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">Selecione uma request para editar</p>
              <p className="text-sm">ou crie uma nova</p>
            </div>
          </div>
        )}
      </ResizablePanel>

      {editingId && (
        <RequestUpdate
          request={requests.find((r) => r.id === editingId)!}
          onSubmit={(data) => handleUpdate(editingId, data)}
          onCancel={() => setEditingId(null)}
        />
      )}

      {collection && (
        <CollectionEditDialog
          collection={collection}
          open={editCollectionOpen}
          onOpenChange={setEditCollectionOpen}
        />
      )}

      {/* Diálogo único de confirmação de exclusão (coleção, request ou pasta) */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === "collection"
                ? "Excluir coleção"
                : pendingDelete?.kind === "folder"
                  ? "Excluir pasta"
                  : "Excluir request"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "collection"
                ? `Excluir a coleção "${collection?.name}"? Todas as requests dela serão removidas. Esta ação não pode ser desfeita.`
                : pendingDelete?.kind === "folder"
                  ? "Excluir esta pasta? Todas as subpastas e requests dentro dela serão removidas. Esta ação não pode ser desfeita."
                  : "Tem certeza que deseja excluir esta request? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmPendingDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResizablePanelGroup>
  );
}
