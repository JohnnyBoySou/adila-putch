import WindowResizeGrips from "@/components/functional/window-resize-grips";
import { Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <WindowResizeGrips />
      <Outlet />
    </>
  ),
});
