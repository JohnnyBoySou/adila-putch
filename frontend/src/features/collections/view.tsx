import { useState } from "react";
import { useCollections } from "../../hooks/useCollections";
import CollectionsList from "./list";
import CollectionCreate from "./create";
import CollectionUpdate from "./update";

export default function CollectionsView() {
  const { collections, loading, error, createCollection, deleteCollection, updateCollection } = useCollections();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (name: string) => {
    await createCollection(name);
    setShowCreate(false);
  };

  const handleUpdate = async (id: string, name: string) => {
    await updateCollection(id, name);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this collection?")) {
      await deleteCollection(id);
    }
  };

  if (loading && collections.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading collections...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Collections</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Collection
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {showCreate && (
        <CollectionCreate
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <CollectionsList
        collections={collections}
        onEdit={setEditingId}
        onDelete={handleDelete}
      />

      {editingId && (
        <CollectionUpdate
          collection={collections.find((c) => c.id === editingId)!}
          onSubmit={(name) => handleUpdate(editingId, name)}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
