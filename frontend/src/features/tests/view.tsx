import { Button, Column, Container, Input, Row, Title } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTests } from "@/hooks/useTests";
import type { TestRunResult } from "@/services/tests.service";
import { useRequestsIndexStore } from "@/stores/requests-index.store";
import { PlayIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

const ASSERTION_TYPES = ["status", "body_contains", "header_exists", "jsonpath"] as const;

interface DraftAssertion {
  type: string;
  target: string;
  expected: string;
}

interface DraftStep {
  name: string;
  request_id: string;
  assertions: DraftAssertion[];
}

const emptyAssertion = (): DraftAssertion => ({ type: "status", target: "", expected: "" });
const emptyStep = (): DraftStep => ({ name: "", request_id: "", assertions: [] });

export default function TestsView() {
  const { tests, error, runs, running, createTest, deleteTest, runTest } = useTests();
  const requests = useRequestsIndexStore(useShallow((s) => s.requests));

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([emptyStep()]);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setName("");
    setSteps([emptyStep()]);
    setShowCreate(false);
  };

  const updateStep = (i: number, patch: Partial<DraftStep>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const updateAssertion = (si: number, ai: number, patch: Partial<DraftAssertion>) =>
    setSteps((prev) =>
      prev.map((s, idx) =>
        idx === si
          ? { ...s, assertions: s.assertions.map((a, j) => (j === ai ? { ...a, ...patch } : a)) }
          : s,
      ),
    );

  const handleCreate = async () => {
    const trimmed = name.trim();
    const validSteps = steps.filter((s) => s.request_id);
    if (!trimmed || validSteps.length === 0 || busy) return;
    setBusy(true);
    try {
      await createTest({
        name: trimmed,
        steps: validSteps.map((s) => ({
          name: s.name.trim() || "Passo",
          request_id: s.request_id,
          assertions: s.assertions.filter((a) => a.type),
          captures: [],
        })),
      });
      resetForm();
    } catch {
      // erro exposto pelo store
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Excluir o teste "${label}"?`)) return;
    await deleteTest(id);
  };

  return (
    <Container className="p-6">
      <Column>
        <Row className="justify-between items-center">
          <Title>Testes</Title>
          {!showCreate && (
            <Button onClick={() => setShowCreate(true)} disabled={requests.length === 0}>
              <PlusIcon className="w-4 h-4" />
              Novo teste
            </Button>
          )}
        </Row>

        {requests.length === 0 && (
          // aviso de pré-condição: sem requests não é erro, é aviso — usa token warning
          <div className="p-3 rounded-md border border-warning/40 bg-warning/15 text-sm text-warning">
            Crie ao menos uma request numa coleção deste workspace antes de montar um teste.
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 text-sm text-destructive">
            {error}
          </div>
        )}

        {showCreate && (
          <div className="p-4 rounded-lg border border-border bg-card space-y-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do teste (ex.: Fluxo de login)"
            />

            {steps.map((step, si) => (
              <div key={si} className="p-3 rounded border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">#{si + 1}</span>
                  <Input
                    aria-label="Nome do passo"
                    value={step.name}
                    onChange={(e) => updateStep(si, { name: e.target.value })}
                    placeholder="Nome do passo"
                    className="h-8 flex-1 text-sm"
                  />
                  <Select
                    value={step.request_id}
                    onValueChange={(v) => updateStep(si, { request_id: v })}
                  >
                    <SelectTrigger size="sm" className="flex-1">
                      <SelectValue placeholder="— escolher request —" />
                    </SelectTrigger>
                    <SelectContent>
                      {requests.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.method} {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {steps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSteps((p) => p.filter((_, idx) => idx !== si))}
                      className="h-8 w-8 bg-transparent text-muted-foreground hover:text-destructive"
                      aria-label="Remover passo"
                    >
                      <XIcon className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {step.assertions.map((a, ai) => (
                  <div key={ai} className="flex items-center gap-2 pl-8">
                    <Select
                      value={a.type}
                      onValueChange={(v) => updateAssertion(si, ai, { type: v })}
                    >
                      <SelectTrigger size="sm" className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSERTION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(a.type === "header_exists" || a.type === "jsonpath") && (
                      <Input
                        aria-label="Alvo da asserção"
                        value={a.target}
                        onChange={(e) => updateAssertion(si, ai, { target: e.target.value })}
                        placeholder={a.type === "jsonpath" ? "data.id" : "Content-Type"}
                        className="h-8 w-32 text-xs"
                      />
                    )}
                    {a.type !== "header_exists" && (
                      <Input
                        aria-label="Valor esperado"
                        value={a.expected}
                        onChange={(e) => updateAssertion(si, ai, { expected: e.target.value })}
                        placeholder={a.type === "status" ? "200" : "valor esperado"}
                        className="h-8 flex-1 text-xs"
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        updateStep(si, {
                          assertions: step.assertions.filter((_, j) => j !== ai),
                        })
                      }
                      className="h-8 w-8 bg-transparent text-muted-foreground hover:text-destructive"
                      aria-label="Remover asserção"
                    >
                      <XIcon className="w-3 h-3" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="ml-8"
                  onClick={() =>
                    updateStep(si, { assertions: [...step.assertions, emptyAssertion()] })
                  }
                >
                  + asserção
                </Button>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setSteps((p) => [...p, emptyStep()])}
              >
                + passo
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={busy || !name.trim()}>
                  {busy ? "Salvando…" : "Salvar teste"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {tests.map((t) => (
            <TestRow
              key={t.id}
              id={t.id}
              name={t.name}
              steps={t.steps?.length ?? 0}
              running={!!running[t.id]}
              result={runs[t.id]}
              onRun={() => runTest(t.id)}
              onDelete={() => handleDelete(t.id, t.name)}
            />
          ))}
          {tests.length === 0 && !showCreate && (
            <p className="text-sm text-muted-foreground">Nenhum teste ainda.</p>
          )}
        </div>
      </Column>
    </Container>
  );
}

interface TestRowProps {
  id: string;
  name: string;
  steps: number;
  running: boolean;
  result?: TestRunResult;
  onRun: () => void;
  onDelete: () => void;
}

function TestRow({ name, steps, running, result, onRun, onDelete }: TestRowProps) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{steps} passo(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                result.passed
                  ? "bg-success/15 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {result.passed ? "Passou" : "Falhou"}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={onRun} disabled={running}>
            <PlayIcon className="w-3 h-3" />
            {running ? "Rodando…" : "Rodar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Excluir teste">
            <Trash2Icon className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {result && (
        <div className="mt-3 space-y-1 border-t border-border pt-2">
          {result.steps.map((s, i) => (
            <div key={i} className="text-xs">
              <span className={s.passed ? "text-success" : "text-destructive"}>
                {s.passed ? "✓" : "✗"} {s.name}
              </span>
              <span className="text-muted-foreground">
                {" "}
                — {s.status} · {s.duration_ms}ms
                {s.error ? ` · ${s.error}` : ""}
              </span>
              {s.assertions
                .filter((a) => !a.passed)
                .map((a, j) => (
                  <div key={j} className="pl-4 text-destructive">
                    {a.type} {a.target} esperado “{a.expected}”, obtido “{a.actual}”
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
