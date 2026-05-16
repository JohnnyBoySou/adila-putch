import VariableAutocomplete from "@/components/functional/variable-autocomplete";
import { Label } from "@/components/ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Interface CONGELADA (consumida por features/editor/view.tsx). Não alterar a
 * assinatura sem ajustar o editor.
 *
 * Convenção do backend — internal/services/requests.go `applyAuth`:
 *  - "bearer": authValue = `<token>`            → `Authorization: Bearer <token>`
 *  - "basic":  authValue = `usuario:senha`      → `Authorization: Basic <base64>`
 *  - "apikey": authValue = `Nome-Header:valor`  → header `Nome-Header: valor`
 *  - "" (none): nenhum header é injetado.
 * O backend espera authValue já interpolado (o editor resolve `{{var}}` no envio).
 */
export interface AuthEditorProps {
  authType: string;
  authValue: string;
  onChange: (next: { authType: string; authValue: string }) => void;
}

const AUTH_TYPES = [
  { value: "none", label: "Sem autenticação" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "apikey", label: "API Key" },
];

/**
 * Divide `authValue` no primeiro `:`, retornando [antes, resto].
 * Se não houver `:`, retorna [authValue, ""].
 */
function splitOnFirst(value: string): [string, string] {
  const idx = value.indexOf(":");
  if (idx === -1) return [value, ""];
  return [value.substring(0, idx), value.substring(idx + 1)];
}

export default function AuthEditor({ authType, authValue, onChange }: AuthEditorProps) {
  const type = authType || "none";

  const setType = (next: string) =>
    onChange({ authType: next === "none" ? "" : next, authValue: next === "none" ? "" : authValue });

  // bearer: authValue é diretamente o token
  const handleBearerChange = (token: string) =>
    onChange({ authType, authValue: token });

  // basic: authValue = "usuario:senha"
  const [basicUser, basicPass] = splitOnFirst(authValue);
  const handleBasicUserChange = (usuario: string) =>
    onChange({ authType, authValue: `${usuario}:${basicPass}` });
  const handleBasicPassChange = (senha: string) =>
    onChange({ authType, authValue: `${basicUser}:${senha}` });

  // apikey: authValue = "Nome-Header:valor"
  const [apikeyName, apikeyValue] = splitOnFirst(authValue);
  const handleApikeyNameChange = (nome: string) =>
    onChange({ authType, authValue: `${nome}:${apikeyValue}` });
  const handleApikeyValueChange = (valor: string) =>
    onChange({ authType, authValue: `${apikeyName}:${valor}` });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Tipo de autenticação</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {type === "bearer" && (
        <div className="space-y-1">
          <Label className="text-xs">Token</Label>
          <VariableAutocomplete
            value={authValue}
            onChange={handleBearerChange}
            placeholder="meu-token-jwt"
          />
        </div>
      )}

      {type === "basic" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Usuário</Label>
            <Input
              value={basicUser}
              onChange={(e) => handleBasicUserChange(e.target.value)}
              placeholder="usuario"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Senha</Label>
            <VariableAutocomplete
              value={basicPass}
              onChange={handleBasicPassChange}
              placeholder="senha"
            />
          </div>
        </>
      )}

      {type === "apikey" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Nome do header</Label>
            <Input
              value={apikeyName}
              onChange={(e) => handleApikeyNameChange(e.target.value)}
              placeholder="X-API-Key"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            <VariableAutocomplete
              value={apikeyValue}
              onChange={handleApikeyValueChange}
              placeholder="abc123"
            />
          </div>
        </>
      )}

      {type === "none" && (
        <p className="text-sm text-muted-foreground">
          Esta request não envia cabeçalho de autenticação.
        </p>
      )}
    </div>
  );
}
