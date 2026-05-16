import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Column,
  Container,
  Label,
  Title,
} from "@/components/ui";
import { CircleUser } from "lucide-react";

export default function ProfileView() {
  return (
    <Container className="p-6">
      <Column>
        <Title>Perfil</Title>
        <Label>Informações da sua conta neste dispositivo.</Label>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleUser strokeWidth={1.5} className="size-4" />
              Conta local
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              O putch é um cliente HTTP local — os dados ficam em arquivos
              versionáveis por git, sem login. Esta área reúne preferências da
              conta junto com as Configurações.
            </p>
          </CardContent>
        </Card>
      </Column>
    </Container>
  );
}
