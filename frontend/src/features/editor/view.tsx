import { motion } from "motion/react";
import { Variable } from "lucide-react";
import { useRef, useState } from "react";
import { strMap } from "../../lib/utils";
import { Request, RequestConfig } from "../../services/request.service";
import VariableAutocomplete, {
  VariableAutocompleteRef,
} from "@/components/functional/variable-autocomplete";
import { useRequestSender } from "../../hooks/useRequests";
import BodyEditor from "../body/view";
import HeadersEditor from "../headers/view";
import QueryParamsEditor from "../params/view";
import ResponseView from "../response/view";

interface RequestEditorProps {
  request: Request;
  onUpdate: (data: Partial<Request>) => Promise<void>;
  onDelete: () => void;
  collectionId?: string;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export default function RequestEditor({
  request,
  onUpdate,
  onDelete,
  collectionId,
}: RequestEditorProps) {
  const [name, setName] = useState(request.name);
  const [url, setUrl] = useState(request.url);
  const [method, setMethod] = useState(request.method);
  const [headers, setHeaders] = useState<Record<string, string>>(strMap(request.headers));
  const [body, setBody] = useState(request.body || "");
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"params" | "headers" | "body">("params");
  const { response, loading: sending, error: sendError, sendRequest } = useRequestSender();
  const urlInputRef = useRef<VariableAutocompleteRef>(null);

  const buildUrlWithParams = (baseUrl: string, params: Record<string, string>): string => {
    if (!baseUrl) return baseUrl;

    try {
      // Only add params if base URL is valid
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
    } catch (error) {
      // If URL parsing fails, just return the base URL
      return baseUrl;
    }
  };

  const handleSend = async () => {
    const finalUrl = buildUrlWithParams(url, queryParams);
    const config: RequestConfig = {
      url: finalUrl,
      method,
      headers,
      body,
    };
    await sendRequest(config);
  };

  const handleSave = async () => {
    try {
      await onUpdate({
        name,
        url,
        method,
        headers,
        body,
      });
    } catch (error) {
      console.error("Error saving request:", error);
      alert("Failed to save request. Please try again.");
    }
  };

  const handleMethodChange = async (newMethod: string) => {
    setMethod(newMethod);
    await onUpdate({ method: newMethod });
  };

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl);
    // Auto-save URL changes
    await onUpdate({ url: newUrl });
  };

  const handleHeadersChange = async (newHeaders: Record<string, string>) => {
    setHeaders(newHeaders);
    await onUpdate({ headers: newHeaders });
  };

  const handleBodyChange = async (newBody: string) => {
    setBody(newBody);
    await onUpdate({ body: newBody });
  };

  const handleQueryParamsChange = (newParams: Record<string, string>) => {
    setQueryParams(newParams);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header com URL e método */}
      <div className="border-b border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
                handleSave();
              }
            }}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
            placeholder="Request Name"
          />
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Save
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Delete
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={method}
            onChange={(e) => handleMethodChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex-1 relative flex items-center">
            <VariableAutocomplete
              ref={urlInputRef}
              value={url}
              onChange={(newUrl) => setUrl(newUrl)}
              onBlur={() => handleUrlChange(url)}
              className="flex-1 px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://api.example.com/endpoint"
              collectionId={collectionId}
            />
            <motion.button
              type="button"
              onClick={() => urlInputRef.current?.openVariableMenu()}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="absolute right-2 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Insert variable (Ctrl+Space)"
            >
              <Variable size={16} />
            </motion.button>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !url.trim()}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>

        {sendError && (
          <div className="mt-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {sendError}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex">
          <button
            onClick={() => setActiveTab("params")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "params"
                ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Params
          </button>
          <button
            onClick={() => setActiveTab("headers")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "headers"
                ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Headers
          </button>
          <button
            onClick={() => setActiveTab("body")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "body"
                ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Body
          </button>
        </div>
      </div>

      {/* Conteúdo das tabs */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "headers" && (
            <HeadersEditor
              headers={headers}
              onChange={handleHeadersChange}
              collectionId={collectionId}
            />
          )}
          {activeTab === "body" && (
            <BodyEditor
              body={body}
              method={method}
              onChange={handleBodyChange}
              collectionId={collectionId}
            />
          )}
          {activeTab === "params" && (
            <QueryParamsEditor
              params={queryParams}
              onChange={handleQueryParamsChange}
              collectionId={collectionId}
            />
          )}
        </div>

        {/* Response panel */}
        <div className="w-1/2 border-l border-gray-200 overflow-hidden flex flex-col">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-700">Response</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {response ? (
              <ResponseView response={response} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Click "Send" to see the response</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
