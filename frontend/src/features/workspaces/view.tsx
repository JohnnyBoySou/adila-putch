import { ErrorAlert } from "@/components/functional/error-alert";
import {
  Button,
  Card,
  Column,
  Container,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Row,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
  Title,
} from "@/components/ui";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { cn, formatRelative } from "@/lib/utils";
import { Workspace } from "@/services/workspaces.service";
import {
  ClockIcon,
  EllipsisIcon,
  GridIcon,
  ListIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ViewMode = "list" | "grid";
type StatusFilter = "all" | "pinned" | "active";
type SortMode = "recent" | "name" | "created";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pinned", label: "Fixados" },
  { value: "active", label: "Ativo" },
];

export default function WorkspacesView() {
  const { workspaces, activeId, error } = useWorkspaces();

  const [view, setView] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("recent");

  /**
   * Busca textual, filtro de status e ordenação sobre a lista já carregada
   * no store (client-side; nada vai ao backend). Fixados vêm sempre antes.
   */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = workspaces.filter((ws) => {
      if (status === "pinned" && !ws.pinned) return false;
      if (status === "active" && ws.id !== activeId) return false;
      if (!q) return true;
      return (
        ws.name.toLowerCase().includes(q) ||
        (ws.description ?? "").toLowerCase().includes(q)
      );
    });

    const bySort = (a: Workspace, b: Workspace) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "created")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    };

    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return bySort(a, b);
    });
  }, [workspaces, activeId, query, status, sort]);

  const total = workspaces.length;

  return (
    <Container className="p-6">
      <Column className="gap-6">
        {/* Cabeçalho: título + subtítulo + ação */}
        <Row className="items-start justify-between gap-4">
          <div className="space-y-1">
            <Title>Workspaces</Title>
            <Text className="text-muted-foreground">
              {total} {total === 1 ? "workspace disponível" : "workspaces disponíveis"}.
            </Text>
          </div>
          <Button type="link" to="/panel/workspaces/create">
            <PlusIcon className="size-4" />
            Criar workspace
          </Button>
        </Row>

        {error && <ErrorAlert message={error} />}

        {/* Controles: busca à esquerda, cluster de filtro/ordenação/visão à direita */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:max-w-sm lg:flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar workspaces"
              aria-label="Buscar workspaces"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <TabsList>
                {STATUS_FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <SelectTrigger className="w-[150px]" aria-label="Ordenar workspaces">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="name">Nome (A–Z)</SelectItem>
                <SelectItem value="created">Recém-criados</SelectItem>
              </SelectContent>
            </Select>

            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="list" aria-label="Visualizar em lista">
                  <ListIcon className="size-4" />
                </TabsTrigger>
                <TabsTrigger value="grid" aria-label="Visualizar em grade">
                  <GridIcon className="size-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border py-20 text-center">
            <p className="text-sm font-medium">Nenhum workspace encontrado</p>
            <p className="text-sm text-muted-foreground">
              Ajuste a busca ou os filtros para ver mais resultados.
            </p>
          </div>
        ) : view === "list" ? (
          <div className="flex flex-col gap-2">
            {visible.map((ws) => (
              <WorkspaceItem key={ws.id} ws={ws} view="list" />
            ))}
          </div>
        ) : (
          <div className="grid w-full gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(17rem,100%),1fr))]">
            {visible.map((ws) => (
              <WorkspaceItem key={ws.id} ws={ws} view="grid" />
            ))}
          </div>
        )}
      </Column>
    </Container>
  );
}

const WorkspaceItem = ({ ws, view }: { ws: Workspace; view: ViewMode }) => {
  const { activeId, setActiveWorkspace, deleteWorkspace } = useWorkspaces();
  const isActive = ws.id === activeId;
  const initial = ws.name.trim().charAt(0).toUpperCase() || "?";
  const description = ws.description?.trim() || "Sem descrição";
  const updatedLabel = ws.updated_at ? formatRelative(ws.updated_at) : "Não atualizado";

  const handleDelete = () => {
    deleteWorkspace(ws.id);
    toast.success("Workspace removido");
  };

  const cardClass = cn(
    "group/ws relative gap-0 overflow-hidden p-0 transition-colors",
    isActive
      ? "border-primary/40 bg-primary/[0.05]"
      : "border-border bg-card hover:border-foreground/20 hover:bg-accent/30",
  );

  // Faixa fina de destaque à esquerda quando o workspace está ativo
  const rail = isActive ? (
    <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" />
  ) : null;

  const avatar = (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg border text-base",
        !ws.color && "border-border/70 bg-muted/50 text-muted-foreground",
      )}
      style={
        ws.color
          ? {
              backgroundColor: `color-mix(in srgb, ${ws.color} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${ws.color} 32%, transparent)`,
            }
          : undefined
      }
      aria-hidden
    >
      {ws.icon ? (
        <span className="leading-none">{ws.icon}</span>
      ) : ws.color ? (
        <span className="size-2.5 rounded-full" style={{ backgroundColor: ws.color }} />
      ) : (
        <span className="text-sm font-semibold">{initial}</span>
      )}
    </span>
  );

  const titleRow = (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate font-semibold leading-none tracking-tight">{ws.name}</span>
      {ws.pinned ? (
        <PinIcon className="size-3.5 shrink-0 fill-current text-info" aria-label="Fixado" />
      ) : null}
      {isActive ? (
        <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          Ativo
        </span>
      ) : null}
    </div>
  );

  const meta = (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <ClockIcon className="size-3 shrink-0 opacity-70" aria-hidden />
      <span>{updatedLabel}</span>
    </p>
  );

  const menu = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/ws:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label="Ações do workspace"
        >
          <EllipsisIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-44 flex-col gap-0 p-1">
        <Button
          size="sm"
          variant="ghost"
          type="link"
          className="justify-start gap-2"
          to="/panel/workspaces/$workspaceId/update"
          params={{ workspaceId: ws.id }}
        >
          <PencilIcon className="size-4" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="justify-start gap-2 text-destructive hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2Icon className="size-4" />
          Excluir
        </Button>
      </PopoverContent>
    </Popover>
  );

  const activeSwitch = (
    <Switch
      checked={isActive}
      onCheckedChange={() => setActiveWorkspace(ws.id)}
      aria-label="Definir como workspace ativo"
    />
  );

  if (view === "list") {
    return (
      <Card className={cardClass}>
        {rail}
        <div className="flex items-center gap-4 p-4">
          {avatar}
          <div className="min-w-0 flex-1 space-y-1">
            {titleRow}
            <p className="line-clamp-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="hidden shrink-0 md:block">{meta}</div>
          {menu}
          <span aria-hidden className="h-5 w-px bg-border" />
          {activeSwitch}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(cardClass, "flex h-full flex-col")}>
      {rail}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        {avatar}
        {menu}
      </div>
      <div className="flex-1 space-y-1.5 px-4">
        {titleRow}
        <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 p-4">
        {meta}
        {activeSwitch}
      </div>
    </Card>
  );
};
