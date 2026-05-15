import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, Code, Copy, FileText, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { strMap } from "../../lib/utils";
import { ResponseData } from "../../services/request.service";

interface ResponseViewProps {
  response: ResponseData;
}

interface TabState {
  payload: boolean;
  headers: boolean;
  timing: boolean;
}

const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) return "text-green-600";
  if (status >= 300 && status < 400) return "text-yellow-600";
  if (status >= 400 && status < 500) return "text-red-600";
  if (status >= 500) return "text-red-800";
  return "text-gray-600";
};

const isDateString = (value: string): boolean => {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?$/;
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T|\s|$)/;
  return isoDateRegex.test(value) || dateRegex.test(value);
};

const jsonToTypeScript = (
  obj: any,
  interfaceName: string = "Response",
  depth: number = 0,
  keyName: string = "",
): string => {
  if (depth > 10) return "any";

  if (obj === null) return "null";
  if (obj === undefined) return "undefined";

  const objType = typeof obj;

  if (objType === "boolean") return "boolean";
  if (objType === "number") return "number";
  if (objType === "string") {
    const isDateKey = /(date|time|timestamp|created|updated|deleted|at|on)$/i.test(keyName);
    if (isDateString(obj) || isDateKey) {
      return "Date | string";
    }
    return "string";
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "any[]";
    const itemType = jsonToTypeScript(obj[0], "", depth + 1, keyName);
    return `${itemType}[]`;
  }

  if (objType === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "Record<string, never>";

    const properties = entries
      .map(([key, value]) => {
        const sanitizedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
        const valueType = jsonToTypeScript(value, "", depth + 1, key);
        const optional = value === null || value === undefined ? "?" : "";
        return `  ${sanitizedKey}${optional}: ${valueType};`;
      })
      .join("\n");

    if (depth === 0) {
      return `interface ${interfaceName} {\n${properties}\n}`;
    }
    return `{\n${properties}\n}`;
  }

  return "any";
};

export default function ResponseView({ response }: ResponseViewProps) {
  const [viewMode, setViewMode] = useState<"pretty" | "raw">("pretty");
  const [isJson, setIsJson] = useState(false);
  const [showTypeScript, setShowTypeScript] = useState(false);
  const [typeScriptInterface, setTypeScriptInterface] = useState<string>("");
  const [tabsOpen, setTabsOpen] = useState<TabState>({
    payload: true,
    headers: false,
    timing: false,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      JSON.parse(response.body);
      setIsJson(true);
    } catch {
      setIsJson(false);
    }
  }, [response.body]);

  const formatBody = () => {
    if (isJson && viewMode === "pretty") {
      try {
        return JSON.stringify(JSON.parse(response.body), null, 2);
      } catch {
        return response.body;
      }
    }
    return response.body;
  };

  const handleConvertToTypeScript = () => {
    if (!isJson) return;

    try {
      const parsed = JSON.parse(response.body);
      const interfaceCode = jsonToTypeScript(parsed, "Response");
      setTypeScriptInterface(interfaceCode);
      setShowTypeScript(true);
    } catch (error) {
      console.error("Error converting to TypeScript:", error);
    }
  };

  const handleCopyTypeScript = async () => {
    try {
      await navigator.clipboard.writeText(typeScriptInterface);
      alert("Interface TypeScript copiada para a área de transferência!");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  const toggleTab = (tab: keyof TabState) => {
    setTabsOpen((prev) => ({
      ...prev,
      [tab]: !prev[tab],
    }));
  };

  const handleCopyHeader = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(`${key}: ${value}`);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error("Error copying header:", error);
    }
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return "N/A";
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Status bar */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${getStatusColor(response.status)}`}>
            {response.status}
          </span>
          <span className="text-sm text-gray-600">
            {response.status >= 200 && response.status < 300 ? "OK" : "Error"}
          </span>
        </div>
        <div className="flex gap-2">
          {isJson && (
            <button
              onClick={handleConvertToTypeScript}
              className="px-3 py-1 text-xs rounded transition-colors bg-purple-600 text-white hover:bg-purple-700"
              title="Converter para interface TypeScript"
            >
              To TypeScript
            </button>
          )}
          <button
            onClick={() => setViewMode("pretty")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === "pretty"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Pretty
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === "raw"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Raw
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        {/* Payload Tab */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleTab("payload")}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: tabsOpen.payload ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight size={16} className="text-gray-500" />
              </motion.div>
              <Code size={16} className="text-gray-600" />
              <span className="font-medium text-gray-700">Payload</span>
            </div>
          </button>
          <AnimatePresence>
            {tabsOpen.payload && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-gray-900 text-green-400 font-mono text-sm max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap break-words">{formatBody()}</pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Headers Tab */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleTab("headers")}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: tabsOpen.headers ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight size={16} className="text-gray-500" />
              </motion.div>
              <FileText size={16} className="text-gray-600" />
              <span className="font-medium text-gray-700">Headers</span>
              <span className="text-xs text-gray-500">
                ({Object.keys(response.headers).length})
              </span>
            </div>
          </button>
          <AnimatePresence>
            {tabsOpen.headers && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-gray-50 space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(strMap(response.headers)).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-700 mb-1">{key}</div>
                        <div className="text-xs text-gray-600 break-all">{value}</div>
                      </div>
                      <button
                        onClick={() => handleCopyHeader(key, value)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                        title="Copy header"
                      >
                        {copiedKey === key ? (
                          <Check size={14} className="text-green-600" />
                        ) : (
                          <Copy size={14} className="text-gray-500" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Timing Tab */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleTab("timing")}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: tabsOpen.timing ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight size={16} className="text-gray-500" />
              </motion.div>
              <Timer size={16} className="text-gray-600" />
              <span className="font-medium text-gray-700">Timing</span>
            </div>
            {response.duration_ms && (
              <span className="text-sm font-semibold text-blue-600">
                {formatDuration(response.duration_ms)}
              </span>
            )}
          </button>
          <AnimatePresence>
            {tabsOpen.timing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-gray-50">
                  <div className="bg-white rounded border border-gray-200 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Response Time:</span>
                        <span className="text-sm font-semibold text-blue-600">
                          {formatDuration(response.duration_ms)}
                        </span>
                      </div>
                      {response.duration_ms && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>
                              <span className="font-medium">Milliseconds:</span>{" "}
                              {response.duration_ms.toFixed(2)}ms
                            </div>
                            <div>
                              <span className="font-medium">Seconds:</span>{" "}
                              {(response.duration_ms / 1000).toFixed(3)}s
                            </div>
                          </div>
                        </div>
                      )}
                      {!response.duration_ms && (
                        <div className="text-sm text-gray-500 italic">
                          Timing information not available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* TypeScript Modal */}
      {showTypeScript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Interface TypeScript</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyTypeScript}
                  className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Copiar
                </button>
                <button
                  onClick={() => setShowTypeScript(false)}
                  className="px-3 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-900 text-green-400 font-mono text-sm">
              <pre className="whitespace-pre-wrap break-words">{typeScriptInterface}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
