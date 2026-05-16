import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Container,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Label,
  Row,
  Title,
} from "@/components/ui";
import { ErrorAlert } from "@/components/functional/error-alert";
import { cn } from "@/lib/utils";
import {
  type HistoryEntry,
  useHistory,
  useHistoryActions,
} from "@/stores/history.store";
import { ChevronDownIcon, HistoryIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

/** Formata duração em ms para "123 ms" ou "1.23 s". */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Tempo relativo simples em pt-br a partir de um timestamp (Date.now()). */
function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "agora mesmo";
  if (sec < 60) return `há ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `há ${years} ${years === 1 ? "ano" : "anos"}`;
}

/** Classe de cor do status: verde 2xx/3xx, vermelho 4xx/5xx, neutro em erro. */
function statusClass(entry: HistoryEntry): string {
  if (entry.status === 0 || entry.error) return "text-muted-foreground";
  if (entry.status >= 200 && entry.status < 400) return "text-success";
  return "text-destructive";
}

export default function HistoryView() {
  const entries = useHistory();
  const { remove, clear } = useHistoryActions();

  return (
    <Container className="p-6 space-y-6">
      <Row className="justify-between items-center">
        <Title>Histórico</Title>
        {entries.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2Icon className="w-4 h-4" />
                Limpar histórico
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar histórico?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as execuções registradas serão removidas. Esta ação não
                  pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => clear()}>
                  Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </Row>

      {entries.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma requisição ainda</EmptyTitle>
            <EmptyDescription>
              As requisições enviadas pelo editor aparecem aqui para você
              revisitar respostas, headers e duração.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <HistoryItem key={entry.id} entry={entry} onRemove={remove} />
          ))}
        </div>
      )}
    </Container>
  );
}

const HistoryItem = ({
  entry,
  onRemove,
}: {
  entry: HistoryEntry;
  onRemove: (id: string) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-border"
    >
      <div className="flex items-center gap-3 p-3">
        <CollapsibleTrigger className="flex flex-1 items-center gap-3 overflow-hidden text-left">
          <ChevronDownIcon
            className={cn(
              "w-4 h-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
          <Badge variant="outline" className="shrink-0 uppercase">
            {entry.method}
          </Badge>
          <span className="flex-1 truncate text-sm" title={entry.url}>
            {entry.url}
          </span>
          <span
            className={cn(
              "shrink-0 text-sm font-medium tabular-nums",
              statusClass(entry),
            )}
          >
            {entry.status === 0 ? "ERRO" : entry.status}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatDuration(entry.durationMs)}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelative(entry.timestamp)}
          </span>
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(entry.id)}
          title="Remover do histórico"
        >
          <Trash2Icon className="w-3 h-3" />
        </Button>
      </div>

      <CollapsibleContent>
        <div className="space-y-4 border-t border-border p-3">
          {entry.error && <ErrorAlert message={entry.error} />}

          <HeadersBlock title="Request headers" headers={entry.requestHeaders} />

          {entry.requestBody && (
            <BodyBlock title="Request body" body={entry.requestBody} />
          )}

          <HeadersBlock
            title="Response headers"
            headers={entry.responseHeaders}
          />

          {entry.responseBody && (
            <BodyBlock title="Response body" body={entry.responseBody} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const HeadersBlock = ({
  title,
  headers,
}: {
  title: string;
  headers: Record<string, string>;
}) => {
  const items = Object.entries(headers ?? {});
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">
        {title}
      </Label>
      <div className="rounded border border-border bg-muted/40 p-2 text-xs">
        {items.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="shrink-0 font-medium">{k}:</span>
            <span className="break-all text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const BodyBlock = ({ title, body }: { title: string; body: string }) => (
  <div className="space-y-1">
    <Label className="text-xs font-medium text-muted-foreground">{title}</Label>
    <pre className="max-h-72 overflow-auto rounded border border-border bg-muted/40 p-2 text-xs whitespace-pre-wrap break-all">
      {body}
    </pre>
  </div>
);
