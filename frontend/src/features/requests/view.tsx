import { useRef, useState } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { CreateRequestData, Request } from "../../services/request.service";
import { useEnvironments } from "../../hooks/useEnvironments";
import { useRequests } from "../../hooks/useRequests";
import RequestEditor from "../editor/view";
import EnvironmentCreate from "../environments/create";
import EnvironmentsListCompact from "../environments/list-compact";
import EnvironmentUpdate from "../environments/update";
import RequestCreate from "./create";
import RequestsList from "./list";
import RequestUpdate from "./update";

const routeApi = getRouteApi("/panel/collections/$collectionId/requests/");

export default function RequestsView() {
  const { collectionId } = routeApi.useParams();
  const navigate = useNavigate();
  const { requests, collectionName, loading, error, createRequest, deleteRequest, updateRequest } =
    useRequests();
  const {
    environments,
    loading: envLoading,
    createEnvironment,
    deleteEnvironment,
    updateEnvironment,
  } = useEnvironments();
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"requests" | "environments">("requests");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateEnvironment, setShowCreateEnvironment] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const handleCreate = async (data: CreateRequestData) => {
    if (!collectionId) return;
    await createRequest({ ...data, collection_id: collectionId });
    setShowCreate(false);
  };

  const handleUpdate = async (id: string, data: Partial<Request>) => {
    await updateRequest(id, data);
    // Update selectedRequest if it's the one being edited
    if (selectedRequest?.id === id) {
      // Merge the updated data with the current selectedRequest
      setSelectedRequest((prev) => (prev ? { ...prev, ...data } : null));
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this request?")) {
      await deleteRequest(id);
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
    }
  };

  const handleCreateEnvironment = async (name: string, variables: Record<string, string>) => {
    await createEnvironment(name, variables);
    setShowCreateEnvironment(false);
  };

  const handleUpdateEnvironment = async (
    id: string,
    name: string,
    variables: Record<string, string>,
  ) => {
    await updateEnvironment(id, name, variables);
    setEditingEnvironmentId(null);
  };

  const handleDeleteEnvironment = async (id: string) => {
    if (confirm("Are you sure you want to delete this environment?")) {
      await deleteEnvironment(id);
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading requests...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar com abas */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 bg-white">
          <button
            onClick={() => navigate({ to: "/panel/collections" })}
            className="mb-3 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
          >
            ← Back to Collections
          </button>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-800">{collectionName}</h2>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white">
          <div className="flex">
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "requests"
                  ? "border-b-2 border-blue-500 text-blue-600 bg-gray-50"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Requests
            </button>
            <button
              onClick={() => setActiveTab("environments")}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "environments"
                  ? "border-b-2 border-blue-500 text-blue-600 bg-gray-50"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Environments
            </button>
          </div>
        </div>

        {/* Tab Content Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          {activeTab === "requests" ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              + New Request
            </button>
          ) : (
            <button
              onClick={() => setShowCreateEnvironment(true)}
              className="w-full px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              + New Environment
            </button>
          )}
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {/* Tab Content */}
        <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-4 relative">
          {activeTab === "requests" ? (
            <>
              {showCreate && (
                <RequestCreate
                  collectionId={collectionId!}
                  onSubmit={handleCreate}
                  onCancel={() => setShowCreate(false)}
                />
              )}
              <RequestsList
                requests={requests}
                scrollRef={sidebarScrollRef}
                selectedId={selectedRequest?.id}
                onSelect={setSelectedRequest}
                onEdit={setEditingId}
                onDelete={handleDelete}
              />
            </>
          ) : (
            <>
              {showCreateEnvironment && (
                <EnvironmentCreate
                  onSubmit={handleCreateEnvironment}
                  onCancel={() => setShowCreateEnvironment(false)}
                />
              )}
              {envLoading ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Loading environments...
                </div>
              ) : (
                <EnvironmentsListCompact
                  environments={environments}
                  collectionId={collectionId!}
                  onEdit={setEditingEnvironmentId}
                  onDelete={handleDeleteEnvironment}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Área principal com editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedRequest ? (
          <RequestEditor
            key={selectedRequest.id}
            request={selectedRequest}
            onUpdate={(data) => handleUpdate(selectedRequest.id, data)}
            onDelete={() => handleDelete(selectedRequest.id)}
            collectionId={collectionId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">Select a request to edit</p>
              <p className="text-sm">or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {editingId && (
        <RequestUpdate
          request={requests.find((r) => r.id === editingId)!}
          onSubmit={(data) => handleUpdate(editingId, data)}
          onCancel={() => setEditingId(null)}
        />
      )}

      {editingEnvironmentId && (
        <EnvironmentUpdate
          environment={environments.find((e) => e.id === editingEnvironmentId)!}
          onSubmit={(name, variables) =>
            handleUpdateEnvironment(editingEnvironmentId, name, variables)
          }
          onCancel={() => setEditingEnvironmentId(null)}
        />
      )}
    </div>
  );
}
