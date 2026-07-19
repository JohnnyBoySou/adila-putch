import { ErrorAlert } from "@/components/functional/error-alert";
import { UnifiedDiff, parsePatch } from "@/components/functional/unified-diff";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Column,
  Container,
  Label,
  Row,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  Title,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { usePullRequests } from "@/hooks/usePullRequests";
import type { ReviewEvent } from "@/stores/pull-requests.store";
import type { ReviewComment } from "@/services/pull-requests.service";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, GitCommitHorizontal, GitMerge } from "lucide-react";
import { useState } from "react";

const routeApi = getRouteApi("/panel/git/pull-requests/$number");

function formatDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
}

// Estado de review → rótulo/cor em pt-BR.
const REVIEW_STATE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  APPROVED: { label: "aprovou", variant: "default" },
  CHANGES_REQUESTED: { label: "pediu mudanças", variant: "destructive" },
  COMMENTED: { label: "comentou", variant: "secondary" },
  DISMISSED: { label: "descartada", variant: "outline" },
  PENDING: { label: "pendente", variant: "outline" },
};

function UserLine({
  avatarUrl,
  login,
  when,
  children,
}: {
  avatarUrl: string;
  login: string;
  when: string;
  children?: React.ReactNode;
}) {
  return (
    <Row className="items-center gap-2 text-xs text-muted-foreground">
      <Avatar className="size-5">
        <AvatarImage src={avatarUrl} alt={login} />
        <AvatarFallback>{login.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-foreground">{login}</span>
      {children}
      {when && (
        <>
          <span className="text-border">·</span>
          <span>{formatDate(when)}</span>
        </>
      )}
    </Row>
  );
}

export default function PullRequestDetail() {
  const { number: numberParam } = routeApi.useParams();
  const number = Number.parseInt(numberParam, 10);
  const {
    detail,
    files,
    commits,
    reviews,
    reviewComments,
    issueComments,
    loading,
    busy,
    error,
    comment,
    submitReview,
    merge,
  } = usePullRequests();
  const navigate = useNavigate();
  const [commentBody, setCommentBody] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [mergeMethod, setMergeMethod] = useState("merge");

  const goBack = () => navigate({ to: "/panel/git/pull-requests" });

  if (loading && !detail) {
    return (
      <Container className="gap-4 p-4">
        <Text className="text-muted-foreground">Carregando pull request…</Text>
      </Container>
    );
  }

  if (!detail) {
    return (
      <Container className="gap-4 p-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="self-start">
          <ArrowLeft strokeWidth={1.5} />
          Voltar
        </Button>
        {error && <ErrorAlert message={error} />}
        <Text className="text-muted-foreground">Pull request não encontrado.</Text>
      </Container>
    );
  }

  const isOpen = detail.state === "open" && !detail.merged;
  const mergeableHint = detail.merged
    ? "já mesclado"
    : detail.mergeable === true
      ? "sem conflitos"
      : detail.mergeable === false
        ? "com conflitos"
        : detail.mergeableState || "";

  const handleComment = async () => {
    if (commentBody.trim() === "") return;
    await comment(number, commentBody);
    setCommentBody("");
  };

  const handleReview = async (event: ReviewEvent) => {
    await submitReview(number, event, reviewBody);
    setReviewBody("");
  };

  return (
    <Container className="gap-4 p-4">
      <Button variant="ghost" size="sm" onClick={goBack} className="self-start">
        <ArrowLeft strokeWidth={1.5} />
        Voltar
      </Button>

      {error && <ErrorAlert message={error} />}

      <Column className="gap-2">
        <Row className="items-center gap-2">
          <Badge variant={detail.merged ? "secondary" : isOpen ? "default" : "secondary"}>
            {detail.merged ? "mesclado" : isOpen ? "aberto" : "fechado"}
          </Badge>
          <Title className="min-w-0 truncate">
            <span className="text-muted-foreground">#{detail.number}</span> {detail.title}
          </Title>
        </Row>
        <UserLine avatarUrl={detail.avatarUrl} login={detail.author} when={detail.createdAt}>
          <span className="text-border">·</span>
          <span className="font-mono">
            {detail.base} ← {detail.head}
          </span>
          {mergeableHint && (
            <>
              <span className="text-border">·</span>
              <span>{mergeableHint}</span>
            </>
          )}
        </UserLine>
      </Column>

      {isOpen && (
        <Row className="items-center gap-2">
          <Select
            value={mergeMethod}
            onValueChange={(value) => value !== null && setMergeMethod(value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="merge">Merge commit</SelectItem>
              <SelectItem value="squash">Squash</SelectItem>
              <SelectItem value="rebase">Rebase</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => merge(number, mergeMethod)}
            disabled={busy || detail.mergeable === false}
          >
            <GitMerge strokeWidth={1.5} />
            Mesclar PR
          </Button>
        </Row>
      )}

      <Tabs defaultValue="conversa">
        <TabsList>
          <TabsTrigger value="conversa">Conversa</TabsTrigger>
          <TabsTrigger value="arquivos">Arquivos ({detail.changedFiles})</TabsTrigger>
          <TabsTrigger value="commits">Commits ({detail.commits})</TabsTrigger>
        </TabsList>

        <TabsContent value="conversa">
          <Column className="gap-3">
            {detail.body.trim() !== "" && (
              <Card>
                <CardHeader>
                  <UserLine
                    avatarUrl={detail.avatarUrl}
                    login={detail.author}
                    when={detail.createdAt}
                  />
                </CardHeader>
                <CardContent>
                  <Text className="whitespace-pre-wrap break-words">{detail.body}</Text>
                </CardContent>
              </Card>
            )}

            {reviews.map((r) => {
              const meta = REVIEW_STATE[r.state] ?? { label: r.state, variant: "outline" as const };
              return (
                <Card key={r.id}>
                  <CardHeader>
                    <UserLine avatarUrl={r.avatarUrl} login={r.author} when={r.submittedAt}>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </UserLine>
                  </CardHeader>
                  {r.body.trim() !== "" && (
                    <CardContent>
                      <Text className="whitespace-pre-wrap break-words">{r.body}</Text>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {issueComments.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <UserLine avatarUrl={c.avatarUrl} login={c.author} when={c.createdAt} />
                </CardHeader>
                <CardContent>
                  <Text className="whitespace-pre-wrap break-words">{c.body}</Text>
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Comentar</CardTitle>
              </CardHeader>
              <CardContent>
                <Column className="gap-2">
                  <Textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Escreva um comentário…"
                    rows={3}
                  />
                  <Row className="justify-end">
                    <Button
                      size="sm"
                      onClick={handleComment}
                      disabled={busy || commentBody.trim() === ""}
                    >
                      Comentar
                    </Button>
                  </Row>
                </Column>
              </CardContent>
            </Card>

            {isOpen && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Revisar</CardTitle>
                </CardHeader>
                <CardContent>
                  <Column className="gap-2">
                    <Textarea
                      value={reviewBody}
                      onChange={(e) => setReviewBody(e.target.value)}
                      placeholder="Resumo da review (opcional para aprovar)…"
                      rows={3}
                    />
                    <Row className="justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReview("COMMENT")}
                        disabled={busy}
                      >
                        Comentar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReview("REQUEST_CHANGES")}
                        disabled={busy}
                      >
                        Pedir mudanças
                      </Button>
                      <Button size="sm" onClick={() => handleReview("APPROVE")} disabled={busy}>
                        Aprovar
                      </Button>
                    </Row>
                  </Column>
                </CardContent>
              </Card>
            )}
          </Column>
        </TabsContent>

        <TabsContent value="arquivos">
          <Column className="gap-3">
            {files.map((f) => (
              <Card key={f.filename}>
                <CardHeader>
                  <Row className="items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-mono text-sm">{f.filename}</span>
                    <Row className="items-center gap-2 text-xs">
                      <span className="text-success">+{f.additions}</span>
                      <span className="text-destructive">−{f.deletions}</span>
                    </Row>
                  </Row>
                </CardHeader>
                <CardContent>
                  {f.patch ? (
                    <div className="overflow-x-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
                      <UnifiedDiff lines={parsePatch(f.patch)} />
                    </div>
                  ) : (
                    <Text className="text-xs text-muted-foreground italic">
                      Sem diff textual (binário ou arquivo muito grande).
                    </Text>
                  )}
                  <FileComments comments={reviewComments} filename={f.filename} />
                </CardContent>
              </Card>
            ))}
          </Column>
        </TabsContent>

        <TabsContent value="commits">
          <Column className="gap-2">
            {commits.map((c) => (
              <Row
                key={c.sha}
                className="items-center gap-2 rounded-lg border border-border bg-card p-2.5"
              >
                <GitCommitHorizontal
                  strokeWidth={1.5}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <Column className="min-w-0 gap-0.5">
                  <span className="truncate text-sm">{c.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono">{c.shortSha}</span> · {c.authorName} ·{" "}
                    {formatDate(c.authoredAt)}
                  </span>
                </Column>
              </Row>
            ))}
          </Column>
        </TabsContent>
      </Tabs>
    </Container>
  );
}

// Comentários inline ancorados a um arquivo específico do diff.
function FileComments({ comments, filename }: { comments: ReviewComment[]; filename: string }) {
  const own = comments.filter((c) => c.path === filename);
  if (own.length === 0) return null;
  return (
    <Column className="mt-3 gap-2 border-t border-border pt-3">
      <Label>Comentários</Label>
      {own.map((c) => (
        <Column key={c.id} className="gap-1 rounded-md bg-muted/40 p-2">
          <UserLine avatarUrl={c.avatarUrl} login={c.author} when={c.createdAt}>
            <span className="text-border">·</span>
            <span className="font-mono">linha {c.line || c.originalLine}</span>
          </UserLine>
          <Text className="whitespace-pre-wrap break-words text-sm">{c.body}</Text>
        </Column>
      ))}
    </Column>
  );
}
