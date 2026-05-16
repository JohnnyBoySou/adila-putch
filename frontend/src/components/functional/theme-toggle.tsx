import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Theme, useTheme } from "@/contexts/theme.context";

// Rótulos em pt-br para os temas reais expostos pelo theme context.
// As chaves espelham exatamente o tipo `Theme` ("ultra-dark" | "ultra-white"
// | "off-white") — não inventar valores novos.
const THEME_LABELS: Record<Theme, string> = {
  "ultra-dark": "Tema escuro",
  "ultra-white": "Tema claro",
  "off-white": "Off-white",
};

const THEME_OPTIONS = Object.keys(THEME_LABELS) as Theme[];

// Seletor de tema consistente com os demais Select do rodapé do sidebar.
// Valor atual vem do context; onValueChange chama o setter do context.
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
      <SelectTrigger size="sm" className="w-full" title="Tema da interface">
        <SelectValue placeholder="Tema" />
      </SelectTrigger>
      <SelectContent>
        {THEME_OPTIONS.map((value) => (
          <SelectItem key={value} value={value}>
            {THEME_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
