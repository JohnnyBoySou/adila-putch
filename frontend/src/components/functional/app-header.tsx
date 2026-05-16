import CommandMenu from "@/components/functional/command-menu";
import Logo from "@/components/functional/logo";
import WindowControls from "@/components/functional/window-controls";
import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Window } from "@wailsio/runtime";
import { useNavigate } from "@tanstack/react-router";

const NO_DRAG = { ["--wails-draggable" as string]: "no-drag" };

// Header na MESMA camada do sidebar: a faixa esquerda fica sobre o sidebar e
// acompanha sua largura (expandido ↔ recolhido). É montado dentro do
// SidebarProvider (panel/-layout.tsx) para ter acesso ao `useSidebar()`.
export default function AppHeader() {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // Reaproveita o atalho global do CommandMenu (escuta keydown no document)
  const openCommandMenu = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    // A header inteira é uma drag region (frameless window). Zonas
    // interativas (menubar, trigger, command, controles) resetam no-drag.
    <header
      style={{ ["--wails-draggable" as string]: "drag" }}
      className="flex h-12 w-full shrink-0 items-center border-b border-border bg-background"
    >
      {/* Faixa sobre o sidebar: mesma largura, encolhe/expande junto. */}
      <div
        className={cn(
          "flex h-full shrink-0 items-center gap-2 border-r border-border px-2.5 transition-[width] duration-200 ease-linear",
          collapsed ? "w-(--sidebar-width-icon)" : "w-(--sidebar-width)",
        )}
      >
        <Logo className="h-6 w-6 shrink-0" />
        {!collapsed && (
          <>
            <span className="text-sm font-medium">Putch.</span>
            <SidebarTrigger style={NO_DRAG} className="ml-auto size-6" />
          </>
        )}
      </div>

      {/* Faixa sobre o conteúdo: menubar à esquerda, command ao centro,
          controles de janela à direita. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <div className="flex min-w-0 flex-1 items-center">
          <Menubar style={NO_DRAG} className="border-0 bg-transparent shadow-none">
            {/* Arquivo */}
            <MenubarMenu>
              <MenubarTrigger>Arquivo</MenubarTrigger>
              <MenubarContent>
                <MenubarGroup>
                  <MenubarItem onSelect={() => navigate({ to: "/panel/collections/create" })}>
                    Nova coleção
                  </MenubarItem>
                  <MenubarItem onSelect={() => navigate({ to: "/panel/environments/create" })}>
                    Novo environment
                  </MenubarItem>
                  <MenubarItem onSelect={() => navigate({ to: "/panel/workspaces/create" })}>
                    Novo workspace
                  </MenubarItem>
                </MenubarGroup>
                <MenubarSeparator />
                <MenubarItem onSelect={() => navigate({ to: "/panel/settings" })}>
                  Configurações
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem
                  onSelect={() => void Window.Close()}
                  className="text-destructive focus:text-destructive"
                >
                  Sair
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            {/* Ver */}
            <MenubarMenu>
              <MenubarTrigger>Ver</MenubarTrigger>
              <MenubarContent>
                <MenubarGroup>
                  <MenubarItem onSelect={() => navigate({ to: "/panel/collections" })}>
                    Coleções
                  </MenubarItem>
                  <MenubarItem onSelect={() => navigate({ to: "/panel/environments" })}>
                    Environments
                  </MenubarItem>
                  <MenubarItem onSelect={() => navigate({ to: "/panel/tests" })}>
                    Testes
                  </MenubarItem>
                  <MenubarItem onSelect={() => navigate({ to: "/panel/git" })}>Git</MenubarItem>
                  <MenubarItem onSelect={() => navigate({ to: "/panel/workspaces" })}>
                    Workspaces
                  </MenubarItem>
                </MenubarGroup>
                <MenubarSeparator />
                <MenubarItem onSelect={openCommandMenu}>
                  Paleta de comandos <MenubarShortcut>⌘K</MenubarShortcut>
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            {/* Janela */}
            <MenubarMenu>
              <MenubarTrigger>Janela</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onSelect={() => void Window.Minimise()}>Minimizar</MenubarItem>
                <MenubarItem onSelect={() => void Window.ToggleMaximise()}>
                  Maximizar / Restaurar
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem
                  onSelect={() => void Window.Close()}
                  className="text-destructive focus:text-destructive"
                >
                  Fechar janela
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            {/* Ajuda */}
            <MenubarMenu>
              <MenubarTrigger>Ajuda</MenubarTrigger>
              <MenubarContent>
                <MenubarItem onSelect={() => navigate({ to: "/panel/welcome" })}>
                  Tela de boas-vindas
                </MenubarItem>
                <MenubarItem onSelect={openCommandMenu}>
                  Atalhos <MenubarShortcut>⌘K</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarLabel className="text-muted-foreground">putch · cliente HTTP</MenubarLabel>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </div>
        <CommandMenu />
        <div className="flex min-w-0 flex-1 items-center justify-end">
          <WindowControls />
        </div>
      </div>
    </header>
  );
}
