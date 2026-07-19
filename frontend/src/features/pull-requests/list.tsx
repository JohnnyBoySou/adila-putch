import { ErrorAlert } from "@/components/functional/error-alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Column,
  Container,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Label,
  Row,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Title,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePullRequests } from "@/hooks/usePullRequests";
import type { PrStateFilter } from "@/stores/pull-requests.store";
import { useNavigate } from "@tanstack/react-router";
import { GitPullRequest, Plus } from "lucide-react";
import { useState } from "react";

// GitHub serializa timestamps como string ISO; formata defensivamente para pt-BR.
function formatDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
}

const FILTER_LABEL: Record<PrStateFilter, string> = {
  open: "Abertos",
  closed: "Fechados",
  all: "Todos",
};

// Cor do badge de estado: aberto destaca, fechado fica neutro.
function stateBadge(state: string, draft: boolean) {
  if (draft) return { variant: "outline" as const, label: "rascunho" };
  if (state === "closed") return { variant: "secondary" as const, label: "fechado" };
  return { variant: "default" as const, label: "aberto" };
}

export default function PullRequestsList() {
  const { list, stateFilter, loading, busy, error, setFilter, createPr } = usePullRequests();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  return (
    <Container className="gap-4 p-4">
      <Row className="items-center justify-between">
        <Row className="items-center gap-2">
          <GitPullRequest strokeWidth={1.5} className="size-5" />
          <Title>Pull Requests</Title>
        </Row>
        <Row className="items-center gap-2">
          <Select value={stateFilter} onValueChange={(v) => setFilter(v as PrStateFilter)}>
            <SelectTrigger className="w-36" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTER_LABEL) as PrStateFilter[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {FILTER_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus strokeWidth={1.5} />
            Novo PR
          </Button>
        </Row>
      </Row>

      {error && <ErrorAlert message={error} />}

      {loading ? (
        <Column className="gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </Column>
      ) : list.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nenhum pull request</EmptyTitle>
            <EmptyDescription>
              Não há PRs {FILTER_LABEL[stateFilter].toLowerCase()} neste repositório. Crie um a
              partir da sua branch atual.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Column className="gap-2">
          {list.map((pr) => {
            const badge = stateBadge(pr.state, pr.draft);
            return (
              <button
                key={pr.number}
                type="button"
                aria-label={`Abrir pull request #${pr.number}: ${pr.title}`}
                onClick={() =>
                  navigate({
                    to: "/panel/git/pull-requests/$number",
                    params: { number: String(pr.number) },
                  })
                }
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-foreground/30 hover:bg-accent/40"
              >
                <Row className="items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">
                    <span className="text-muted-foreground">#{pr.number}</span> {pr.title}
                  </span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </Row>
                <Row className="items-center gap-2 text-xs text-muted-foreground">
                  <Avatar className="size-5">
                    <AvatarImage src={pr.avatarUrl} alt={pr.author} />
                    <AvatarFallback>{pr.author.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{pr.author}</span>
                  <span className="text-border">·</span>
                  <span className="truncate font-mono">
                    {pr.base} ← {pr.head}
                  </span>
                  <span className="text-border">·</span>
                  <span>{formatDate(pr.updatedAt)}</span>
                </Row>
              </button>
            );
          })}
        </Column>
      )}

      <CreatePrDialog
        open={creating}
        onOpenChange={setCreating}
        busy={busy}
        onCreate={async (base, head, title, body) => {
          const number = await createPr(base, head, title, body);
          setCreating(false);
          if (number != null) {
            navigate({
              to: "/panel/git/pull-requests/$number",
              params: { number: String(number) },
            });
          }
        }}
      />
    </Container>
  );
}

interface CreatePrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onCreate: (base: string, head: string, title: string, body: string) => Promise<void>;
}

function CreatePrDialog({ open, onOpenChange, busy, onCreate }: CreatePrDialogProps) {
  const [base, setBase] = useState("main");
  const [head, setHead] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const canSubmit = base.trim() !== "" && title.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo pull request</DialogTitle>
        </DialogHeader>
        <Column className="gap-3">
          <Column className="gap-1.5">
            <Label>Branch de destino (base)</Label>
            <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="main" />
          </Column>
          <Column className="gap-1.5">
            <Label>Branch de origem (head)</Label>
            <Input
              value={head}
              onChange={(e) => setHead(e.target.value)}
              placeholder="deixe vazio para a branch atual"
            />
          </Column>
          <Column className="gap-1.5">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumo das mudanças"
            />
          </Column>
          <Column className="gap-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="O que mudou e por quê"
              rows={4}
            />
          </Column>
        </Column>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => onCreate(base, head, title, body)} disabled={!canSubmit || busy}>
            Criar PR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
