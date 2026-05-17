import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
} from "@/components/ui";
import { methodBadgeClass } from "@/lib/http-methods";
import { cn } from "@/lib/utils";
import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  EllipsisIcon,
  FilePlusIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Folder } from "../../services/folders.service";
import type { Request } from "../../services/request.service";

// id sentinela do droppable da raiz da coleção — permite soltar uma request
// "para fora" de qualquer pasta mesmo sobre área vazia.
const ROOT_DROP_ID = "__root__";

interface RequestsListProps {
  requests: Request[];
  folders: Folder[];
  /** Ordem manual por container ("" = raiz; demais = folderId). */
  orders: Record<string, string[]>;
  selectedId?: string;
  onSelect: (request: Request) => void;
  /** Abre o diálogo de edição da request (RequestUpdate). */
  onEditRequest: (id: string) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  /** Cria uma request com defaults dentro do folder (── "" = raiz) e seleciona. */
  onCreateRequest: (folderId: string) => void;
  /** Cria uma pasta (nome aleatório) dentro do parent (── "" = raiz). */
  onCreateFolder: (parentId: string) => void;
  /** Renomeia a pasta — usado pela edição inline (duplo clique no nome). */
  renameFolder: (id: string, name: string) => Promise<void>;
  /** Reparenta a pasta ("" = raiz da coleção; != "" = dentro do folder). */
  moveFolder: (id: string, newParentId: string) => void;
  /** Persiste a ordem manual de um container ("" = raiz). */
  setOrder: (folderId: string, ids: string[]) => void;
  moveRequest: (id: string, folderId: string) => void;
  setFavorite: (id: string, favorite: boolean) => void;
  duplicate: (id: string) => void;
}

// Item da árvore: pasta ou request. `id` é a chave usada no dnd e na ordem.
type TreeItem =
  | { kind: "folder"; id: string; folder: Folder }
  | { kind: "request"; id: string; request: Request };

// Aplica a ordem persistida sobre a lista: ids com entrada na ordem aparecem
// primeiro (na ordem salva); itens sem entrada vão pro fim, na ordem base
// (estável via índice original). Genérico — serve folders e requests juntos.
function applyOrder<T extends { id: string }>(items: T[], order: readonly string[]): T[] {
  if (order.length === 0) return items;
  const rank = new Map<string, number>();
  order.forEach((id, i) => rank.set(id, i));
  return items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => {
      const ra = rank.get(a.item.id);
      const rb = rank.get(b.item.id);
      if (ra === undefined && rb === undefined) return a.originalIndex - b.originalIndex;
      if (ra === undefined) return 1;
      if (rb === undefined) return -1;
      return ra - rb;
    })
    .map((entry) => entry.item);
}

// Contexto repassado pela recursão da árvore. Agrupa os mapas derivados e
// todas as ações — evita prop-drilling em cada nível de pasta.
interface TreeCtx {
  foldersByParent: Map<string, Folder[]>;
  requestsByFolder: Map<string, Request[]>;
  orders: Record<string, string[]>;
  allFolders: Folder[];
  /** Lookup de kind por id — usado no dnd p/ saber se o alvo é pasta. */
  folderById: Map<string, Folder>;
  requestById: Map<string, Request>;
  /** Pasta sobre a qual o cursor está durante um arraste (highlight). */
  dropTargetId: string | null;
  isExpanded: (id: string) => boolean;
  toggleExpanded: (id: string) => void;
  expand: (id: string) => void;
  /** Id da linha tabbável (roving tabindex) — só uma por vez. */
  currentId: string | null;
  /** Marca a linha como ativa (foco lógico) sem necessariamente selecioná-la. */
  setActiveId: (id: string | null) => void;
  /** Registra/desregistra o nó DOM da linha p/ foco imperativo das setas. */
  setRowRef: (id: string, el: HTMLDivElement | null) => void;
  /** Trata setas/Home/End/Enter/Espaço na árvore. */
  onTreeKeyDown: (
    e: ReactKeyboardEvent<HTMLDivElement>,
    id: string,
    kind: "folder" | "request",
  ) => void;
  selectedId?: string;
  onSelect: (request: Request) => void;
  onEditRequest: (id: string) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onCreateRequest: (folderId: string) => void;
  onCreateFolder: (parentId: string) => void;
  renameFolder: (id: string, name: string) => Promise<void>;
  moveFolder: (id: string, newParentId: string) => void;
  setOrder: (folderId: string, ids: string[]) => void;
  moveRequest: (id: string, folderId: string) => void;
  setFavorite: (id: string, favorite: boolean) => void;
  duplicate: (id: string) => void;
}

const byCreatedAt = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at.localeCompare(b.created_at);

// Ordem base de um container antes da ordem manual: subpastas (por criação)
// e então requests com as fixadas no topo (depois por criação). A ordem
// manual (dnd) prevalece quando existe — `applyOrder` cuida disso.
function baseItems(
  foldersByParent: Map<string, Folder[]>,
  requestsByFolder: Map<string, Request[]>,
  containerId: string,
): TreeItem[] {
  const folders = [...(foldersByParent.get(containerId) ?? [])]
    .sort(byCreatedAt)
    .map<TreeItem>((folder) => ({ kind: "folder", id: folder.id, folder }));
  const requests = [...(requestsByFolder.get(containerId) ?? [])]
    .sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      return byCreatedAt(a, b);
    })
    .map<TreeItem>((request) => ({ kind: "request", id: request.id, request }));
  return [...folders, ...requests];
}

// Ids ordenados de um container (base + ordem manual aplicada).
function containerIds(ctx: TreeCtx, containerId: string): string[] {
  return applyOrder(
    baseItems(ctx.foldersByParent, ctx.requestsByFolder, containerId),
    ctx.orders[containerId] ?? [],
  ).map((i) => i.id);
}

// Linha visível na árvore achatada, na mesma ordem em que é renderizada
// (cima→baixo). Usada só pela navegação por teclado.
type VisibleRow = {
  id: string;
  kind: "folder" | "request";
  /** Container pai ("" = raiz) — usado por ←/→ p/ subir de nível. */
  parentId: string;
  depth: number;
};

// Achata a árvore na ordem de render: recursa só em pastas expandidas
// (espelha o `if (isOpen)` do FolderRow). Reaproveita baseItems/applyOrder
// p/ garantir a mesma ordenação da UI.
function flattenVisible(
  foldersByParent: Map<string, Folder[]>,
  requestsByFolder: Map<string, Request[]>,
  orders: Record<string, string[]>,
  collapsed: Set<string>,
  containerId: string,
  depth: number,
  out: VisibleRow[],
): void {
  const items = applyOrder(
    baseItems(foldersByParent, requestsByFolder, containerId),
    orders[containerId] ?? [],
  );
  for (const item of items) {
    out.push({ id: item.id, kind: item.kind, parentId: containerId, depth });
    if (item.kind === "folder" && !collapsed.has(item.id)) {
      flattenVisible(foldersByParent, requestsByFolder, orders, collapsed, item.id, depth + 1, out);
    }
  }
}

// Submenu "Mover para": raiz + todas as pastas, exceto o container atual da
// request (no-op) e a própria seleção. Lista plana por nome.
function MoveSubmenu({ ctx, request }: { ctx: TreeCtx; request: Request }) {
  const targets = [...ctx.allFolders].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FolderInputIcon />
        Mover para
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
        {request.folder_id !== "" && (
          <DropdownMenuItem onSelect={() => ctx.moveRequest(request.id, "")}>
            <FolderIcon />
            Raiz da coleção
          </DropdownMenuItem>
        )}
        {targets
          .filter((f) => f.id !== request.folder_id)
          .map((f) => (
            <DropdownMenuItem key={f.id} onSelect={() => ctx.moveRequest(request.id, f.id)}>
              <FolderIcon />
              {f.name}
            </DropdownMenuItem>
          ))}
        {targets.filter((f) => f.id !== request.folder_id).length === 0 &&
          request.folder_id === "" && (
            <DropdownMenuItem disabled>Nenhuma pasta disponível</DropdownMenuItem>
          )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

// Linha de request arrastável estilo Postman: `[MÉTODO] título … [ações]`.
// A linha inteira é o handle de arraste (distância 6px → clique ainda
// seleciona, sem roubar scroll).
function RequestRow({ ctx, request, depth }: { ctx: TreeCtx; request: Request; depth: number }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: request.id,
  });

  // `role` vem de `attributes` (dnd-kit). O tabIndex é sobrescrito p/ roving:
  // só a linha "atual" entra na ordem de tab; as demais ficam em -1. Mesclar
  // num único objeto antes do spread evita TS2783 (prop duplicada com spread).
  const rowAttrs = {
    ...attributes,
    tabIndex: ctx.currentId === request.id ? 0 : -1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        // Com DragOverlay o item arrastado vira só um vão estático (o overlay
        // segue o cursor); os demais ainda deslizam pra abrir espaço.
        transform: isDragging
          ? undefined
          : transform
            ? `translate3d(0, ${transform.y}px, 0)`
            : undefined,
        transition: transition ?? undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {/* role vem do spread `{...rowAttrs}`; teclado de navegação delegado
          a ctx.onTreeKeyDown (setas/Home/End/Enter). */}
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/prefer-tag-over-role */}
      <div
        ref={(el) => ctx.setRowRef(request.id, el)}
        onClick={() => {
          ctx.setActiveId(request.id);
          ctx.onSelect(request);
        }}
        onKeyDown={(e) => ctx.onTreeKeyDown(e, request.id, "request")}
        style={{ paddingLeft: depth * 14 + 8 }}
        className={cn(
          "group mb-0.5 flex items-center gap-2 pr-2 py-1.5 rounded-md cursor-pointer transition-colors border",
          ctx.selectedId === request.id
            ? "bg-accent border-border"
            : "bg-card hover:bg-accent/50 border-transparent",
          isDragging && "opacity-40",
        )}
        {...rowAttrs}
        {...listeners}
      >
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 font-mono rounded-[2px] text-[10px] px-1.5 py-0",
            methodBadgeClass(request.method),
          )}
        >
          {request.method.toUpperCase()}
        </Badge>
        {request.is_favorite && (
          <PinIcon className="size-3 shrink-0 text-warning" aria-label="Fixada" />
        )}
        <span className="flex-1 min-w-0 truncate font-medium text-foreground text-sm">
          {request.name}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="size-7 border-none shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label="Ações da request"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => ctx.onEditRequest(request.id)}>
              <PencilIcon />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ctx.duplicate(request.id)}>
              <CopyIcon />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ctx.setFavorite(request.id, !request.is_favorite)}>
              {request.is_favorite ? <PinOffIcon /> : <PinIcon />}
              {request.is_favorite ? "Desafixar" : "Fixar"}
            </DropdownMenuItem>
            <MoveSubmenu ctx={ctx} request={request} />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => ctx.onDeleteRequest(request.id)}
            >
              <Trash2Icon />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Linha de pasta: arrastável (reordena) e droppable (soltar request aqui a
// move pra dentro). Duplo clique no nome → input inline; Enter salva.
function FolderRow({ ctx, folder, depth }: { ctx: TreeCtx; folder: Folder; depth: number }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: folder.id,
  });
  const isOpen = ctx.isExpanded(folder.id);
  const isDropTarget = ctx.dropTargetId === folder.id;

  // Mesma estratégia do RequestRow: roving tabindex mesclado ao spread.
  const rowAttrs = {
    ...attributes,
    tabIndex: ctx.currentId === folder.id ? 0 : -1,
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);

  const startEditing = () => {
    setDraft(folder.name);
    setEditing(true);
  };

  const commitRename = async () => {
    if (!editing) return;
    setEditing(false);
    const name = draft.trim();
    if (name && name !== folder.name) {
      try {
        await ctx.renameFolder(folder.id, name);
      } catch {
        /* erro tratado/registrado no store */
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: isDragging
          ? undefined
          : transform
            ? `translate3d(0, ${transform.y}px, 0)`
            : undefined,
        transition: transition ?? undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/prefer-tag-over-role */}
      <div
        ref={(el) => ctx.setRowRef(folder.id, el)}
        aria-expanded={isOpen}
        onClick={(e) => {
          // Duplo clique abre a edição inline — não alterna expandir.
          if (e.detail > 1 || editing) return;
          ctx.setActiveId(folder.id);
          ctx.toggleExpanded(folder.id);
        }}
        onKeyDown={(e) => {
          // Durante o rename inline o Input trata o teclado (e dá
          // stopPropagation); a navegação da árvore fica suspensa.
          if (editing) return;
          ctx.onTreeKeyDown(e, folder.id, "folder");
        }}
        style={{ paddingLeft: depth * 14 + 4 }}
        className={cn(
          "group mb-0.5 flex items-center gap-1.5 pr-2 py-1.5 rounded-md cursor-pointer transition-colors border",
          isDropTarget
            ? "border-primary bg-primary/20 ring-2 ring-primary/50 ring-inset"
            : "border-transparent bg-card hover:bg-accent/50",
          isDragging && "opacity-40",
        )}
        {...rowAttrs}
        {...listeners}
      >
        {isOpen ? (
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0",
              isDropTarget ? "text-primary" : "text-muted-foreground",
            )}
          />
        ) : (
          <ChevronRightIcon
            className={cn(
              "size-4 shrink-0",
              isDropTarget ? "text-primary" : "text-muted-foreground",
            )}
          />
        )}
        <FolderIcon
          className={cn("size-4 shrink-0", isDropTarget ? "text-primary" : "text-muted-foreground")}
        />
        {editing ? (
          <Input
            ref={(el) => {
              // Foca/seleciona só na montagem — evita jsx-a11y/no-autofocus e
              // não re-seleciona o texto a cada tecla (mesmo padrão do rename
              // de request mais acima neste arquivo).
              if (el && document.activeElement !== el) {
                el.focus();
                el.select();
              }
            }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                void commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
            className="h-7 flex-1 px-1.5 py-0 text-sm"
            aria-label="Nome da pasta"
          />
        ) : (
          // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
          <span
            className={cn(
              "flex-1 min-w-0 truncate font-medium text-sm",
              isDropTarget ? "text-primary" : "text-foreground",
            )}
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEditing();
            }}
          >
            {folder.name}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label="Ações da pasta"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => ctx.onCreateRequest(folder.id)}>
              <FilePlusIcon />
              Nova request aqui
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ctx.onCreateFolder(folder.id)}>
              <FolderPlusIcon />
              Nova subpasta
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTimeout(startEditing, 0)}>
              <PencilIcon />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => ctx.onDeleteFolder(folder.id)}>
              <Trash2Icon />
              Excluir pasta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isOpen && <Container ctx={ctx} containerId={folder.id} depth={depth + 1} />}
    </div>
  );
}

// Um container = a raiz da coleção ("") ou o conteúdo de uma pasta. O
// SortableContext escopa a estratégia de reordenação; o DndContext (único,
// no topo) é que permite arrastar entre containers.
function Container({
  ctx,
  containerId,
  depth,
}: {
  ctx: TreeCtx;
  containerId: string;
  depth: number;
}) {
  const items = useMemo(
    () =>
      applyOrder(
        baseItems(ctx.foldersByParent, ctx.requestsByFolder, containerId),
        ctx.orders[containerId] ?? [],
      ),
    [ctx, containerId],
  );
  const ids = useMemo(() => items.map((i) => i.id), [items]);

  if (items.length === 0) {
    return (
      <p style={{ paddingLeft: depth * 14 + 8 }} className="py-1.5 text-xs text-muted-foreground">
        Vazio
      </p>
    );
  }

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {items.map((item) =>
        item.kind === "folder" ? (
          <FolderRow key={item.id} ctx={ctx} folder={item.folder} depth={depth} />
        ) : (
          <RequestRow key={item.id} ctx={ctx} request={item.request} depth={depth} />
        ),
      )}
    </SortableContext>
  );
}

// Alvo explícito de "mover para a raiz". A árvore é densa (linhas coladas):
// não há área vazia confiável p/ acertar a raiz e qualquer linha de pasta sob
// o cursor intercepta o drop. Esta faixa só aparece quando se arrasta uma
// request que está DENTRO de uma pasta — aí vira um destino óbvio e clicável.
// O hook roda sempre (regra de hooks); só o visual depende de `show`.
function RootDropZone({ show }: { show: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      aria-hidden={!show}
      className={cn(
        "transition-all",
        show
          ? "mt-2 flex items-center justify-center rounded-md border-2 border-dashed py-3 text-xs font-medium"
          : "h-0 overflow-hidden border-0",
        show &&
          (isOver
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground"),
      )}
    >
      {show && "Soltar aqui para mover para a raiz da coleção"}
    </div>
  );
}

// Conteúdo do DragOverlay: uma cópia leve da linha (sem dnd/menu) que segue o
// cursor por position:fixed — é o que torna o arraste fluido (a linha original
// fica como vão estático na lista).
function DragPreview({ ctx, id }: { ctx: TreeCtx; id: string }) {
  const request = ctx.requestById.get(id);
  if (request) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-popover px-2 py-1.5 shadow-xl cursor-grabbing">
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 font-mono text-[10px] px-1.5 py-0",
            methodBadgeClass(request.method),
          )}
        >
          {request.method.toUpperCase()}
        </Badge>
        <span className="truncate font-medium text-foreground text-sm">{request.name}</span>
      </div>
    );
  }
  const folder = ctx.folderById.get(id);
  if (folder) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-popover px-2 py-1.5 shadow-xl cursor-grabbing">
        <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-foreground text-sm">{folder.name}</span>
      </div>
    );
  }
  return null;
}

export default function RequestsList({
  requests,
  folders,
  orders,
  selectedId,
  onSelect,
  onEditRequest,
  onDeleteRequest,
  onDeleteFolder,
  onCreateRequest,
  onCreateFolder,
  renameFolder,
  moveFolder,
  setOrder,
  moveRequest,
  setFavorite,
  duplicate,
}: RequestsListProps) {
  const [filter, setFilter] = useState("");
  // Pastas iniciam expandidas (projetos pequenos); colapsa por clique.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Pasta sob o cursor durante um arraste — só p/ feedback visual.
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // Id do item sendo arrastado (null = sem arraste) — controla a faixa "raiz".
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const foldersByParent = useMemo(() => {
    const map = new Map<string, Folder[]>();
    for (const folder of folders) {
      const key = folder.parent_id ?? "";
      const list = map.get(key);
      if (list) list.push(folder);
      else map.set(key, [folder]);
    }
    return map;
  }, [folders]);

  const requestsByFolder = useMemo(() => {
    const map = new Map<string, Request[]>();
    for (const request of requests) {
      const key = request.folder_id ?? "";
      const list = map.get(key);
      if (list) list.push(request);
      else map.set(key, [request]);
    }
    return map;
  }, [requests]);

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);

  // Navegação por teclado --------------------------------------------------
  // `activeId` = linha com foco lógico (roving). Quando nula/inválida, cai
  // pra seleção atual e, por fim, pra primeira linha visível.
  const [activeId, setActiveId] = useState<string | null>(null);
  // Nós DOM das linhas p/ mover o foco real com as setas (imperativo).
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // Árvore achatada na ordem de render — base de toda a navegação.
  const visible = useMemo(() => {
    const out: VisibleRow[] = [];
    flattenVisible(foldersByParent, requestsByFolder, orders, collapsed, "", 0, out);
    return out;
  }, [foldersByParent, requestsByFolder, orders, collapsed]);

  const visibleIndex = useMemo(() => {
    const m = new Map<string, number>();
    visible.forEach((row, i) => m.set(row.id, i));
    return m;
  }, [visible]);

  // Exatamente uma linha tabbável: a ativa (se ainda visível), senão a
  // selecionada (se visível), senão a primeira. Tab entra na árvore por ela.
  const currentId =
    activeId && visibleIndex.has(activeId)
      ? activeId
      : selectedId && visibleIndex.has(selectedId)
        ? selectedId
        : (visible[0]?.id ?? null);

  const setRowRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  // Move foco lógico + foco real do DOM. O alvo sempre já está montado
  // (a navegação só mira linhas visíveis), então não há foco pós-render —
  // nada de useEffect (respeita data-fetching-pattern).
  const focusRow = useCallback((id: string) => {
    setActiveId(id);
    rowRefs.current.get(id)?.focus();
  }, []);

  const onTreeKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>, id: string, kind: "folder" | "request") => {
      const idx = visibleIndex.get(id);
      if (idx === undefined) return;
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = visible[idx + 1];
          if (next) focusRow(next.id);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = visible[idx - 1];
          if (prev) focusRow(prev.id);
          break;
        }
        case "Home": {
          e.preventDefault();
          if (visible[0]) focusRow(visible[0].id);
          break;
        }
        case "End": {
          e.preventDefault();
          const last = visible[visible.length - 1];
          if (last) focusRow(last.id);
          break;
        }
        case "ArrowRight": {
          if (kind !== "folder") break;
          e.preventDefault();
          if (collapsed.has(id)) {
            // Pasta colapsada → expande (não muda o foco).
            setCollapsed((prev) => {
              if (!prev.has(id)) return prev;
              const nextSet = new Set(prev);
              nextSet.delete(id);
              return nextSet;
            });
          } else {
            // Já expandida → desce pro primeiro filho, se houver.
            const child = visible[idx + 1];
            if (child && child.parentId === id) focusRow(child.id);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (kind === "folder" && !collapsed.has(id)) {
            // Pasta expandida → colapsa (não muda o foco).
            setCollapsed((prev) => {
              if (prev.has(id)) return prev;
              const nextSet = new Set(prev);
              nextSet.add(id);
              return nextSet;
            });
          } else {
            // Folha (ou pasta já colapsada) → sobe pra pasta-pai.
            const parentId = visible[idx]?.parentId;
            if (parentId) focusRow(parentId);
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          setActiveId(id);
          if (kind === "request") {
            const r = requestById.get(id);
            if (r) onSelect(r);
          } else {
            setCollapsed((prev) => {
              const nextSet = new Set(prev);
              if (nextSet.has(id)) nextSet.delete(id);
              else nextSet.add(id);
              return nextSet;
            });
          }
          break;
        }
        default:
          break;
      }
    },
    [visible, visibleIndex, collapsed, focusRow, requestById, onSelect],
  );

  const ctx: TreeCtx = useMemo(
    () => ({
      foldersByParent,
      requestsByFolder,
      orders,
      allFolders: folders,
      folderById,
      requestById,
      dropTargetId,
      isExpanded: (id: string) => !collapsed.has(id),
      toggleExpanded: (id: string) =>
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      expand: (id: string) =>
        setCollapsed((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
      currentId,
      setActiveId,
      setRowRef,
      onTreeKeyDown,
      selectedId,
      onSelect,
      onEditRequest,
      onDeleteRequest,
      onDeleteFolder,
      onCreateRequest,
      onCreateFolder,
      renameFolder,
      moveFolder,
      setOrder,
      moveRequest,
      setFavorite,
      duplicate,
    }),
    [
      foldersByParent,
      requestsByFolder,
      orders,
      folders,
      folderById,
      requestById,
      dropTargetId,
      collapsed,
      currentId,
      setRowRef,
      onTreeKeyDown,
      selectedId,
      onSelect,
      onEditRequest,
      onDeleteRequest,
      onDeleteFolder,
      onCreateRequest,
      onCreateFolder,
      renameFolder,
      moveFolder,
      setOrder,
      moveRequest,
      setFavorite,
      duplicate,
    ],
  );

  // Resolve o container alvo a partir do id do droppable sob o cursor.
  // null = alvo inválido (ex.: id desconhecido).
  const resolveTargetContainer = (overId: string): string | null => {
    if (overId === ROOT_DROP_ID) return "";
    if (folderById.has(overId)) return overId; // soltar SOBRE a pasta = entrar nela
    if (requestById.has(overId)) return requestById.get(overId)!.folder_id ?? "";
    return null;
  };

  // Colisão p/ árvore aninhada: pega quem está sob o ponteiro, descarta a raiz
  // quando há alvo específico e, entre os candidatos, prioriza o de MENOR área
  // — o item-folha vence a pasta-ancestral (cujo rect cobre toda a subárvore).
  const collision: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    const hits = within.length > 0 ? within : closestCenter(args);
    if (hits.length <= 1) return hits;
    const nonRoot = hits.filter((h) => h.id !== ROOT_DROP_ID);
    const pool = nonRoot.length > 0 ? nonRoot : hits;
    return [...pool].sort((a, b) => {
      const ra = args.droppableRects.get(a.id);
      const rb = args.droppableRects.get(b.id);
      const areaA = ra ? ra.width * ra.height : Number.POSITIVE_INFINITY;
      const areaB = rb ? rb.width * rb.height : Number.POSITIVE_INFINITY;
      return areaA - areaB;
    });
  };

  function handleDragEnd(event: DragEndEvent) {
    setDropTargetId(null);
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const target = resolveTargetContainer(overId);
    if (target === null) return;

    const activeRequest = requestById.get(activeId);
    if (activeRequest) {
      const from = activeRequest.folder_id ?? "";
      // Soltou numa pasta diferente da atual → move pra dentro dela.
      if (target !== from) {
        moveRequest(activeId, target);
        if (target !== "") ctx.expand(target);
        return;
      }
      // Mesmo container → reordena relativo ao item sob o cursor.
      const list = containerIds(ctx, from);
      const oldIndex = list.indexOf(activeId);
      const newIndex = list.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      setOrder(from, arrayMove(list, oldIndex, newIndex));
      return;
    }

    // Pasta arrastada.
    const activeFolder = folderById.get(activeId);
    if (activeFolder) {
      const parent = activeFolder.parent_id ?? "";
      // Mesmo container → só reordena (preserva a árvore íntegra).
      if (target === parent) {
        const list = containerIds(ctx, parent);
        const oldIndex = list.indexOf(activeId);
        const newIndex = list.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        setOrder(parent, arrayMove(list, oldIndex, newIndex));
        return;
      }
      // Reparent: bloqueia mover a pasta para dentro dela mesma ou de uma
      // descendente (criaria ciclo / perderia a subárvore) — o backend
      // também recusa, mas evitamos a ida e volta.
      let cursor = target;
      const seen = new Set<string>();
      while (cursor !== "" && !seen.has(cursor)) {
        if (cursor === activeId) return;
        seen.add(cursor);
        cursor = folderById.get(cursor)?.parent_id ?? "";
      }
      moveFolder(activeId, target);
      if (target !== "") ctx.expand(target);
    }
  }

  // Modo filtro: lista plana de requests que casam (nome/URL/método), sem
  // árvore nem dnd — reordenar uma lista filtrada persistiria ordem parcial.
  const flatMatches = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (query === "") return null;
    return requests
      .filter(
        (request) =>
          request.name.toLowerCase().includes(query) ||
          request.url.toLowerCase().includes(query) ||
          request.method.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [requests, filter]);

  // Estado totalmente vazio: nenhuma request e nenhuma pasta.
  if (requests.length === 0 && folders.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p>Nenhuma request ainda. Crie a primeira!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-2">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar requests…"
          className="pl-9"
        />
      </div>

      {flatMatches !== null ? (
        flatMatches.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <p>Nenhuma request corresponde ao filtro.</p>
          </div>
        ) : (
          <div>
            {flatMatches.map((request) => (
              // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
              <div
                key={request.id}
                onClick={() => onSelect(request)}
                className={cn(
                  "mb-0.5 flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors border",
                  selectedId === request.id
                    ? "bg-accent border-border"
                    : "bg-card hover:bg-accent/50 border-transparent",
                )}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 font-mono text-[10px] px-1.5 py-0",
                    methodBadgeClass(request.method),
                  )}
                >
                  {request.method.toUpperCase()}
                </Badge>
                {request.is_favorite && (
                  <PinIcon className="size-3 shrink-0 text-warning" aria-label="Fixada" />
                )}
                <span className="flex-1 min-w-0 truncate font-medium text-foreground text-sm">
                  {request.name}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          // A faixa "raiz" só ganha altura após o onDragStart (re-render); sem
          // medição contínua o dnd-kit guardaria o rect 0 e ela não receberia
          // drop. `Always` re-mede os droppables a cada frame do arraste.
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={({ active }) => setActiveDragId(String(active.id))}
          onDragOver={({ over }) => {
            const id = over ? String(over.id) : null;
            setDropTargetId(id && folderById.has(id) ? id : null);
          }}
          onDragCancel={() => {
            setDropTargetId(null);
            setActiveDragId(null);
          }}
          onDragEnd={handleDragEnd}
        >
          <Container ctx={ctx} containerId="" depth={0} />
          {/* A faixa "raiz" só aparece quando se arrasta uma request que está
              dentro de uma pasta — único jeito confiável de soltar na raiz. */}
          <RootDropZone
            show={(() => {
              const r = activeDragId ? requestById.get(activeDragId) : undefined;
              return !!r && (r.folder_id ?? "") !== "";
            })()}
          />
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
            {activeDragId ? <DragPreview ctx={ctx} id={activeDragId} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
