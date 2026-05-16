import { TooltipProvider } from "@/components/ui/tooltip";
import { PreferencesProvider } from "@/contexts/preferences.context";
import { ThemeProvider } from "@/contexts/theme.context";
import "@/globals.css";
import { router } from "@/router";
import { RouterProvider } from "@tanstack/react-router";

/*
import { lazy, Suspense } from "react";
const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null;
  <Suspense>
            <TanStackRouterDevtools router={router} />
  </Suspense>
*/
function App() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

export default App;
