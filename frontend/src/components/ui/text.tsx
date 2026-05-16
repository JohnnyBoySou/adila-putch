import { cn } from "@/lib/utils";

export function Title({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h1 className={cn("text-2xl tracking-tight font-bold", className)}>{children}</h1>;
}

export function Subtitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={cn("text-xl font-semibold", className)}>{children}</h2>;
}

export function Text({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm text-text", className)}>{children}</p>;
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn("text-sm text-text opacity-90", className)}>{children}</label>;
}

export function Small({ children, className }: { children: React.ReactNode; className?: string }) {
  return <small className={cn("text-xs text-text", className)}>{children}</small>;
}

export function Tiny({ children, className }: { children: React.ReactNode; className?: string }) {
  return <small className={cn("text-xs text-text", className)}>{children}</small>;
}

export function InlineCode({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <code className={cn("text-xs text-text", className)}>{children}</code>;
}

export function BlockCode({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <code className={cn("text-xs text-text", className)}>{children}</code>;
}
