import { useState } from "react";
import { CreateRequestData } from "../../services/request.service";

interface RequestCreateProps {
  collectionId: string;
  onSubmit: (data: CreateRequestData) => Promise<void>;
  onCancel: () => void;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export default function RequestCreate({ collectionId, onSubmit, onCancel }: RequestCreateProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        collection_id: collectionId,
        url: url.trim(),
        method,
        headers: {},
        body: "",
      });
      setName("");
      setUrl("");
      setMethod("GET");
    } catch (err) {
      // Error is handled by parent component
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="m-2 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
      <h3 className="text-sm font-semibold mb-3">Create New Request</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Request"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            required
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="method" className="block text-xs font-medium text-gray-700 mb-1">
            Method
          </label>
          <select
            id="method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="url" className="block text-xs font-medium text-gray-700 mb-1">
            URL
          </label>
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !name.trim() || !url.trim()}
            className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
