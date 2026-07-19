import { BookmarkPlus, MoreVertical, Send, Terminal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label, ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { methodTextClass } from "@/lib/http-methods";
import { cn, strMap } from "../../lib/utils";
import { buildCurlCommand, hasUnresolvedVariables, resolveVariables } from "../../lib/curl";
import { useEnvironments } from "../../hooks/useEnvironments";
import { useWorkspaces } from "../../hooks/useWorkspaces";
import { useSelectedEnvironmentId } from "../../stores/selected-environment.store";
import { RequestConfig } from "@bindings/services";
import type { Request } from "../../services/request.service";
import VariableAutocomplete from "@/components/functional/variable-autocomplete";
import { PredictionService } from "../../services/prediction.service";
import { useRequestSender } from "../../hooks/useRequests";
import { useTemplateActions } from "../../stores/templates.store";
import AuthEditor from "../auth/view";
import BodyPanel from "../body/panel";
import HeadersEditor from "../headers/view";
import QueryParamsEditor from "../params/view";
import ResponseView from "../response/view";

interface RequestEditorProps {
  request: Request;
  onUpdate: (data: Partial<Request>) => Promise<void>;
  onDelete: () => void;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const autocompleteClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function RequestEditor({ request, onUpdate, onDelete }: RequestEditorProps) {
  const [name, setName] = useState(request.name);
  const [url, setUrl] = useState(request.url);
  const [method, setMethod] = useState(request.method);
  const [headers, setHeaders] = useState<Record<string, string>>(strMap(request.headers));
  const [body, setBody] = useState(request.body || "");
  const [params, setParams] = useState<Record<string, string>>(strMap(request.params));
  const [bodyType, setBodyType] = useState(request.body_type || "");
  const [form, setForm] = useState<Record<string, string>>(strMap(request.form));
  const [files, setFiles] = useState<Record<string, string>>(strMap(request.files));
  const [authType, setAuthType] = useState(request.auth_type || "");
  const [authValue, setAuthValue] = useState(request.auth_value || "");
  const [timeoutMs, setTimeoutMs] = useState<number>(request.timeout_ms || 0);
  const [activeTab, setActiveTab] = useState<"params" | "headers" | "body" | "auth">("params");
  const { response, loading: sending, error: sendError, sendRequest } = useRequestSender();
  const nameSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  // Dialog "Salvar como template": nome editável, default = nome da request.
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const { add: addTemplate } = useTemplateActions();

  // Mapa de variáveis do environment ativo do workspace (nome→valor).
  // O environment ativo é a seleção do workspace ativo cruzada com a lista
  // de environments carregada no loader da rota.
  const { activeId: activeWorkspaceId } = useWorkspaces();
  const { environments } = useEnvironments();
  const selectedEnvironmentId = useSelectedEnvironmentId(activeWorkspaceId ?? undefined);
  const activeVariables = useMemo<Record<string, string>>(() => {
    if (!selectedEnvironmentId) return {};
    const env = environments.find((e) => e.id === selectedEnvironmentId);
    return env ? strMap(env.variables) : {};
  }, [environments, selectedEnvironmentId]);

  // URL resolvida só para preview — não altera o valor real digitado.
  const resolvedUrlPreview = useMemo(
    () => resolveVariables(url, activeVariables),
    [url, activeVariables],
  );
  const showUrlPreview = url.includes("{{") && !!selectedEnvironmentId;

  // Auto-save do nome com debounce de 2s após a última digitação.
  // Deps = só [name] de propósito: o debounce deve reiniciar quando o usuário
  // digita, não a cada novo closure de onUpdate nem a cada nova identidade de
  // request vinda do pai (reiniciaria o timer e nunca salvaria).
  useEffect(() => {
    if (name === request.name) return;
    if (nameSaveTimer.current) clearTimeout(nameSaveTimer.current);
    nameSaveTimer.current = setTimeout(() => {
      onUpdate({ name }).catch((error) => {
        console.error("Erro ao salvar o nome da request:", error);
      });
    }, 2000);
    return () => {
      if (nameSaveTimer.current) clearTimeout(nameSaveTimer.current);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // Salva o nome imediatamente (usado ao sair do modo de edição)
  const flushNameSave = () => {
    if (nameSaveTimer.current) {
      clearTimeout(nameSaveTimer.current);
      nameSaveTimer.current = null;
    }
    if (name !== request.name) {
      onUpdate({ name }).catch((error) => {
        console.error("Erro ao salvar o nome da request:", error);
      });
    }
  };

  const handleNameBlur = () => {
    setEditingName(false);
    flushNameSave();
  };

  const handleDelete = () => {
    setShowOptions(false);
    onDelete();
  };

  // Abre o dialog de "Salvar como template" com o nome da request como default.
  const openSaveTemplate = () => {
    setTemplateName(name || "");
    setShowOptions(false);
    setShowSaveTemplate(true);
  };

  // Confirma o salvamento: persiste o template client-side a partir do estado
  // atual do editor (método/url/headers/body).
  const handleSaveTemplate = () => {
    const finalName = templateName.trim() || name.trim() || "Sem nome";
    addTemplate({
      name: finalName,
      method,
      url,
      headers,
      body,
    });
    setShowSaveTemplate(false);
    toast.success(`Template "${finalName}" salvo`);
  };

  const buildUrlWithParams = (baseUrl: string, params: Record<string, string>): string => {
    if (!baseUrl) return baseUrl;

    try {
      // Só adiciona params se a URL base for válida
      if (!baseUrl.includes("://")) {
        return baseUrl;
      }

      const urlObj = new URL(baseUrl);
      Object.entries(params).forEach(([key, value]) => {
        if (key && value) {
          urlObj.searchParams.set(key, value);
        }
      });
      return urlObj.toString();
    } catch {
      // Se o parse da URL falhar, devolve a base
      return baseUrl;
    }
  };

  const handleSend = async () => {
    // O backend mescla `params` na URL (mergeParams) — mandamos a URL crua +
    // os params estruturados. auth_value precisa chegar já interpolado
    // (contrato do applyAuth no Go); os demais campos vão como digitados.
    const config = new RequestConfig({
      url,
      method,
      params,
      headers,
      body,
      body_type: bodyType,
      form,
      files,
      auth_type: authType,
      auth_value: resolveVariables(authValue, activeVariables),
      timeout_ms: timeoutMs,
    });
    await sendRequest(config);
  };

  // Copia a request atual como comando cURL, com query params aplicados na
  // URL e variáveis do environment ativo já resolvidas.
  const handleCopyCurl = async () => {
    const finalUrl = buildUrlWithParams(url, params);
    const command = buildCurlCommand({
      method,
      url: finalUrl,
      headers,
      body,
      variables: activeVariables,
    });
    try {
      await navigator.clipboard.writeText(command);
      toast.success("Comando cURL copiado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao copiar o comando cURL");
    }
  };

  // Atalho Ctrl/Cmd+Enter para enviar a request (ignora se já enviando ou sem
  // URL). Deps são os inputs primitivos do envio, não o closure instável
  // handleSend (recriado a cada render — listá-lo re-vincularia o listener a
  // todo render sem ganho).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (sending || !url.trim()) return;
        e.preventDefault();
        handleSend();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sending,
    url,
    method,
    headers,
    body,
    params,
    bodyType,
    form,
    files,
    authType,
    authValue,
    timeoutMs,
  ]);

  const handleMethodChange = async (newMethod: string) => {
    setMethod(newMethod);
    await onUpdate({ method: newMethod });
  };

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl);
    // Auto-save das mudanças de URL
    await onUpdate({ url: newUrl });
  };

  const handleHeadersChange = async (newHeaders: Record<string, string>) => {
    setHeaders(newHeaders);
    await onUpdate({ headers: newHeaders });
  };

  const handleParamsChange = (newParams: Record<string, string>) => {
    setParams(newParams);
    onUpdate({ params: newParams }).catch((error) => {
      console.error("Erro ao salvar os params:", error);
    });
  };

  const handleAuthChange = (next: { authType: string; authValue: string }) => {
    setAuthType(next.authType);
    setAuthValue(next.authValue);
    onUpdate({ auth_type: next.authType, auth_value: next.authValue }).catch((error) => {
      console.error("Erro ao salvar a autenticação:", error);
    });
  };

  const handleBodyPanelChange = (next: {
    body: string;
    bodyType: string;
    form: Record<string, string>;
    files: Record<string, string>;
  }) => {
    setBody(next.body);
    setBodyType(next.bodyType);
    setForm(next.form);
    setFiles(next.files);
    onUpdate({
      body: next.body,
      body_type: next.bodyType,
      form: next.form,
      files: next.files,
    }).catch((error) => {
      console.error("Erro ao salvar o body:", error);
    });
  };

  const handleTimeoutChange = (ms: number) => {
    const safe = Number.isFinite(ms) && ms >= 0 ? Math.floor(ms) : 0;
    setTimeoutMs(safe);
    onUpdate({ timeout_ms: safe }).catch((error) => {
      console.error("Erro ao salvar o timeout:", error);
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header com URL e método */}
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          {editingName ? (
            <Input
              // Foca/seleciona na montagem (síncrono) — fazê-lo num
              // useEffect só rodava após o paint, daí o atraso percebido.
              // Mesmo padrão do rename inline em requests/list.tsx; evita
              // jsx-a11y/no-autofocus.
              ref={(el) => {
                if (el && document.activeElement !== el) {
                  el.focus();
                  el.select();
                }
              }}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  setName(request.name);
                  setEditingName(false);
                }
              }}
              // Tipografia/caixa idênticas ao <h2> de exibição → sem salto
              // de tamanho de fonte nem borda ao entrar em edição.
              className="flex-1 h-auto border-0 bg-transparent p-0 text-lg font-semibold text-foreground shadow-none focus-visible:ring-0"
              placeholder="Nome da request"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => setEditingName(true)}
              title="Dê dois cliques para renomear"
              className="flex-1 truncate text-lg font-semibold text-foreground cursor-text select-none"
            >
              {name || "Sem nome"}
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowOptions(true)}
            title="Opções da request"
            aria-label="Opções da request"
          >
            <MoreVertical size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={method}
            onValueChange={(newMethod) => newMethod !== null && void handleMethodChange(newMethod)}
          >
            <SelectTrigger className={cn("font-semibold", methodTextClass(method))}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m} className={cn("font-semibold", methodTextClass(m))}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Bloco (não flex) para o wrapper do VariableAutocomplete herdar
              100% da largura — `flex items-center` encolhia o wrapper. */}
          <div className="flex-1">
            <VariableAutocomplete
              value={url}
              onChange={(newUrl) => setUrl(newUrl)}
              onBlur={() => handleUrlChange(url)}
              className={autocompleteClass}
              placeholder="https://api.example.com/endpoint"
              suggestions={["https://", "http://"]}
              fetchSuggestions={(prefix) =>
                PredictionService.suggest({
                  field: "url",
                  prefix,
                  collectionId: request.collection_id,
                  method,
                })
              }
            />
          </div>
          <Button onClick={handleSend} disabled={sending || !url.trim()}>
            <Send size={16} />
            {sending ? "Enviando…" : "Enviar"}
          </Button>
        </div>

        {/* Preview da URL resolvida (não altera o valor digitado) */}
        {showUrlPreview && (
          <p
            className={`mt-2 truncate text-xs ${
              hasUnresolvedVariables(resolvedUrlPreview)
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
            title={resolvedUrlPreview}
          >
            → {resolvedUrlPreview}
          </p>
        )}

        {sendError && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            {sendError}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-muted/40 px-4 py-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="params">Params</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="auth">Auth</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conteúdo das tabs (editor) e painel de resposta, redimensionáveis */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
        <ResizablePanel defaultSize="50%" minSize="25%">
          <div className="h-full overflow-y-auto p-4">
            {activeTab === "headers" && (
              <HeadersEditor headers={headers} onChange={handleHeadersChange} />
            )}
            {activeTab === "body" && (
              <BodyPanel
                body={body}
                bodyType={bodyType}
                form={form}
                files={files}
                method={method}
                onChange={handleBodyPanelChange}
              />
            )}
            {activeTab === "params" && (
              <QueryParamsEditor params={params} onChange={handleParamsChange} />
            )}
            {activeTab === "auth" && (
              <AuthEditor authType={authType} authValue={authValue} onChange={handleAuthChange} />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Painel de resposta */}
        <ResizablePanel defaultSize="50%" minSize="25%" className="flex flex-col overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <h3 className="text-sm font-semibold text-foreground">Resposta</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {response ? (
              <ResponseView response={response} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Clique em "Enviar" para ver a resposta</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Dialog de opções da request */}
      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Opções da request</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{name || "Sem nome"}</span> · {method}{" "}
              {url || "sem URL"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs">Timeout (ms) — 0 = sem limite por request</Label>
            <Input
              type="number"
              min={0}
              value={timeoutMs || ""}
              onChange={(e) => handleTimeoutChange(Number(e.target.value))}
              placeholder="0"
            />
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              variant="secondary"
              onClick={handleCopyCurl}
              disabled={!url.trim()}
              title="Copiar como comando cURL"
            >
              <Terminal size={16} />
              Copiar cURL
            </Button>
            <Button variant="secondary" onClick={openSaveTemplate}>
              <BookmarkPlus size={16} />
              Salvar como template
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 size={16} />
              Excluir request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para nomear e salvar o template */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar como template</DialogTitle>
            <DialogDescription>
              Salva {method} {url || "sem URL"} como template reutilizável.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveTemplate();
              }
            }}
            placeholder="Nome do template"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveTemplate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTemplate}>Salvar template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
