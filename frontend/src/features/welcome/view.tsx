import Logo from "@/components/functional/logo";
import {
  Button,
  Card,
  CardContent,
  Column,
  Container,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Row,
  Text,
  Title,
} from "@/components/ui";
import { useCollections } from "@/hooks/useCollections";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useSync } from "@/hooks/useSync";
import { useTests } from "@/hooks/useTests";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useRouter } from "@tanstack/react-router";
import {
  FlaskConical,
  FolderOpen,
  GitBranch,
  Globe,
  LayoutGrid,
  PinIcon,
  Plus,
  Send,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export default function WelcomeView() {
  const { clone, busy, error } = useSync();
  const { workspaces, activeId, setActiveWorkspace } = useWorkspaces();
  const { collections, importCollection } = useCollections();
  const { environments } = useEnvironments();
  const { tests } = useTests();
  const router = useRouter();

  const [gitUrl, setGitUrl] = useState("");
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestTotal = collections.reduce((n, c) => n + (c.request_count ?? 0), 0);

  const handleClone = async () => {
    const url = gitUrl.trim();
    if (!url) return;
    try {
      await clone(url);
      setGitUrl("");
      setCloneDialogOpen(false);
    } catch {
      /* erro exposto em `error` do store */
    }
  };

  // Ativa o workspace clicado (se ainda não for o ativo), revalida os loaders
  // — que ficam no escopo do workspace ativo — e leva às coleções.
  const handleOpenWorkspace = async (id: string) => {
    if (id !== activeId) {
      await setActiveWorkspace(id);
      await router.invalidate();
    }
    router.navigate({ to: "/panel/collections" });
  };

  const runImport = async (file: File) => {
    setImporting(true);
    try {
      const content = await file.text();
      const imported = await importCollection(content);
      toast.success(`Coleção "${imported.name}" importada`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao importar coleção");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Container className="flex min-h-svh flex-col px-4 py-10">
      <Column className="mx-auto w-full max-w-3xl gap-8">
        <Column className="items-center justify-center">
          <Logo className="h-24 w-24" />
          <Title className="text-center">Bem-vindo ao Putch</Title>
          <Label className="text-center">
            Teste APIs com Putch, rápido, organizado e produtivo.
          </Label>
        </Column>

        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Row className="gap-2">
          <Button
            type="link"
            to="/panel/workspaces/create"
            variant="default"
            className="w-full h-12"
          >
            Criar Workspace
            <Plus size={16} />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full h-12"
            onClick={() => setCloneDialogOpen(true)}
          >
            Clonar repositório
            <GitBranch size={16} />
          </Button>
        </Row>

        {workspaces.length > 0 ? (
          <Column className="gap-3">
            <Text className="text-sm font-medium text-muted-foreground">Seus workspaces</Text>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeId;
                return (
                  <Card key={ws.id} className={isActive ? "border-primary" : ""}>
                    <button
                      type="button"
                      onClick={() => void handleOpenWorkspace(ws.id)}
                      className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
                    >
                      {ws.color ? (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: ws.color }}
                          aria-hidden
                        />
                      ) : null}
                      {ws.icon ? <span aria-hidden>{ws.icon}</span> : null}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {ws.name}
                      </span>
                      {ws.pinned ? (
                        <PinIcon className="h-3.5 w-3.5 shrink-0 fill-current text-info" />
                      ) : null}
                      {isActive ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Ativo
                        </span>
                      ) : null}
                    </button>
                  </Card>
                );
              })}
            </div>
          </Column>
        ) : null}

        {activeId ? (
          <Column className="gap-3">
            <Text className="text-sm font-medium text-muted-foreground">Resumo do ativo</Text>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryStat icon={FolderOpen} label="Coleções" value={collections.length} />
              <SummaryStat icon={Send} label="Requests" value={requestTotal} />
              <SummaryStat icon={Globe} label="Environments" value={environments.length} />
              <SummaryStat icon={FlaskConical} label="Testes" value={tests.length} />
            </div>
          </Column>
        ) : null}

        <Column className="gap-3">
          <Text className="text-sm font-medium text-muted-foreground">Acesso rápido</Text>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button type="link" to="/panel/collections" variant="outline" className="h-11">
              <FolderOpen size={16} />
              Coleções
            </Button>
            <Button type="link" to="/panel/environments" variant="outline" className="h-11">
              <Globe size={16} />
              Environments
            </Button>
            <Button type="link" to="/panel/tests" variant="outline" className="h-11">
              <FlaskConical size={16} />
              Testes
            </Button>
            <Button type="link" to="/panel/collections/create" variant="outline" className="h-11">
              <Plus size={16} />
              Nova coleção
            </Button>
          </div>
        </Column>

        <Column className="gap-3">
          <Text className="text-sm font-medium text-muted-foreground">Importar coleção</Text>
          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Text className="text-sm font-medium">Importar de um ficheiro JSON</Text>
                <Text className="text-xs text-muted-foreground">
                  Selecione uma coleção exportada para adicioná-la ao workspace ativo.
                </Text>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                aria-label="Ficheiro JSON da coleção"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void runImport(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0"
              >
                <Upload size={16} />
                {importing ? "A importar…" : "Escolher ficheiro"}
              </Button>
            </CardContent>
          </Card>
        </Column>
      </Column>

      <Dialog
        open={cloneDialogOpen}
        onOpenChange={(open) => {
          setCloneDialogOpen(open);
          if (!open) setGitUrl("");
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Clonar de Git</DialogTitle>
            <DialogDescription>
              Indica a URL do repositório. O conteúdo será descarregado para o diretório local do
              workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              aria-label="URL do repositório Git"
              placeholder="https://github.com/org/repo.git"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleClone();
              }}
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={busy || !gitUrl.trim()}
              onClick={() => void handleClone()}
            >
              {busy ? "A clonar…" : "Clonar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof LayoutGrid;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
