import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui";

/**
 * Limite de erro de renderização. Captura exceções na árvore filha e
 * exibe um fallback amigável em vez de quebrar a aplicação inteira.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  // Fallback opcional; quando ausente usa a tela padrão.
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Loga para diagnóstico; o fallback já cobre a UI.
    console.error("ErrorBoundary capturou um erro:", error, info);
  }

  // Tenta limpar o estado de erro para re-renderizar a árvore.
  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Algo deu errado</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ocorreu um erro inesperado ao renderizar esta tela. Tente
            recarregar para continuar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={this.handleReset}>
            Tentar novamente
          </Button>
          <Button onClick={() => window.location.reload()}>Recarregar</Button>
        </div>
      </div>
    );
  }
}
