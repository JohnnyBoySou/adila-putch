import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { usePreferences } from "@/contexts/preferences.context";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import type { Workspace } from "@/services/workspaces.service";
import {
  useSelectedEnvironmentId,
  useSetSelectedEnvironmentId,
} from "@/stores/selected-environment.store";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  CircleUser,
  FlaskConical,
  FolderOpen,
  GitBranch,
  Globe,
  History,
  Home,
  LayoutGrid,
  Plus,
  Settings2,
  UserCog,
  Variable,
} from "lucide-react";
import { motion } from "motion/react";
import { Label, Row } from "../ui";
import Logo from "./logo";

const navItems = [
  {
    to: "/panel/welcome" as const,
    label: "Início",
    icon: Home,
    isActive: (path: string) => path === "/panel/welcome" || path === "/panel",
  },
  {
    to: "/panel/workspaces" as const,
    label: "Workspaces",
    icon: LayoutGrid,
    isActive: (path: string) => path.startsWith("/panel/workspaces"),
  },
  {
    to: "/panel/collections" as const,
    label: "Coleções",
    icon: FolderOpen,
    isActive: (path: string) => path.startsWith("/panel/collections"),
  },
  {
    to: "/panel/environments" as const,
    label: "Environments",
    icon: Globe,
    isActive: (path: string) => path.startsWith("/panel/environments"),
  },
  {
    to: "/panel/tests" as const,
    label: "Testes",
    icon: FlaskConical,
    isActive: (path: string) => path.startsWith("/panel/tests"),
  },
  {
    to: "/panel/history" as const,
    label: "Histórico",
    icon: History,
    isActive: (path: string) => path.startsWith("/panel/history"),
  },
];

const accountItems = [
  {
    to: "/panel/git" as const,
    label: "Git",
    icon: GitBranch,
    isActive: (path: string) => path.startsWith("/panel/git"),
  },
  {
    to: "/panel/settings" as const,
    label: "Definições",
    icon: Settings2,
    isActive: (path: string) => path.startsWith("/panel/settings"),
  },
  {
    to: "/panel/profile" as const,
    label: "Perfil",
    icon: CircleUser,
    isActive: (path: string) => path.startsWith("/panel/profile"),
  },
];

function formatWorkspaceLabel(ws: Workspace) {
  return `${ws.icon ? `${ws.icon} ` : ""}${ws.pinned ? "📌 " : ""}${ws.name}`;
}

function ActiveRail({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.span
      layoutId="sidebar-active-rail"
      className="pointer-events-none absolute left-0.5 top-2 bottom-2 z-10 w-[2px] rounded-lg bg-foreground"
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
    />
  );
}

export default function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const navigate = useNavigate();
  const { reduceMotion } = usePreferences();
  const { workspaces, activeId, setActiveWorkspace } = useWorkspaces();
  const { environments } = useEnvironments();
  const selectedEnvironmentId = useSelectedEnvironmentId(activeId ?? undefined);
  const setSelectedEnvironmentId = useSetSelectedEnvironmentId();
  const activeWorkspace = workspaces.find((ws) => ws.id === activeId);
  const selectedEnvironment = environments.find((e) => e.id === selectedEnvironmentId);

  const handleSwitch = async (id: string) => {
    if (!id || id === activeId) return;
    await setActiveWorkspace(id);
    await router.invalidate();
  };

  return (
    <Sidebar collapsible="icon">
      <Row className="h-10 items-center justify-start border-b border-border gap-2 px-2.5">
        <Logo className="h-6 w-6 shrink-0" />
        <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">Putch.</span>
      </Row>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ to, label, icon: Icon, isActive }) => {
                const active = isActive(pathname);
                return (
                  <SidebarMenuItem key={to}>
                    {active && <ActiveRail reduceMotion={reduceMotion} />}
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link to={to}>
                        <Icon strokeWidth={1.5} />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              <Collapsible
                defaultOpen={accountItems.some((i) => i.isActive(pathname))}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Conta">
                      <UserCog strokeWidth={1.5} />
                      <span>Conta</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {accountItems.map(({ to, label, icon: Icon, isActive }) => {
                        const active = isActive(pathname);
                        return (
                          <SidebarMenuSubItem key={to}>
                            {active && <ActiveRail reduceMotion={reduceMotion} />}
                            <SidebarMenuSubButton asChild isActive={active}>
                              <Link to={to}>
                                <Icon strokeWidth={1.5} />
                                <span>{label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden gap-1.5 ">
        <Label>Workspace e ambiente</Label>
        {workspaces.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-16 w-full justify-between px-3 font-normal shadow-xs"
                title="Workspace e ambiente"
              >
                <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                  <span className="w-full truncate text-sm">
                    {activeWorkspace ? formatWorkspaceLabel(activeWorkspace) : "Workspace"}
                  </span>
                  {selectedEnvironment && (
                    <span className="w-full truncate text-xs text-muted-foreground">
                      {selectedEnvironment.name}
                    </span>
                  )}
                </span>
                <ChevronDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeId ?? ""} onValueChange={handleSwitch}>
                {workspaces.map((ws) => (
                  <DropdownMenuRadioItem key={ws.id} value={ws.id}>
                    {formatWorkspaceLabel(ws)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              {activeId && environments.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Ambiente</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={selectedEnvironmentId ?? "none"}
                    onValueChange={(v) =>
                      setSelectedEnvironmentId(v === "none" ? null : v, activeId)
                    }
                  >
                    <DropdownMenuRadioItem value="none">— Sem ambiente —</DropdownMenuRadioItem>
                    {environments.map((env) => (
                      <DropdownMenuRadioItem key={env.id} value={env.id}>
                        {env.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </>
              )}
              {activeId && environments.length === 0 && (
                <>
                  <DropdownMenuSeparator />
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    Sem ambientes neste workspace
                  </p>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!selectedEnvironmentId}
                onSelect={() => {
                  if (!selectedEnvironmentId) return;
                  navigate({
                    to: "/panel/environments/$environmentId/update",
                    params: { environmentId: selectedEnvironmentId },
                  });
                }}
              >
                <Variable strokeWidth={1.5} />
                Variáveis
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              Nenhum workspace
            </span>
            <Button
              type="link"
              to="/panel/workspaces/create"
              variant="outline"
              size="sm"
              className="w-full"
              title="Criar workspace"
            >
              <Plus strokeWidth={1.5} />
              <span className="group-data-[collapsible=icon]:hidden">Criar workspace</span>
            </Button>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
