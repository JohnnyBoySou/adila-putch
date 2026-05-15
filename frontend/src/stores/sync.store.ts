import {
  type DeviceFlowStart,
  type GitHubAccount,
  type GitHubUserRepo,
  type PullResult,
  SyncService,
  type WorkspaceStatus,
} from "@/services/sync.service";
import { create } from "zustand";

function msg(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

interface SyncState {
  account: GitHubAccount | null;
  status: WorkspaceStatus | null;
  device: DeviceFlowStart | null; // fluxo de login ativo
  repos: GitHubUserRepo[];
  lastPull: PullResult | null;
  loading: boolean; // carga inicial
  busy: boolean; // ação em andamento (commit/push/pull/...)
  error: string | null;

  load: () => Promise<void>;
  refreshStatus: () => Promise<void>;

  startLogin: () => Promise<void>;
  cancelLogin: () => Promise<void>;
  logout: () => Promise<void>;
  loadRepos: () => Promise<void>;

  commit: (message: string) => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  resolve: (strategy: "ours" | "theirs" | "abort") => Promise<void>;

  connect: (remoteURL: string) => Promise<void>;
  clone: (cloneURL: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  account: null,
  status: null,
  device: null,
  repos: [],
  lastPull: null,
  loading: false,
  busy: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [account, status] = await Promise.all([SyncService.github(), SyncService.status()]);
      set({ account, status, loading: false });
    } catch (err) {
      set({ error: msg(err, "Falha ao carregar estado do git"), loading: false });
    }
  },

  refreshStatus: async () => {
    try {
      const status = await SyncService.status();
      set({ status });
    } catch (err) {
      set({ error: msg(err, "Falha ao atualizar status") });
    }
  },

  startLogin: async () => {
    set({ error: null });
    try {
      const device = await SyncService.startLogin();
      set({ device });
    } catch (err) {
      set({ error: msg(err, "Falha ao iniciar login no GitHub") });
    }
  },

  cancelLogin: async () => {
    try {
      await SyncService.cancelLogin();
    } finally {
      set({ device: null });
    }
  },

  logout: async () => {
    set({ busy: true, error: null });
    try {
      await SyncService.logout();
      set({ account: { authenticated: false } as GitHubAccount, device: null, repos: [] });
    } catch (err) {
      set({ error: msg(err, "Falha ao sair do GitHub") });
    } finally {
      set({ busy: false });
    }
  },

  loadRepos: async () => {
    try {
      const repos = await SyncService.listRepos();
      set({ repos });
    } catch (err) {
      set({ error: msg(err, "Falha ao listar repositórios") });
    }
  },

  commit: async (message) => {
    set({ busy: true, error: null });
    try {
      await SyncService.commit(message);
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha no commit") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  push: async () => {
    set({ busy: true, error: null });
    try {
      await SyncService.push();
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha no push") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  pull: async () => {
    set({ busy: true, error: null, lastPull: null });
    try {
      const lastPull = await SyncService.pull();
      set({ lastPull });
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha no pull") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  resolve: async (strategy) => {
    set({ busy: true, error: null });
    try {
      await SyncService.resolveConflict(strategy);
      set({ lastPull: null });
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha ao resolver conflito") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  connect: async (remoteURL) => {
    set({ busy: true, error: null });
    try {
      await SyncService.connectRemote(remoteURL);
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha ao conectar o repositório") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },

  clone: async (cloneURL) => {
    set({ busy: true, error: null });
    try {
      await SyncService.cloneWorkspace(cloneURL);
      await get().refreshStatus();
    } catch (err) {
      set({ error: msg(err, "Falha ao clonar o workspace") });
      throw err;
    } finally {
      set({ busy: false });
    }
  },
}));
