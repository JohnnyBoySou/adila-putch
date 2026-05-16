import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Column,
  Container,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Title,
} from "@/components/ui";
import { UiScale, usePreferences } from "@/contexts/preferences.context";
import { Theme, useTheme } from "@/contexts/theme.context";
import { WorkspaceService } from "@/services/workspace.service";
import { getRouteApi } from "@tanstack/react-router";
import {
  Check,
  Coffee,
  FolderOpen,
  LoaderCircle,
  Moon,
  RotateCcw,
  Sun,
  Type,
  Zap,
} from "lucide-react";
import { useState } from "react";

const settingsRoute = getRouteApi("/panel/settings/");

interface Option {
  value: string;
  label: string;
  description: string;
  icon: typeof Moon;
}

const THEME_OPTIONS: Option[] = [
  {
    value: "ultra-dark",
    label: "Ultra Dark",
    description: "Tema escuro, ideal para ambientes com pouca luz.",
    icon: Moon,
  },
  {
    value: "ultra-white",
    label: "Ultra White",
    description: "Tema claro, ideal para ambientes bem iluminados.",
    icon: Sun,
  },
  {
    value: "off-white",
    label: "Off White",
    description: "Bege quente de baixo contraste, suave para leitura prolongada.",
    icon: Coffee,
  },
];

const SCALE_OPTIONS: Option[] = [
  {
    value: "compact",
    label: "Compacta",
    description: "Mais conteúdo na tela, elementos menores.",
    icon: Type,
  },
  {
    value: "default",
    label: "Padrão",
    description: "Tamanho equilibrado, recomendado.",
    icon: Type,
  },
  {
    value: "comfortable",
    label: "Ampliada",
    description: "Texto e controles maiores, melhor legibilidade.",
    icon: Type,
  },
];

const MOTION_OPTIONS: Option[] = [
  {
    value: "full",
    label: "Completas",
    description: "Transições e animações ativas.",
    icon: Zap,
  },
  {
    value: "reduced",
    label: "Reduzidas",
    description: "Minimiza animações e transições da interface.",
    icon: Zap,
  },
];

function OptionGrid({
  title,
  options,
  value,
  onSelect,
  columns,
}: {
  title: string;
  options: Option[];
  value: string;
  onSelect: (value: string) => void;
  columns: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid grid-cols-1 gap-3 ${columns}`}>
          {options.map((option) => {
            const Icon = option.icon;
            const isActive = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelect(option.value)}
                aria-pressed={isActive}
                className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                  isActive ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                }`}
              >
                <span className="mt-0.5 rounded-md bg-muted p-2">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {option.label}
                    {isActive && <Check className="h-4 w-4 text-primary" />}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { uiScale, setUiScale, reduceMotion, setReduceMotion } = usePreferences();

  return (
    <>
      <OptionGrid
        title="Tema"
        columns="sm:grid-cols-3"
        options={THEME_OPTIONS}
        value={theme}
        onSelect={(v) => setTheme(v as Theme)}
      />
      <OptionGrid
        title="Escala da interface"
        columns="sm:grid-cols-3"
        options={SCALE_OPTIONS}
        value={uiScale}
        onSelect={(v) => setUiScale(v as UiScale)}
      />
      <OptionGrid
        title="Animações"
        columns="sm:grid-cols-2"
        options={MOTION_OPTIONS}
        value={reduceMotion ? "reduced" : "full"}
        onSelect={(v) => setReduceMotion(v === "reduced")}
      />
    </>
  );
}

function WorkspaceSettings() {
  const initialPath = settingsRoute.useLoaderData();
  const [path, setPath] = useState(initialPath);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      setPath(await action());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pasta onde as coleções são salvas como arquivos YAML versionáveis por git — uma subpasta
          por coleção. Aponte para um clone existente para colaborar via git.
        </p>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm break-all">
          {path}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" disabled={busy} onClick={() => run(WorkspaceService.choose)}>
            {busy ? <LoaderCircle className="animate-spin" /> : <FolderOpen />}
            Alterar pasta…
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(WorkspaceService.resetToDefault)}
          >
            <RotateCcw />
            Restaurar padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsView() {
  return (
    <Container className="p-6">
      <Column>
        <Title>Configurações</Title>
        <Label>Personalize a aparência e o comportamento do aplicativo.</Label>

        <Tabs defaultValue="appearance">
          <TabsList>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
          </TabsList>
          <TabsContent value="appearance" className="space-y-6">
            <AppearanceSettings />
          </TabsContent>
          <TabsContent value="workspace" className="space-y-6">
            <WorkspaceSettings />
          </TabsContent>
        </Tabs>
      </Column>
    </Container>
  );
}
