import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normaliza mapas opcionais gerados pelo Wails no boundary da aplicação. */
export function strMap(map?: { [_: string]: string | undefined }): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(map ?? {})) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export function formatTime(time: string): string {
  return new Date(time).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const relativeTime = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** Ex.: "há 2 horas", "há 3 dias". */
export function formatRelative(time: string): string {
  const then = new Date(time).getTime();
  if (Number.isNaN(then)) return "—";

  let delta = (then - Date.now()) / 1000;
  const steps: { limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { limit: 45, divisor: 1, unit: "second" },
    { limit: 45, divisor: 60, unit: "minute" },
    { limit: 22, divisor: 60, unit: "hour" },
    { limit: 26, divisor: 24, unit: "day" },
    { limit: 11, divisor: 30, unit: "month" },
    { limit: Infinity, divisor: 12, unit: "year" },
  ];

  for (const { limit, divisor, unit } of steps) {
    if (Math.abs(delta) < limit) return relativeTime.format(Math.round(delta), unit);
    delta /= divisor;
  }
  return relativeTime.format(Math.round(delta), "year");
}
