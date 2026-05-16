import * as React from "react";

import { type ResizeEdge, startWindowResize } from "@/lib/wails-window";

// Grips invisíveis nas bordas/cantos da viewport. A janela é frameless,
// então o runtime do Wails não fornece resize no Linux/macOS — estes
// elementos disparam o resize nativo manualmente no pointerdown.
//
// Cantos têm z maior que as bordas para vencer a sobreposição.
const GRIPS: Array<{ edge: ResizeEdge; className: string }> = [
  { edge: "n-resize", className: "inset-x-0 top-0 h-1.5 cursor-n-resize" },
  { edge: "s-resize", className: "inset-x-0 bottom-0 h-1.5 cursor-s-resize" },
  { edge: "w-resize", className: "inset-y-0 left-0 w-1.5 cursor-w-resize" },
  { edge: "e-resize", className: "inset-y-0 right-0 w-1.5 cursor-e-resize" },
  { edge: "nw-resize", className: "top-0 left-0 size-3 cursor-nw-resize z-10" },
  { edge: "ne-resize", className: "top-0 right-0 size-3 cursor-ne-resize z-10" },
  { edge: "sw-resize", className: "bottom-0 left-0 size-3 cursor-sw-resize z-10" },
  { edge: "se-resize", className: "bottom-0 right-0 size-3 cursor-se-resize z-10" },
];

export default function WindowResizeGrips() {
  const handlePointerDown = React.useCallback(
    (edge: ResizeEdge) => (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      // Evita seleção de texto / foco enquanto inicia o resize nativo.
      event.preventDefault();
      startWindowResize(edge);
    },
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {GRIPS.map(({ edge, className }) => (
        <div
          key={edge}
          // Resize não deve virar drag region.
          style={{ ["--wails-draggable" as string]: "no-drag" }}
          className={`pointer-events-auto absolute ${className}`}
          onPointerDown={handlePointerDown(edge)}
        />
      ))}
    </div>
  );
}
