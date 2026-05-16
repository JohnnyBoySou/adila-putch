import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui";
import { useNavigate } from "@tanstack/react-router";
export default function CollectionsEmpty() {
  const navigate = useNavigate();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Nenhuma coleção encontrada</EmptyTitle>
        <EmptyDescription>Crie uma nova coleção para começar</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => navigate({ to: "/panel/collections/create" })}>Criar coleção</Button>
      </EmptyContent>
    </Empty>
  );
}
