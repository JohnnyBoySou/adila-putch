import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Container,
  Input,
  Label,
} from "@/components/ui";
import { ChevronLeftIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import VariablesEditor from "./variables-editor";

export interface EnvironmentFormValues {
  name: string;
  variables: Record<string, string>;
}

interface EnvironmentFormProps {
  title: string;
  /** Valores iniciais — preenchidos na edição, vazios na criação. */
  initialValues?: Partial<EnvironmentFormValues>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: EnvironmentFormValues) => Promise<void>;
}

export default function EnvironmentForm({
  title,
  initialValues,
  submitLabel,
  pendingLabel,
  onSubmit,
}: EnvironmentFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [variables, setVariables] = useState<Record<string, string>>(
    initialValues?.variables ?? {},
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), variables });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="p-6">
      <Button size="icon" variant="ghost" type="link" to="/panel/environments" aria-label="Voltar">
        <ChevronLeftIcon className="w-4 h-4" />
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Produção, Desenvolvimento, etc."
              required
            />
          </div>

          <VariablesEditor variables={variables} onChange={setVariables} />
        </CardContent>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading ? pendingLabel : submitLabel}
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          </Button>
        </CardFooter>
      </Card>
    </Container>
  );
}
