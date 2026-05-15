import { SyncService as Wails } from "@bindings/services";

// Tipos vêm dos bindings gerados: os do facade (services/models) e os
// cross-package das engines (git/github models) reexportados aqui para a UI
// importar de um lugar só.
export type { ChangedFile, GitHubAccount, WorkspaceStatus } from "@bindings/services";
export type { PullResult } from "@bindings/git";
export type { DeviceFlowStart, GitHubUserRepo } from "@bindings/github";

export const SyncService = {
  status: () => Wails.Status(),
  github: () => Wails.GitHub(),

  startLogin: () => Wails.StartGitHubLogin(),
  cancelLogin: () => Wails.CancelGitHubLogin(),
  logout: () => Wails.GitHubLogout(),
  listRepos: () => Wails.ListRepos(),

  commit: (message: string) => Wails.Commit(message),
  push: () => Wails.Push(),
  pull: () => Wails.Pull(),
  resolveConflict: (strategy: "ours" | "theirs" | "abort") => Wails.ResolveConflict(strategy),

  connectRemote: (remoteURL: string) => Wails.ConnectRemote(remoteURL),
  cloneWorkspace: (cloneURL: string) => Wails.CloneWorkspace(cloneURL),
};
