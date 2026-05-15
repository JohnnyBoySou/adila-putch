import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme.context";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "ultra-dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "ultra-white" : "ultra-dark")}
      title={isDark ? "Ultra White" : "Ultra Dark"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
