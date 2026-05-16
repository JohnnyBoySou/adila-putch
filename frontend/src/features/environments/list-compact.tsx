import {
  useSelectedEnvironmentId,
  useSetSelectedEnvironmentId,
} from "@/stores/selected-environment.store";
import { Environment } from "../../services/enviroments.service";
import { Button } from "@/components/ui/button";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";

interface EnvironmentsListCompactProps {
  environments: Environment[];
  workspaceId: string;
  /** Container de scroll da sidebar (fornecido pelo pai). */
  scrollRef: RefObject<HTMLDivElement | null>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function EnvironmentsListCompact({
  environments,
  workspaceId,
  scrollRef,
  onEdit,
  onDelete,
}: EnvironmentsListCompactProps) {
  const currentSelectedId = useSelectedEnvironmentId(workspaceId);
  const setSelectedEnvironmentId = useSetSelectedEnvironmentId();

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
    count: environments.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 58,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => environments[index].id,
  });

  if (environments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <p>Nenhum environment ainda. Crie o primeiro!</p>
      </div>
    );
  }

  return (
    <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const environment = environments[virtualItem.index];
        const isActive = currentSelectedId === environment.id;
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
            {/* role=button proposital: o card contém botões Editar/Excluir — <button> aninhado é HTML inválido */}
            {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
            <div role="button"
              tabIndex={0}
              aria-label={`${isActive ? "Desativar" : "Ativar"} environment ${environment.name}`}
              aria-pressed={isActive}
              className={`mb-1 p-2 rounded cursor-pointer transition-colors border ${
                isActive
                  ? "bg-accent border-border"
                  : "hover:bg-accent/50 border-transparent"
              }`}
              onClick={() =>
                setSelectedEnvironmentId(isActive ? null : environment.id, workspaceId)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedEnvironmentId(isActive ? null : environment.id, workspaceId);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {environment.name}
                    </h3>
                    {isActive && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                        Ativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {Object.keys(environment.variables).length} variável(is)
                  </p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(environment.id);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(environment.id);
                    }}
                    aria-label="Excluir environment"
                  >
                    ×
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
