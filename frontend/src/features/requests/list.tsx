import { Request } from "../../services/request.service";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";

interface RequestsListProps {
  requests: Request[];
  /** Container de scroll da sidebar (fornecido pelo pai). */
  scrollRef: RefObject<HTMLDivElement | null>;
  selectedId?: string;
  onSelect: (request: Request) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const methodColors: Record<string, string> = {
  GET: "bg-green-100 text-green-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-yellow-100 text-yellow-700",
  PATCH: "bg-orange-100 text-orange-700",
  DELETE: "bg-red-100 text-red-700",
};

export default function RequestsList({
  requests,
  scrollRef,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: RequestsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
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
    count: requests.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 96,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => requests[index].id,
  });

  if (requests.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <p>No requests yet. Create your first request!</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      style={{ height: virtualizer.getTotalSize(), position: "relative" }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const request = requests[virtualItem.index];
        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start - scrollMargin}px)`,
            }}
          >
            <div
              onClick={() => onSelect(request)}
              className={`mb-1 p-3 rounded-lg cursor-pointer transition-colors ${
                selectedId === request.id
                  ? "bg-blue-100 border border-blue-300"
                  : "bg-white hover:bg-gray-100 border border-transparent"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-800 text-sm flex-1 truncate">
                  {request.name}
                </h3>
                <span
                  className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                    methodColors[request.method.toUpperCase()] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {request.method}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate mb-2">{request.url}</p>
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(request.id);
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(request.id);
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
