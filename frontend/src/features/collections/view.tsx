import {
  Badge,
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
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
  Title,
} from "@/components/ui";
import { useCollections } from "@/hooks/useCollections";
import { cn, formatRelative } from "@/lib/utils";
import { Collection, CollectionsService } from "@/services/collections.service";
import { Link } from "@tanstack/react-router";
import {
  ClockIcon,
  DownloadIcon,
  EllipsisIcon,
  FolderIcon,
  GridIcon,
  ListIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import CollectionsEmpty from "./empty";
import CollectionsLoading from "./loading";

type ViewMode = "list" | "grid";
type StatusFilter = "all" | "pinned" | "deprecated";
type SortMode = "recent" | "name" | "requests";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pinned", label: "Fixadas" },
  { value: "deprecated", label: "Depreciadas" },
];

export default function CollectionsView() {
  const { collections, loading, importCollection, loadCollections } = useCollections();

  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("recent");

  // Referência para o input oculto de importação de arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Dispara o seletor de arquivo nativo para importar uma coleção */
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  /** Lê o arquivo selecionado, importa via store e recarrega a lista */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limpa o valor para permitir reimportar o mesmo arquivo em seguida
    e.target.value = "";

    try {
      const text = await file.text();
      await importCollection(text);
      // importCollection já recarrega via get().load() internamente;
      // chamada extra só como salvaguarda para garantir estado fresco.
      await loadCollections();
      toast.success("Coleção importada");
    } catch (err) {
      // O store já grava o erro em state.error; nada mais a fazer aqui.
      console.error("Erro ao importar coleção:", err);
      toast.error("Falha ao importar coleção");
    }
  };

  /**
   * Busca textual, filtro de status e ordenação sobre a lista já carregada
   * no store (client-side; nada vai ao backend). Fixadas vêm sempre antes.
   */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = collections.filter((c) => {
      if (status === "pinned" && !c.pinned) return false;
      if (status === "deprecated" && !c.deprecated) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
      );
    });

    const bySort = (a: Collection, b: Collection) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "requests") return b.request_count - a.request_count;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    };

    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return bySort(a, b);
    });
  }, [collections, query, status, sort]);

  if (loading && collections.length === 0) {
    return <CollectionsLoading />;
  }

  if (collections.length === 0) {
    return <CollectionsEmpty />;
  }

  const total = collections.length;

  return (
    <Container className="p-6">
      <Column className="gap-6">
        {/* Cabeçalho: título + subtítulo + ações */}
        <Row className="items-start justify-between gap-4">
          <div className="space-y-1">
            <Title>Coleções</Title>
            <Text className="text-muted-foreground">
              {total} {total === 1 ? "coleção organizada" : "coleções organizadas"} neste workspace.
            </Text>
          </div>
          <Row className="gap-2">
            {/* Input oculto para seleção de arquivo de importação */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,.json"
              className="hidden"
              aria-label="Selecionar arquivo para importar coleção"
              onChange={handleFileChange}
            />
            <Button variant="outline" onClick={handleImportClick}>
              <UploadIcon className="size-4" />
              Importar
            </Button>
            <Button type="link" to="/panel/collections/create">
              <PlusIcon className="size-4" />
              Criar coleção
            </Button>
          </Row>
        </Row>

        {/* Controles: busca à esquerda, cluster de filtro/ordenação/visão à direita */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:max-w-sm lg:flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar coleções"
              aria-label="Buscar coleções"
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
              <SelectTrigger className="w-[150px]" aria-label="Ordenar coleções">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="name">Nome (A–Z)</SelectItem>
                <SelectItem value="requests">Mais requests</SelectItem>
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
            <p className="text-sm font-medium">Nenhuma coleção encontrada</p>
            <p className="text-sm text-muted-foreground">
              Ajuste a busca ou os filtros para ver mais resultados.
            </p>
          </div>
        ) : view === "list" ? (
          <div className="flex flex-col gap-2">
            {visible.map((c) => (
              <CollectionItem key={c.id} collection={c} view="list" />
            ))}
          </div>
        ) : (
          <div className="grid w-full gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(17rem,100%),1fr))]">
            {visible.map((c) => (
              <CollectionItem key={c.id} collection={c} view="grid" />
            ))}
          </div>
        )}
      </Column>
    </Container>
  );
}

const CollectionItem = ({
  collection,
  view,
}: {
  collection: Collection;
  view: ViewMode;
}) => {
  const { deleteCollection } = useCollections();

  const description = collection.description?.trim() || "Sem descrição";
  const updatedLabel = collection.updated_at
    ? formatRelative(collection.updated_at)
    : "Não atualizada";

  /** Exporta a coleção como arquivo YAML via download do browser */
  const handleExport = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const content = await CollectionsService.export(collection.id);
      const blob = new Blob([content], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      // Nome do arquivo deriva do nome da coleção, sanitizado para nome seguro
      anchor.download = `${collection.name.replace(/[^a-zA-Z0-9_\-. ]/g, "_")}.yaml`;
      anchor.click();

      URL.revokeObjectURL(url);
      toast.success("Coleção exportada");
    } catch (err) {
      console.error("Erro ao exportar coleção:", err);
      toast.error("Falha ao exportar coleção");
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteCollection(collection.id);
    toast.success("Coleção removida");
  };

  const cardClass = cn(
    "group/col relative gap-0 overflow-hidden border-border bg-card p-0 transition-colors hover:border-foreground/20 hover:bg-accent/30",
    collection.deprecated && "opacity-65",
  );

  const icon = (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/50 text-muted-foreground">
      <FolderIcon className="size-5" />
    </span>
  );

  const titleRow = (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate font-semibold leading-none tracking-tight">
        {collection.name}
      </span>
      {collection.pinned ? (
        <PinIcon className="size-3.5 shrink-0 fill-current text-info" aria-label="Fixada" />
      ) : null}
      {collection.deprecated ? (
        <Badge variant="outline" className="text-muted-foreground">
          Depreciada
        </Badge>
      ) : null}
    </div>
  );

  const meta = (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <ClockIcon className="size-3 shrink-0 opacity-70" aria-hidden />
      <span>{updatedLabel}</span>
      <span aria-hidden className="opacity-50">
        ·
      </span>
      <span>{collection.request_count} requests</span>
    </p>
  );

  const menu = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/col:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label="Ações da coleção"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
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
          to="/panel/collections/$collectionId/update"
          params={{ collectionId: collection.id }}
        >
          <PencilIcon className="size-4" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="justify-start gap-2"
          aria-label="Exportar coleção"
          onClick={handleExport}
        >
          <DownloadIcon className="size-4" />
          Exportar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="justify-start gap-2 text-destructive hover:text-destructive"
          aria-label="Remover coleção"
          onClick={handleDelete}
        >
          <Trash2Icon className="size-4" />
          Excluir
        </Button>
      </PopoverContent>
    </Popover>
  );

  if (view === "list") {
    return (
      <Link
        to="/panel/collections/$collectionId/requests"
        params={{ collectionId: collection.id }}
      >
        <Card className={cardClass}>
          <div className="flex items-center gap-4 p-4">
            {icon}
            <div className="min-w-0 flex-1 space-y-1">
              {titleRow}
              <p className="line-clamp-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="hidden shrink-0 md:block">{meta}</div>
            {menu}
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link
      to="/panel/collections/$collectionId/requests"
      params={{ collectionId: collection.id }}
    >
      <Card className={cn(cardClass, "flex h-full flex-col")}>
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          {icon}
          {menu}
        </div>
        <div className="flex-1 space-y-1.5 px-4">
          {titleRow}
          <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="mt-4 border-t border-border/60 p-4">{meta}</div>
      </Card>
    </Link>
  );
};
