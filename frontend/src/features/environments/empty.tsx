import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui";
import { useNavigate } from "@tanstack/react-router";

export default function EnvironmentsEmpty() {
  const navigate = useNavigate();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Nenhum ambiente encontrado</EmptyTitle>
        <EmptyDescription>Crie um novo ambiente para começar</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => navigate({ to: "/panel/environments/create" })}>
          Criar ambiente
        </Button>
      </EmptyContent>
    </Empty>
  );
}
