// Helpers puros e testáveis para resolução de variáveis `{{...}}` e
// montagem de um comando `curl` a partir do estado atual do editor.
//
// A resolução é feita no cliente (regex síncrona) de propósito: o preview
// roda a cada tecla e a montagem do cURL precisa ser determinística, então
// um round-trip assíncrono ao backend (`EnvironmentsService.Interpolate`)
// causaria flicker/lag. O mapa nome→valor vem do environment ativo do
// workspace (ver `RequestEditor`).

// Captura `{{ chave }}` tolerando espaços ao redor do nome.
const VARIABLE_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * Resolve um token dinâmico `$...` por ocorrência (cada match é avaliado
 * independentemente). Tokens suportados:
 *
 * - `{{$uuid}}`            → UUID v4 aleatório (`crypto.randomUUID()`).
 * - `{{$timestamp}}`       → segundos Unix (`Math.floor(Date.now() / 1000)`).
 * - `{{$isoTimestamp}}`    → data/hora ISO-8601 (`new Date().toISOString()`).
 * - `{{$randomInt}}`       → inteiro aleatório em [0, 1000] inclusive.
 * - `{{$randomInt:min:max}}` → inteiro aleatório em [min, max] inclusive;
 *   se os valores forem inválidos ou min > max, usa [0, 1000] como fallback.
 *
 * Retorna `null` se `key` não corresponder a nenhum token dinâmico.
 */
function resolveDynamicToken(key: string): string | null {
  if (key === "$uuid") {
    return crypto.randomUUID();
  }
  if (key === "$timestamp") {
    return String(Math.floor(Date.now() / 1000));
  }
  if (key === "$isoTimestamp") {
    return new Date().toISOString();
  }
  if (key === "$randomInt") {
    return String(Math.floor(Math.random() * 1001));
  }
  // `$randomInt:min:max` — aceita qualquer número de espaços ao redor dos separadores.
  const randomIntRange = /^\$randomInt\s*:\s*(-?\d+)\s*:\s*(-?\d+)$/.exec(key);
  if (randomIntRange) {
    const min = parseInt(randomIntRange[1], 10);
    const max = parseInt(randomIntRange[2], 10);
    if (!Number.isNaN(min) && !Number.isNaN(max) && min <= max) {
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    // Fallback: [0, 1000]
    return String(Math.floor(Math.random() * 1001));
  }
  // Chave não reconhecida como token dinâmico.
  return null;
}

/**
 * Substitui ocorrências de `{{chave}}` em `text` pelos valores de `variables`.
 * Variáveis ausentes são preservadas literalmente (ex.: `{{faltando}}`), para
 * ficarem visíveis no preview como pendência.
 *
 * Precedência por ocorrência:
 * 1. Se a chave existir em `variables` (environment), usa esse valor.
 * 2. Se a chave for um token dinâmico `$...`, resolve dinamicamente.
 * 3. Caso contrário, preserva o literal `{{...}}`.
 */
export function resolveVariables(text: string, variables: Record<string, string>): string {
  if (!text) return text;
  return text.replace(VARIABLE_RE, (match, rawKey: string) => {
    const key = rawKey.trim();
    // 1. Environment tem prioridade.
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return variables[key];
    }
    // 2. Tokens dinâmicos `$...`.
    const dynamic = resolveDynamicToken(key);
    if (dynamic !== null) {
      return dynamic;
    }
    // 3. Preserva literal.
    return match;
  });
}

/** Indica se ainda há `{{...}}` não resolvido (variável ausente) no texto. */
export function hasUnresolvedVariables(text: string): boolean {
  return /\{\{\s*[^{}]+?\s*\}\}/.test(text);
}

/** Escapa uma string para uso seguro entre aspas simples no shell POSIX. */
function shellQuote(value: string): string {
  // Fecha a aspa, insere `'\''` e reabre — técnica padrão de escape POSIX.
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export interface BuildCurlInput {
  method: string;
  /** URL já com query params aplicados (mas ainda pode conter `{{vars}}`). */
  url: string;
  headers: Record<string, string>;
  body: string;
  /** Mapa de variáveis do environment ativo (nome→valor). */
  variables: Record<string, string>;
}

/**
 * Monta um comando `curl` a partir do estado atual da request, já com as
 * variáveis do environment ativo resolvidas. Métodos sem corpo (GET/HEAD)
 * omitem `--data`.
 */
export function buildCurlCommand({
  method,
  url,
  headers,
  body,
  variables,
}: BuildCurlInput): string {
  const resolvedMethod = (method || "GET").toUpperCase();
  const resolvedUrl = resolveVariables(url, variables);

  const parts = [`curl -X ${resolvedMethod}`, shellQuote(resolvedUrl)];

  for (const [key, value] of Object.entries(headers)) {
    if (!key) continue;
    const resolvedValue = resolveVariables(value, variables);
    parts.push(`-H ${shellQuote(`${key}: ${resolvedValue}`)}`);
  }

  // GET/HEAD não carregam corpo.
  const omitsBody = resolvedMethod === "GET" || resolvedMethod === "HEAD";
  const resolvedBody = resolveVariables(body, variables);
  if (!omitsBody && resolvedBody.trim()) {
    parts.push(`--data ${shellQuote(resolvedBody)}`);
  }

  return parts.join(" ");
}
