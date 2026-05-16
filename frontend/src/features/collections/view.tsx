import Folder from "@/components/functional/folder";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
   * Aplica busca textual, filtro de status e ordenação sobre a lista já
   * carregada no store (filtragem é client-side; nada vai ao backend).
   * Coleções fixadas vêm sempre antes das demais (intenção do produto).
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
      // recent: mais recém-atualizada primeiro
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

  const gridClasses =
    view === "list"
      ? "grid-cols-1"
      : "[grid-template-columns:repeat(auto-fill,minmax(min(15rem,100%),1fr))]";

  return (
    <Container className="p-6">
      <Column>
        <Row className="justify-between items-center">
          <Title>Coleções</Title>
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
              <UploadIcon className="w-4 h-4" />
              Importar
            </Button>
            <Button type="link" to="/panel/collections/create">
              <PlusIcon className="w-4 h-4" />
              Criar coleção
            </Button>
          </Row>
        </Row>

        {/* Barra de controles: busca, filtro de status, ordenação e modo de exibição */}
        <Row className="flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou descrição"
              aria-label="Buscar coleções"
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
            <SelectTrigger className="w-44" aria-label="Ordenar coleções">
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
            <p className="text-sm font-medium">Nenhuma coleção encontrada</p>
            <p className="text-xs text-muted-foreground">
              Ajuste a busca ou os filtros para ver mais resultados.
            </p>
          </div>
        ) : (
          <div className={cn("grid w-full gap-4 sm:gap-5 md:gap-6", gridClasses)}>
            {visible.map((collection) => (
              <CollectionItem key={collection.id} collection={collection} view={view} />
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
    "group/collection relative overflow-hidden bg-background transition-[border-color,box-shadow,background-color] duration-200 hover:border-foreground/15 hover:bg-accent/20",
    collection.deprecated && "opacity-70",
  );

  const badges = (
    <div className="flex shrink-0 items-center gap-1.5">
      {collection.pinned ? (
        <PinIcon className="size-3.5 fill-current text-info" aria-label="Fixada" />
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
      <span aria-hidden>·</span>
      <span>{collection.request_count} requests</span>
    </p>
  );

  const menu = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover/collection:opacity-100"
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
          <div className="flex items-center gap-4 p-4 pl-5">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md">
              <Folder
                option={collection.bg}
                className="absolute top-0 left-0 origin-top-left scale-[0.273]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <CardTitle className="truncate text-base">{collection.name}</CardTitle>
                {badges}
              </div>
              <CardDescription className="line-clamp-1 text-sm">
                {description}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {meta}
              {menu}
            </div>
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
        <div className="relative flex h-28 items-center justify-center overflow-hidden border-b border-border/50 bg-muted/30">
          <Folder option={collection.bg} className="scale-[0.62]" />
          <div className="absolute top-2 right-2">{menu}</div>
          {(collection.pinned || collection.deprecated) && (
            <div className="absolute top-2 left-2">{badges}</div>
          )}
        </div>
        <CardHeader className="space-y-1.5 pt-4 pb-2">
          <CardTitle className="truncate text-base">{collection.name}</CardTitle>
          <CardDescription className="line-clamp-2 min-h-10 text-sm leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto p-4 pt-2">{meta}</CardFooter>
      </Card>
    </Link>
  );
};
