import AppHeader from "@/components/functional/app-header";
import ErrorBoundary from "@/components/functional/error-boundary";
import AppSidebar from "@/components/functional/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Outlet } from "@tanstack/react-router";

export default function PanelLayout() {
  return (
    <SidebarProvider className="flex min-h-svh w-full flex-col">
      <AppHeader />
      <div className="flex min-h-0 min-w-0 flex-1">
        <AppSidebar />
        <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-10 shrink-0 items-center border-b border-border bg-background px-2 md:hidden"></div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
