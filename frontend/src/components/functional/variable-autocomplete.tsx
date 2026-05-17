import { cn } from "@/lib/utils";
import { EnvironmentService } from "@/services/enviroments.service";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { forwardRef, KeyboardEvent, useEffect, useImperativeHandle, useRef, useState } from "react";

interface VariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  as?: "input" | "textarea";
  /**
   * Campo sensível (token/senha): mascara o valor como `type="password"` e
   * exibe um botão de olho para revelar/ocultar. Ignorado quando `as="textarea"`.
   */
  secret?: boolean;
  /**
   * Completions inline (ghost text). Se o valor atual for prefixo (case-insensitive)
   * de um item, o restante aparece esmaecido; Tab (ou → no fim) completa para o
   * item canônico. Ignorado em `as="textarea"`. É só a fonte das sugestões —
   * pode evoluir para um modelo preditivo sem mexer no resto do componente.
   */
  suggestions?: string[];
  /**
   * Fonte assíncrona de sugestões (ex.: motor preditivo do backend). Chamada
   * com debounce a cada digitação; resultados stale são descartados. O retorno
   * é mesclado com `suggestions` para o ghost-text — toda a lógica de render
   * permanece igual. Não dispara com valor vazio ou enquanto se digita `{{`.
   */
  fetchSuggestions?: (value: string) => Promise<string[]>;
}

export interface VariableAutocompleteRef {
  openVariableMenu: () => void;
}

const VariableAutocomplete = forwardRef<VariableAutocompleteRef, VariableAutocompleteProps>(
  (
    {
      value,
      onChange,
      onBlur,
      placeholder,
      className = "",
      as = "input",
      secret = false,
      suggestions,
      fetchSuggestions,
    },
    ref,
  ) => {
    const isSecret = secret && as !== "textarea";
    const [revealed, setRevealed] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [variables, setVariables] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [asyncSuggestions, setAsyncSuggestions] = useState<string[]>([]);
    // Geração monotônica: só o resultado da última chamada vence (abort de stale).
    const fetchGenRef = useRef(0);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Carrega as variáveis de todos os environments do workspace ativo.
    useEffect(() => {
      const loadVariables = async () => {
        try {
          const environments = await EnvironmentService.findAll();
          const allVariables = new Set<string>();
          environments.forEach((env) => {
            Object.keys(env.variables).forEach((key) => allVariables.add(key));
          });
          setVariables(Array.from(allVariables).sort());
        } catch (err) {
          console.error("Failed to load environments:", err);
          setVariables([]);
        }
      };
      loadVariables();
    }, []);

    // Fonte assíncrona (motor preditivo): debounce ~120ms, descarta resultado
    // stale via geração. Não consulta com valor vazio ou meio de `{{var}}`.
    useEffect(() => {
      if (!fetchSuggestions) return;
      if (as === "textarea" || value.length === 0 || value.includes("{{")) {
        setAsyncSuggestions([]);
        return;
      }
      const gen = ++fetchGenRef.current;
      const timer = setTimeout(async () => {
        try {
          const res = await fetchSuggestions(value);
          if (fetchGenRef.current === gen) setAsyncSuggestions(res);
        } catch {
          if (fetchGenRef.current === gen) setAsyncSuggestions([]);
        }
      }, 120);
      return () => clearTimeout(timer);
    }, [value, as, fetchSuggestions]);

    const handleInputChange = (newValue: string, cursorPos?: number) => {
      onChange(newValue);
      const pos = cursorPos !== undefined ? cursorPos : inputRef.current?.selectionStart || 0;
      setCursorPosition(pos);

      // Check if we're typing {{ or if we're inside {{ }}
      const textBeforeCursor = newValue.substring(0, pos);
      const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");

      if (lastOpenBrace !== -1) {
        const afterOpen = textBeforeCursor.substring(lastOpenBrace + 2);
        const closeBrace = afterOpen.indexOf("}}");

        // We're inside {{ }} or typing after {{
        if (closeBrace === -1 || closeBrace > 0) {
          const searchText = closeBrace === -1 ? afterOpen : afterOpen.substring(0, closeBrace);
          setSearchTerm(searchText);
          setShowDropdown(true);
          setSelectedIndex(0);
          return;
        }
      }

      setShowDropdown(false);
    };

    const openVariableMenu = () => {
      if (!inputRef.current) return;

      const cursorPos = inputRef.current.selectionStart || 0;
      setCursorPosition(cursorPos);

      // Check if we're already inside {{ }}
      const textBeforeCursor = value.substring(0, cursorPos);
      const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");

      if (lastOpenBrace !== -1) {
        const afterOpen = textBeforeCursor.substring(lastOpenBrace + 2);
        const closeBrace = afterOpen.indexOf("}}");
        // Already inside {{ }}, just show dropdown
        if (closeBrace === -1 || closeBrace > 0) {
          const searchText = closeBrace === -1 ? afterOpen : afterOpen.substring(0, closeBrace);
          setSearchTerm(searchText);
          setShowDropdown(true);
          setSelectedIndex(0);
          return;
        }
      }

      // Insert {{ at cursor position
      const textBefore = value.substring(0, cursorPos);
      const textAfter = value.substring(cursorPos);
      const newValue = `${textBefore}{{${textAfter}`;
      onChange(newValue);

      // Update cursor position after {{
      const newCursorPos = cursorPos + 2;
      setCursorPosition(newCursorPos);
      setSearchTerm("");
      setShowDropdown(true);
      setSelectedIndex(0);

      // Update cursor in input
      setTimeout(() => {
        if (inputRef.current) {
          if (as === "textarea") {
            (inputRef.current as HTMLTextAreaElement).setSelectionRange(newCursorPos, newCursorPos);
          } else {
            (inputRef.current as HTMLInputElement).setSelectionRange(newCursorPos, newCursorPos);
          }
          inputRef.current?.focus();
        }
      }, 0);
    };

    // Expose method to parent via ref
    useImperativeHandle(ref, () => ({
      openVariableMenu,
    }));

    const filteredVariables = variables.filter((v) =>
      v.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    // Ghost text: primeiro item do qual o valor atual é prefixo (case-insensitive).
    // Não sugere em textarea, valor vazio, ou enquanto se digita uma `{{var}}`.
    const matchedSuggestion =
      as !== "textarea" && value.length > 0 && !value.includes("{{")
        ? [...(suggestions ?? []), ...asyncSuggestions].find(
            (s) => s.length > value.length && s.toLowerCase().startsWith(value.toLowerCase()),
          )
        : undefined;
    const inlineSuggestion = matchedSuggestion ? matchedSuggestion.slice(value.length) : "";

    const acceptSuggestion = () => {
      if (!matchedSuggestion) return;
      onChange(matchedSuggestion);
      setShowDropdown(false);
      // Cursor ao fim do valor completado (canônico).
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.setSelectionRange(matchedSuggestion.length, matchedSuggestion.length);
          el.focus();
        }
      }, 0);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Handle Ctrl+Space or Ctrl+V to open variable menu
      if ((e.ctrlKey || e.metaKey) && (e.key === " " || e.key === "v" || e.key === "V")) {
        e.preventDefault();
        openVariableMenu();
        return;
      }

      // Aceita o ghost text: Tab sempre; → só com o cursor no fim (não atrapalha
      // navegar pelo texto). Só quando o menu de variáveis não está aberto.
      if (!showDropdown && inlineSuggestion) {
        const atEnd = inputRef.current?.selectionStart === value.length;
        if (e.key === "Tab" || (e.key === "ArrowRight" && atEnd)) {
          e.preventDefault();
          acceptSuggestion();
          return;
        }
      }

      if (!showDropdown) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredVariables.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredVariables.length > 0) {
          insertVariable(filteredVariables[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    };

    const insertVariable = (variableName: string) => {
      const textBeforeCursor = value.substring(0, cursorPosition);
      const textAfterCursor = value.substring(cursorPosition);

      // Find the position where {{ starts
      const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");

      if (lastOpenBrace !== -1) {
        // Replace everything from {{ to cursor with {{variableName}}
        const before = value.substring(0, lastOpenBrace);
        const after = textAfterCursor;
        const newValue = `${before}{{${variableName}}}${after}`;

        // Calculate new cursor position (after the inserted variable)
        const newCursorPos = lastOpenBrace + 2 + variableName.length + 2;

        onChange(newValue);
        setShowDropdown(false);

        // Set cursor position after insertion
        setTimeout(() => {
          if (inputRef.current) {
            if (as === "textarea") {
              (inputRef.current as HTMLTextAreaElement).setSelectionRange(
                newCursorPos,
                newCursorPos,
              );
            } else {
              (inputRef.current as HTMLInputElement).setSelectionRange(newCursorPos, newCursorPos);
            }
            inputRef.current?.focus();
          }
        }, 0);
      }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current &&
          !inputRef.current.contains(event.target as Node)
        ) {
          setShowDropdown(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const inputProps = {
      ref: inputRef as any,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const cursorPos = e.target.selectionStart || 0;
        handleInputChange(e.target.value, cursorPos);
      },
      onKeyDown: handleKeyDown,
      onBlur: () => {
        setShowDropdown(false);
        onBlur?.();
      },
      onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const cursorPos = e.target.selectionStart || 0;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");
        if (lastOpenBrace !== -1) {
          const afterOpen = textBeforeCursor.substring(lastOpenBrace + 2);
          const closeBrace = afterOpen.indexOf("}}");
          if (closeBrace === -1 || closeBrace > 0) {
            const searchText = closeBrace === -1 ? afterOpen : afterOpen.substring(0, closeBrace);
            setSearchTerm(searchText);
            setShowDropdown(true);
          }
        }
      },
      placeholder,
      // Reserva espaço à direita para o botão de olho quando for campo sensível.
      className: cn(className, isSecret && "pr-10"),
    };

    // text/search/password suportam selectionStart — a lógica de autocomplete
    // (cursor em `{{ }}`) continua funcionando ao alternar password ↔ text.
    const inputType = isSecret && !revealed ? "password" : "text";

    return (
      <div className={`relative ${as === "textarea" ? "h-full" : ""}`}>
        {/* Ghost text alinhado ao input: o trecho já digitado fica invisível
            (espaçador) e só o restante sugerido aparece esmaecido. Fica atrás
            do input (bg transparente), então o texto real continua por cima. */}
        {inlineSuggestion && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center overflow-hidden",
              "whitespace-pre rounded-md border border-transparent px-3 text-sm",
            )}
          >
            <span className="invisible">{value}</span>
            <span className="text-muted-foreground">{inlineSuggestion}</span>
          </div>
        )}
        {as === "textarea" ? (
          <textarea {...inputProps} />
        ) : (
          <input type={inputType} {...inputProps} />
        )}

        {isSecret && (
          <button
            type="button"
            // mousedown preventDefault: não tira o foco do input ao clicar.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setRevealed((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={revealed ? "Ocultar valor" : "Mostrar valor"}
            tabIndex={-1}
          >
            {revealed ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        )}

        {showDropdown && filteredVariables.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            style={{
              minWidth: "200px",
              maxWidth: "400px",
            }}
          >
            {filteredVariables.map((variable, index) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${
                  index === selectedIndex ? "bg-blue-100" : ""
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="font-mono text-sm text-gray-800">{variable}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

VariableAutocomplete.displayName = "VariableAutocomplete";

export default VariableAutocomplete;
