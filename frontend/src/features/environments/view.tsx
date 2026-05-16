import { ErrorAlert } from "@/components/functional/error-alert";
import {
  Column,
  Container,
  Input,
  Row,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  Title,
  Button,
} from "@/components/ui";
import { useEnvironments } from "@/hooks/useEnvironments";
import { Environment } from "@/services/enviroments.service";
import { useSelectedEnvironmentId } from "@/stores/selected-environment.store";
import { useWorkspacesStore } from "@/stores/workspaces.store";
import { GridIcon, ListIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import EnvironmentsEmpty from "./empty";
import EnvironmentsList, { type ViewMode } from "./list";
import EnvironmentsLoading from "./loading";

type StatusFilter = "all" | "active" | "empty";
type SortMode = "recent" | "name" | "vars";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativo" },
  { value: "empty", label: "Vazios" },
];

export default function EnvironmentsView() {
  const { environments, loading, error } = useEnvironments();

  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("recent");

  // O ambiente ativo é por workspace — mesma fonte de verdade do sidebar.
  const workspaceId = useWorkspacesStore((s) => s.activeId) ?? "";
  const selectedId = useSelectedEnvironmentId(workspaceId);

  /**
   * Busca textual, filtro de status e ordenação client-side sobre a lista já
   * carregada no store. O ambiente ativo vem sempre antes dos demais.
   */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = environments.filter((e) => {
      const count = Object.keys(e.variables ?? {}).length;
      if (status === "active" && e.id !== selectedId) return false;
      if (status === "empty" && count > 0) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q);
    });

    const bySort = (a: Environment, b: Environment) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "vars") {
        return (
          Object.keys(b.variables ?? {}).length - Object.keys(a.variables ?? {}).length
        );
      }
      // recent: criado mais recentemente primeiro
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    };

    return [...filtered].sort((a, b) => {
      const aActive = a.id === selectedId;
      const bActive = b.id === selectedId;
      if (aActive !== bActive) return aActive ? -1 : 1;
      return bySort(a, b);
    });
  }, [environments, query, status, sort, selectedId]);

  if (loading && environments.length === 0) {
    return <EnvironmentsLoading />;
  }

  if (environments.length === 0) {
    return <EnvironmentsEmpty />;
  }

  return (
    <Container className="p-6">
      <Column>
        <Row className="justify-between items-center">
          <Title>Variáveis de ambiente</Title>
          <Button type="link" to="/panel/environments/create">
            <PlusIcon className="w-4 h-4" />
            Criar ambiente
          </Button>
        </Row>

        {error && <ErrorAlert message={error} />}

        {/* Barra de controles: busca, filtro de status, ordenação e modo de exibição */}
        <Row className="flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome"
              aria-label="Buscar ambientes"
              className="pl-9"
            />
          </div>

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
            <SelectTrigger className="w-44" aria-label="Ordenar ambientes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="name">Nome (A–Z)</SelectItem>
              <SelectItem value="vars">Mais variáveis</SelectItem>
            </SelectContent>
          </Select>

          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="list" aria-label="Visualizar em lista">
                <ListIcon className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="grid" aria-label="Visualizar em grade">
                <GridIcon className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Row>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium">Nenhum ambiente encontrado</p>
            <p className="text-xs text-muted-foreground">
              Ajuste a busca ou os filtros para ver mais resultados.
            </p>
          </div>
        ) : (
          <EnvironmentsList environments={visible} view={view} />
        )}
      </Column>
    </Container>
  );
}
