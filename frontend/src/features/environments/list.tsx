import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from "@/components/ui";
import { useEnvironments } from "@/hooks/useEnvironments";
import { cn, formatRelative } from "@/lib/utils";
import { Environment } from "@/services/environments.service";
import {
  useSelectedEnvironmentId,
  useSetSelectedEnvironmentId,
} from "@/stores/selected-environment.store";
import { useWorkspacesStore } from "@/stores/workspaces.store";
import { Link } from "@tanstack/react-router";
import {
  ClockIcon,
  EllipsisIcon,
  GlobeIcon,
  PencilIcon,
  PinIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

export type ViewMode = "list" | "grid";

interface EnvironmentsListProps {
  environments: Environment[];
  view: ViewMode;
}

export default function EnvironmentsList({ environments, view }: EnvironmentsListProps) {
  const gridClasses =
    view === "list"
      ? "grid-cols-1"
      : "[grid-template-columns:repeat(auto-fill,minmax(min(15rem,100%),1fr))]";

  return (
    <div className={cn("grid w-full gap-4 sm:gap-5 md:gap-6", gridClasses)}>
      {environments.map((environment) => (
        <EnvironmentItem key={environment.id} environment={environment} view={view} />
      ))}
    </div>
  );
}

const EnvironmentItem = ({
  environment,
  view,
}: {
  environment: Environment;
  view: ViewMode;
}) => {
  const { deleteEnvironment } = useEnvironments();
  // A seleção de ambiente é por workspace ativo — mesmo modelo do sidebar compacto.
  const workspaceId = useWorkspacesStore((s) => s.activeId) ?? "";
  const selectedId = useSelectedEnvironmentId(workspaceId);
  const setSelectedEnvironmentId = useSetSelectedEnvironmentId();

  const isActive = selectedId === environment.id;
  const count = Object.keys(environment.variables ?? {}).length;
  const description = environment.description?.trim() || "Sem descrição";
  // updated_at pode faltar em ambientes antigos (soft migration do YAML).
  const stamp = environment.updated_at || environment.created_at;
  const updatedLabel = stamp ? formatRelative(stamp) : "Sem data";

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteEnvironment(environment.id);
    toast.success("Ambiente removido");
  };

  const cardClass = cn(
    "group/env relative overflow-hidden bg-background transition-[border-color,box-shadow,background-color] duration-200 hover:border-foreground/15 hover:bg-accent/20",
    isActive && "border-primary",
    environment.deprecated && "opacity-70",
  );

  // O clique no switch não pode propagar para o Link do card (navegação). O
  // onClick fica no próprio Switch (elemento interativo) — wrapper <span> com
  // handler quebraria a11y (click sem teclado em elemento não-interativo).
  const toggle = (
    <Switch
      checked={isActive}
      aria-label={isActive ? "Desativar ambiente" : "Ativar ambiente"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onCheckedChange={(v) =>
        setSelectedEnvironmentId(v ? environment.id : null, workspaceId)
      }
    />
  );

  const meta = (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <ClockIcon className="size-3 shrink-0 opacity-70" aria-hidden />
      <span>{updatedLabel}</span>
      <span aria-hidden>·</span>
      <span>
        {count} {count === 1 ? "variável" : "variáveis"}
      </span>
    </p>
  );

  const badges = (
    <div className="flex shrink-0 items-center gap-1.5">
      {environment.pinned ? (
        <PinIcon className="size-3.5 fill-current text-info" aria-label="Fixado" />
      ) : null}
      {isActive ? (
        <Badge variant="outline" className="border-primary text-primary">
          Ativo
        </Badge>
      ) : null}
      {environment.deprecated ? (
        <Badge variant="outline" className="text-muted-foreground">
          Depreciado
        </Badge>
      ) : null}
    </div>
  );

  const menu = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover/env:opacity-100"
          aria-label="Ações do ambiente"
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
          to="/panel/environments/$environmentId/update"
          params={{ environmentId: environment.id }}
        >
          <PencilIcon className="size-4" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="justify-start gap-2 text-destructive hover:text-destructive"
          aria-label="Remover ambiente"
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
        to="/panel/environments/$environmentId/update"
        params={{ environmentId: environment.id }}
      >
        <Card className={cardClass}>
          <div className="flex items-center gap-4 p-4 pl-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted/40 text-muted-foreground">
              <GlobeIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <CardTitle className="truncate text-base">{environment.name}</CardTitle>
                {badges}
              </div>
              <CardDescription className="line-clamp-1 text-sm">
                {description}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {meta}
              {toggle}
              {menu}
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link
      to="/panel/environments/$environmentId/update"
      params={{ environmentId: environment.id }}
    >
      <Card className={cn(cardClass, "flex h-full flex-col")}>
        <div className="relative flex h-28 items-center justify-center overflow-hidden border-b border-border/50 bg-muted/30">
          <GlobeIcon className="size-10 text-muted-foreground" />
          <div className="absolute top-2 right-2">{menu}</div>
          <div className="absolute top-2 left-2 flex items-center gap-2">
            {badges}
            {toggle}
          </div>
        </div>
        <CardHeader className="space-y-1.5 pt-4 pb-2">
          <CardTitle className="truncate text-base">{environment.name}</CardTitle>
          <CardDescription className="line-clamp-2 min-h-10 text-sm leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto p-4 pt-2">{meta}</CardFooter>
      </Card>
    </Link>
  );
};
