import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  FlaskConical,
  Folder,
  GitBranch,
  Globe,
  History,
  Layers,
  Plus,
  SearchIcon,
  Settings,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";

/**
 * Paleta de comandos global (⌘K / Ctrl+K). Permite navegar entre as
 * páginas e disparar ações de criação rapidamente sem usar o mouse.
 */
export default function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // `strict: false`: lê params da rota ativa sem amarrar a um id de rota.
  // `collectionId` só existe sob /panel/collections/$collectionId/* — fora
  // disso o comando "Nova request" não aparece (precisa de uma coleção alvo).
  const { collectionId } = useParams({ strict: false });

  // Atalho global para abrir/fechar a paleta
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fecha a paleta antes de executar a ação selecionada
  const runCommand = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ["--wails-draggable" as string]: "no-drag" }}
        className="flex h-7 w-56 items-center gap-2 rounded-md border border-border bg-muted/40 px-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
        title="Paleta de comandos (⌘K)"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Buscar ou ir para…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Paleta de comandos"
        description="Busque por uma página ou ação"
      >
        <CommandInput placeholder="Buscar página ou ação…" />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          <CommandGroup heading="Navegação">
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/panel/collections" }))}
            >
              <Folder />
              <span>Coleções</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/panel/environments" }))}
            >
              <Globe />
              <span>Environments</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/panel/tests" }))}>
              <FlaskConical />
              <span>Testes</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/panel/history" }))}
            >
              <History />
              <span>Histórico</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/panel/git" }))}>
              <GitBranch />
              <span>Git</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/panel/workspaces" }))}
            >
              <Layers />
              <span>Workspaces</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/panel/settings" }))}
            >
              <Settings />
              <span>Configurações</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Criar">
            {collectionId ? (
              <CommandItem
                onSelect={() =>
                  runCommand(() =>
                    navigate({
                      to: "/panel/collections/$collectionId/requests/create",
                      params: { collectionId },
                    }),
                  )
                }
              >
                <Plus />
                <span>Nova request</span>
                <CommandShortcut>Coleção atual</CommandShortcut>
              </CommandItem>
            ) : null}
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/panel/collections/create" }))}
            >
              <Plus />
              <span>Nova coleção</span>
              <CommandShortcut>Coleções</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/panel/environments/create" }))}
            >
              <Plus />
              <span>Novo environment</span>
              <CommandShortcut>Environments</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => navigate({ to: "/panel/workspaces/create" }))}
            >
              <Plus />
              <span>Novo workspace</span>
              <CommandShortcut>Workspaces</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
