import { EnvironmentService } from "@/services/enviroments.service";
import { forwardRef, KeyboardEvent, useEffect, useImperativeHandle, useRef, useState } from "react";

interface VariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  as?: "input" | "textarea";
  collectionId?: string;
}

export interface VariableAutocompleteRef {
  openVariableMenu: () => void;
}

const VariableAutocomplete = forwardRef<VariableAutocompleteRef, VariableAutocompleteProps>(
  ({ value, onChange, onBlur, placeholder, className = "", as = "input", collectionId }, ref) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [variables, setVariables] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load all variables from environments in the current collection
    useEffect(() => {
      const loadVariables = async () => {
        if (!collectionId) {
          setVariables([]);
          return;
        }
        try {
          const environments = await EnvironmentService.findAll(collectionId);
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
    }, [collectionId]);

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

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Handle Ctrl+Space or Ctrl+V to open variable menu
      if ((e.ctrlKey || e.metaKey) && (e.key === " " || e.key === "v" || e.key === "V")) {
        e.preventDefault();
        openVariableMenu();
        return;
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
      className,
    };

    return (
      <div className={`relative ${as === "textarea" ? "h-full" : ""}`}>
        {as === "textarea" ? <textarea {...inputProps} /> : <input type="text" {...inputProps} />}

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
