import { useState } from "react";

interface CollectionCreateProps {
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}

export default function CollectionCreate({ onSubmit, onCancel }: CollectionCreateProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSubmit(name.trim());
      setName("");
    } catch (err) {
      // Error is handled by parent component
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
      <h2 className="text-lg font-semibold mb-4">Create New Collection</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Collection Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My API Collection"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

