import * as React from "react";
import { Window } from "@wailsio/runtime";
import { Copy, Minus, Square, X } from "lucide-react";
import { motion } from "motion/react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";

const tapSpring = { type: "spring", stiffness: 400, damping: 25 } as const;

function ControlButton({
  className,
  ...props
}: React.ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={tapSpring}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

export default function WindowControls({ className }: { className?: string }) {
  const [maximised, setMaximised] = React.useState(false);

  const handleMinimise = React.useCallback(() => {
    void Window.Minimise();
  }, []);

  const handleToggleMaximise = React.useCallback(() => {
    void Window.ToggleMaximise().then(async () => {
      setMaximised(await Window.IsMaximised());
    });
  }, []);

  const handleClose = React.useCallback(() => {
    void Window.Close();
  }, []);

  return (
    <div
      // Mantém esta zona clicável (a header inteira é uma drag region).
      style={{ ["--wails-draggable" as string]: "no-drag" }}
      className={cn("flex items-center gap-1", className)}
    >
      {/* Tooltip substitui o `title` nativo (evita tooltip duplo); `aria-label` mantém a acessibilidade. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <ControlButton onClick={handleMinimise} aria-label="Minimizar">
            <Minus />
          </ControlButton>
        </TooltipTrigger>
        <TooltipContent>Minimizar</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ControlButton
            onClick={handleToggleMaximise}
            aria-label={maximised ? "Restaurar" : "Maximizar"}
          >
            {maximised ? <Copy /> : <Square />}
          </ControlButton>
        </TooltipTrigger>
        <TooltipContent>{maximised ? "Restaurar" : "Maximizar"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ControlButton
            onClick={handleClose}
            aria-label="Fechar"
            className="hover:bg-destructive hover:text-destructive-foreground"
          >
            <X />
          </ControlButton>
        </TooltipTrigger>
        <TooltipContent>Fechar</TooltipContent>
      </Tooltip>
    </div>
  );
}
