import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

interface ErrorAlertProps {
  /** Mensagem de erro. Alternativamente, passe `children`. */
  message?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Alerta de erro padronizado. Substitui os divs avulsos com cores cruas
 * (`bg-red-100 border-red-400 text-red-700`) por tokens semânticos do design
 * system (`destructive`), respeitando o radius zero do tema.
 */
export function ErrorAlert({ message, children, className }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{message ?? children}</div>
    </div>
  );
}
