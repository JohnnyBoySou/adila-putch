import { useEffect, useState } from "react";
import { Events } from "@wailsio/runtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSync } from "@/hooks/useSync";

const STATUS_LABEL: Record<string, string> = {
  added: "adicionado",
  modified: "modificado",
  deleted: "removido",
  untracked: "novo",
  conflict: "conflito",
};

export default function GitView() {
  const {
    account,
    status,
    device,
    repos,
    lastPull,
    busy,
    error,
    load,
    refreshStatus,
    startLogin,
    cancelLogin,
    logout,
    loadRepos,
    commit,
    push,
    pull,
    resolve,
    connect,
    clone,
  } = useSync();

  const [message, setMessage] = useState("");
  const [remoteURL, setRemoteURL] = useState("");
  const [cloneURL, setCloneURL] = useState("");

  // O backend emite "github.changed" quando o estado de autenticação muda
  // (login concluído, logout). Recarregamos conta e status nesse momento.
  useEffect(() => {
    const off = Events.On("github.changed", () => {
      void load();
      void refreshStatus();
    });
    return () => off();
  }, [load, refreshStatus]);

  const authed = account?.authenticated === true;

  const handleCommit = async () => {
    const text = message.trim();
    if (!text) return;
    try {
      await commit(text);
      setMessage("");
    } catch {
      /* erro já está no store */
    }
  };

  const handleConnect = async () => {
    const url = remoteURL.trim();
    if (!url) return;
    try {
      await connect(url);
      setRemoteURL("");
    } catch {
      /* erro já está no store */
    }
  };

  const handleClone = async () => {
    const url = cloneURL.trim();
    if (!url) return;
    try {
      await clone(url);
      setCloneURL("");
    } catch {
      /* erro já está no store */
    }
  };

  return (
    <div className="h-screen overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sincronização</h1>
          <p className="text-sm text-gray-500">
            Versione suas collections com git e colabore via GitHub.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-400 bg-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Conta GitHub */}
        <Card>
          <CardHeader>
            <CardTitle>GitHub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {authed ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {account?.avatarUrl && (
                    <img
                      src={account.avatarUrl}
                      alt={account.login}
                      className="h-10 w-10 rounded-full"
                    />
                  )}
                  <div>
                    <div className="font-medium">{account?.name || account?.login}</div>
                    <div className="text-sm text-muted-foreground">@{account?.login}</div>
                  </div>
                </div>
                <Button variant="outline" disabled={busy} onClick={() => logout()}>
                  Sair
                </Button>
              </div>
            ) : device ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Acesse{" "}
                  <a
                    href={device.verificationUri}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline"
                  >
                    {device.verificationUri}
                  </a>{" "}
                  e informe o código:
                </p>
                <div className="rounded-md border bg-muted px-4 py-3 text-center font-mono text-2xl tracking-widest">
                  {device.userCode}
                </div>
                <Button variant="ghost" onClick={() => cancelLogin()}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button disabled={busy} onClick={() => startLogin()}>
                Conectar ao GitHub
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Workspace / remoto */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.isRepo && status.hasRemote ? (
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Branch:</span>{" "}
                  <span className="font-mono">{status.branch || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Remoto:</span>{" "}
                  <span className="font-mono break-all">{status.remoteUrl}</span>
                </div>
                <div className="flex gap-4">
                  <span>
                    <span className="text-muted-foreground">À frente:</span> {status.ahead}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Atrás:</span> {status.behind}
                  </span>
                  <span>{status.clean ? "Sem alterações" : "Alterações pendentes"}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Conectar repositório existente</p>
                  <p className="text-xs text-muted-foreground">
                    Aponta o workspace atual para um remoto (git init + remote add).
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://github.com/org/repo.git"
                      value={remoteURL}
                      onChange={(e) => setRemoteURL(e.target.value)}
                    />
                    <Button disabled={busy || !remoteURL.trim()} onClick={handleConnect}>
                      Conectar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Clonar workspace</p>
                  <p className="text-xs text-muted-foreground">
                    Substitui o workspace local pelo conteúdo do repositório remoto.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://github.com/org/repo.git"
                      value={cloneURL}
                      onChange={(e) => setCloneURL(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={busy || !cloneURL.trim()}
                      onClick={handleClone}
                    >
                      Clonar
                    </Button>
                  </div>
                </div>

                {authed && (
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => loadRepos()}>
                      Listar meus repositórios
                    </Button>
                    {repos.length > 0 && (
                      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                        {repos.map((r) => (
                          <li
                            key={r.fullName}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-accent"
                          >
                            <span className="truncate font-mono">{r.fullName}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => clone(r.cloneUrl)}
                            >
                              Clonar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conflitos */}
        {status?.conflicted && (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-700">Conflito de merge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Escolha qual versão manter para resolver o conflito.
              </p>
              {status.conflictedFiles.length > 0 && (
                <ul className="space-y-1 rounded-md border bg-muted p-2 font-mono text-xs">
                  {status.conflictedFiles.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => resolve("ours")}>
                  Manter local
                </Button>
                <Button disabled={busy} onClick={() => resolve("theirs")}>
                  Manter remoto
                </Button>
                <Button variant="destructive" disabled={busy} onClick={() => resolve("abort")}>
                  Abortar merge
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ações */}
        {status?.isRepo && (
          <Card>
            <CardHeader>
              <CardTitle>Alterações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {status.changes.length > 0 ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                  {status.changes.map((c) => (
                    <li key={c.path} className="flex justify-between gap-2">
                      <span className="truncate font-mono">{c.path}</span>
                      <span className="text-muted-foreground">
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nada a commitar.</p>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Mensagem do commit"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCommit();
                  }}
                />
                <Button disabled={busy || !message.trim() || status.clean} onClick={handleCommit}>
                  Commit
                </Button>
              </div>

              {status.hasRemote && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || status.conflicted}
                    onClick={() => pull()}
                  >
                    Pull
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || status.conflicted}
                    onClick={() => push()}
                  >
                    Push {status.ahead > 0 ? `(${status.ahead})` : ""}
                  </Button>
                </div>
              )}

              {lastPull && (
                <div className="rounded-md border bg-muted p-2 text-xs">
                  {lastPull.alreadyUpToDate
                    ? "Já está atualizado."
                    : lastPull.fastForward
                      ? "Atualizado (fast-forward)."
                      : lastPull.conflicted
                        ? "Pull gerou conflitos — resolva acima."
                        : lastPull.merged
                          ? "Merge concluído."
                          : "Pull concluído."}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
