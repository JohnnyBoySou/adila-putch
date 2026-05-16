import logoLightNobg from "@/assets/logo-light-nobg.svg?url";
import logoNobg from "@/assets/logo-nobg.svg?url";
import { useTheme } from "@/contexts/theme.context";
import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  const { theme } = useTheme();
  const src = theme === "ultra-dark" ? logoNobg : logoLightNobg;

  return <img src={src} alt="Logo" className={cn("w-10 h-10", className)} />;
}
