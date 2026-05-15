import { ThemeProvider } from "@/contexts/theme.context";
import "@/globals.css";
import { router } from "@/router";
import { RouterProvider } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Carregado e renderizado apenas em dev — tree-shaken do bundle de produção.
const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null;

function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <Suspense>
        <TanStackRouterDevtools router={router} />
      </Suspense>
    </ThemeProvider>
  );
}

export default App;
