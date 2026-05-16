// Transporte mínimo para mensagens internas da janela do Wails.
//
// O runtime (@wailsio/runtime) só detecta as bordas de resize de janelas
// frameless no Windows (drag.js: `if (!resizable || !IsWindows()) return`).
// No Linux/macOS a janela frameless fica sem resize, embora o backend
// implemente `startResize` (gtk_window_begin_resize_drag). Replicamos aqui
// o mesmo canal que o runtime usa para `invoke()` e disparamos a mensagem
// `wails:resize:<edge>` manualmente a partir de grips próprios.

type WebkitWindow = Window & {
  chrome?: { webview?: { postMessage?: (msg: string) => void } };
  webkit?: {
    messageHandlers?: { external?: { postMessage?: (msg: string) => void } };
  };
};

function getTransport(): ((msg: string) => void) | null {
  const w = window as WebkitWindow;
  // Windows WebView2
  if (w.chrome?.webview?.postMessage) {
    return w.chrome.webview.postMessage.bind(w.chrome.webview);
  }
  // Linux/macOS WebKit (WebKitGTK / WKWebView)
  const external = w.webkit?.messageHandlers?.external;
  if (external?.postMessage) {
    return external.postMessage.bind(external);
  }
  return null;
}

export type ResizeEdge =
  | "n-resize"
  | "ne-resize"
  | "e-resize"
  | "se-resize"
  | "s-resize"
  | "sw-resize"
  | "w-resize"
  | "nw-resize";

// Inicia o resize nativo da janela pela borda indicada. Deve ser chamado
// no pointerdown do grip: o backend Linux usa as coordenadas/timestamp
// capturados pelo button-press-event do GTK naquele instante.
export function startWindowResize(edge: ResizeEdge): void {
  getTransport()?.(`wails:resize:${edge}`);
}
