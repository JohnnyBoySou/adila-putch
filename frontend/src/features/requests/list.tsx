import { Request } from "../../services/request.service";
import { Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useRequestOrder, useSetRequestOrder } from "@/stores/request-order.store";
import { useRequestsStore } from "@/stores/requests.store";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CopyIcon, GripVerticalIcon, SearchIcon } from "lucide-react";
import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";

interface RequestsListProps {
  requests: Request[];
  /** Container de scroll da sidebar (fornecido pelo pai). */
  scrollRef: RefObject<HTMLDivElement | null>;
  selectedId?: string;
  onSelect: (request: Request) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

// Mapeia método HTTP → classes de token semântico do design system.
// Fallback (HEAD, OPTIONS e métodos desconhecidos) usa `muted`.
const METHOD_CLASSES: Record<string, string> = {
  GET:     "bg-success/15 text-success",
  POST:    "bg-info/15 text-info",
  PUT:     "bg-warning/15 text-warning",
  PATCH:   "bg-warning/15 text-warning",
  DELETE:  "bg-destructive/10 text-destructive",
};

function methodBadgeClass(method: string): string {
  return METHOD_CLASSES[method.toUpperCase()] ?? "bg-muted text-muted-foreground";
}

// Aplica a ordem persistida sobre a lista recebida: ids com entrada na ordem
// aparecem primeiro (na ordem salva); requests sem entrada vão pro fim, na
// ordem original em que chegaram. Estável e sem efeitos colaterais.
function applyOrder(requests: Request[], order: readonly string[]): Request[] {
  if (order.length === 0) return requests;
  const rank = new Map<string, number>();
  order.forEach((id, i) => rank.set(id, i));
  // `decorate-sort-undecorate`: guarda o índice original para desempate
  // estável entre requests sem entrada na ordem.
  return requests
    .map((request, originalIndex) => ({ request, originalIndex }))
    .sort((a, b) => {
      const ra = rank.get(a.request.id);
      const rb = rank.get(b.request.id);
      if (ra === undefined && rb === undefined) return a.originalIndex - b.originalIndex;
      if (ra === undefined) return 1;
      if (rb === undefined) return -1;
      return ra - rb;
    })
    .map((entry) => entry.request);
}

// Item arrastável: um card de request. O drag é acionado APENAS pelo handle
// (ícone `GripVertical`), nunca pelo card inteiro — assim o clique de
// selecionar/editar/excluir continua funcionando sem conflito com o pointer
// sensor do dnd-kit.
function SortableRequestItem({
  request,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  measureRef,
  index,
  translateY,
}: {
  request: Request;
  selectedId?: string;
  onSelect: (request: Request) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  measureRef: (node: Element | null) => void;
  index: number;
  translateY: number;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: request.id });

  // "Duplicar" é autocontido aqui: o store já faz o append reativo após clonar
  // no backend, sem precisar de prop `onDuplicate` — o que evitaria editar o
  // route pai (que não pode ser alterado nesta tarefa).
  const duplicate = useRequestsStore((s) => s.duplicate);

  async function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await duplicate(request.id);
    } catch {
      // erro já registrado no store; não propagar para a UI
      console.error("Falha ao duplicar request:", request.id);
    }
  }

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        measureRef(node);
      }}
      data-index={index}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        // O virtualizer posiciona o item; durante o arrasto, o `transform` do
        // dnd-kit é somado ao deslocamento virtual.
        transform: transform
          ? `translate3d(0, ${translateY + transform.y}px, 0)`
          : `translateY(${translateY}px)`,
        transition: transition ?? undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {/* role="button" + tabIndex + onKeyDown: suporte a teclado exigido pelo
          jsx-a11y (click-events-have-key-events / no-static-element-interactions).
          Enter e Space acionam a seleção; e.preventDefault() evita scroll no Space.
          role=button num <div> é proposital: o item contém botões — <button> aninhado é inválido. */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <div role="button"
        tabIndex={0}
        onClick={() => onSelect(request)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(request);
          }
        }}
        className={cn(
          "mb-1 p-3 rounded-lg cursor-pointer transition-colors border",
          selectedId === request.id
            ? "bg-accent border-border"
            : "bg-card hover:bg-accent/50 border-transparent",
          isDragging && "opacity-60 shadow-lg",
        )}
      >
        <div className="flex items-start justify-between mb-2 gap-1">
          {/* Handle de arraste discreto. `cursor-grab` + listeners do dnd-kit;
              `stopPropagation` no clique evita selecionar ao só pegar o handle. */}
          <button
            type="button"
            aria-label="Reordenar request"
            className="shrink-0 -ml-1 p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" />
          </button>
          <h3 className="font-medium text-foreground text-sm flex-1 truncate">
            {request.name}
          </h3>
          <Badge
            variant="outline"
            className={cn("ml-2 font-mono text-xs", methodBadgeClass(request.method))}
          >
            {request.method.toUpperCase()}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate mb-2">{request.url}</p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(request.id);
            }}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={handleDuplicate}
            aria-label="Duplicar request"
          >
            <CopyIcon className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(request.id);
            }}
          >
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RequestsList({
  requests,
  scrollRef,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: RequestsListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // `collectionId` não chega por prop (a assinatura pública não pode mudar) —
  // todas as requests da lista são da mesma coleção, então derivamos do
  // primeiro item. `collection_id` existe no modelo `Request` (bindings).
  const collectionId = requests[0]?.collection_id;

  const order = useRequestOrder(collectionId);
  const setOrder = useSetRequestOrder();

  // Ordena as requests recebidas pela ordem persistida (itens sem entrada vão
  // pro fim, na ordem original). Base para o filtro e a virtualização.
  const orderedRequests = useMemo(() => applyOrder(requests, order), [requests, order]);

  // Filtro client-side por nome OU URL OU método (case-insensitive). A
  // virtualização opera sobre `filteredRequests`, nunca sobre `requests`.
  const [filter, setFilter] = useState("");
  const filteredRequests = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (query === "") return orderedRequests;
    return orderedRequests.filter(
      (request) =>
        request.name.toLowerCase().includes(query) ||
        request.url.toLowerCase().includes(query) ||
        request.method.toLowerCase().includes(query),
    );
  }, [orderedRequests, filter]);

  // Offset da lista dentro do scroll container (o form de criação fica acima
  // quando aberto, deslocando a lista). useLayoutEffect aqui é medição de
  // layout — uso legítimo, distinto dos effects de data-fetching/sync removidos.
  // Sem array de deps de propósito: precisa re-medir a cada commit (o form
  // pode abrir/fechar). O setState é guardado, então só re-renderiza quando o
  // offset realmente muda — não há loop nem render redundante.
  const [scrollMargin, setScrollMargin] = useState(0);
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const next = listRef.current?.offsetTop ?? 0;
    setScrollMargin((prev) => (prev === next ? prev : next));
  });

  const virtualizer = useVirtualizer({
    count: filteredRequests.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 96,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => filteredRequests[index].id,
  });

  // dnd-kit: só ativa o arrasto após mover ~6px, para o handle ainda aceitar
  // cliques (e não roubar gestos de scroll/toque da sidebar).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Enquanto arrasta, desligamos o filtro de exibição (ordenar com a lista
  // filtrada produziria uma ordem parcial ao persistir). O `SortableContext`
  // recebe os ids da lista COMPLETA ordenada — assim o dnd-kit calcula
  // deslocamentos corretos mesmo com a virtualização renderizando só uma
  // janela de itens.
  const [isDragging, setIsDragging] = useState(false);
  const dndItems = useMemo(
    () => orderedRequests.map((r) => r.id),
    [orderedRequests],
  );

  function handleDragStart() {
    setIsDragging(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id || !collectionId) return;

    const oldIndex = dndItems.indexOf(String(active.id));
    const newIndex = dndItems.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    // Move o id arrastado para a nova posição na lista COMPLETA e persiste.
    const next = [...dndItems];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    setOrder(collectionId, next);
  }

  // Empty state original: não há nenhuma request criada ainda.
  if (requests.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p>Nenhuma request ainda. Crie a primeira!</p>
      </div>
    );
  }

  return (
    <div>
      {/* Campo de busca/filtro acima da área virtualizada. Desabilitado
          durante o arrasto: reordenar uma lista filtrada persistiria ordem
          parcial. */}
      <div className="relative mb-2">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar requests…"
          className="pl-9"
          disabled={isDragging}
        />
      </div>

      {/* Estado vazio próprio: há requests, mas nenhuma corresponde ao filtro. */}
      {filteredRequests.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground text-sm">
          <p>Nenhuma request corresponde ao filtro.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setIsDragging(false)}
        >
          {/* O contexto recebe os ids da lista COMPLETA ordenada; mesmo com a
              virtualização montando só uma janela de itens, o dnd-kit consegue
              calcular a reordenação corretamente. */}
          <SortableContext items={dndItems} strategy={verticalListSortingStrategy}>
            <div
              ref={listRef}
              style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const request = filteredRequests[virtualItem.index];
                return (
                  <SortableRequestItem
                    key={virtualItem.key}
                    request={request}
                    index={virtualItem.index}
                    translateY={virtualItem.start - scrollMargin}
                    measureRef={virtualizer.measureElement}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
