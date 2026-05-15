import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useEnvironments } from "../../hooks/useEnvironments";
import EnvironmentsList from "./list";
import EnvironmentCreate from "./create";
import EnvironmentUpdate from "./update";

const routeApi = getRouteApi("/panel/collections/$collectionId/environments/");

export default function EnvironmentsView() {
  const { collectionId } = routeApi.useParams();
  const { environments, loading, error, createEnvironment, deleteEnvironment, updateEnvironment } =
    useEnvironments();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (name: string, variables: Record<string, string>) => {
    if (!collectionId) return;
    await createEnvironment(name, variables);
    setShowCreate(false);
  };

  const handleUpdate = async (id: string, name: string, variables: Record<string, string>) => {
    await updateEnvironment(id, name, variables);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this environment?")) {
      await deleteEnvironment(id);
    }
  };

  if (loading && environments.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading environments...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Environments</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Environment
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {showCreate && (
        <EnvironmentCreate
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <EnvironmentsList
        environments={environments}
        onEdit={setEditingId}
        onDelete={handleDelete}
      />

      {editingId && (
        <EnvironmentUpdate
          environment={environments.find((e) => e.id === editingId)!}
          onSubmit={(name, variables) => handleUpdate(editingId, name, variables)}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

