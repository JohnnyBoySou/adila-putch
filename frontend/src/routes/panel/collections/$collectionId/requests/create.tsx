import RequestCreate from "@/features/requests/create";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/panel/collections/$collectionId/requests/create",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { collectionId } = Route.useParams();
  return <RequestCreate collectionId={collectionId} />;
}
