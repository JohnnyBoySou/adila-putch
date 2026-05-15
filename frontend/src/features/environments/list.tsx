import { Environment } from "../../services/enviroments.service";

interface EnvironmentsListProps {
  environments: Environment[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function EnvironmentsList({
  environments,
  onEdit,
  onDelete,
}: EnvironmentsListProps) {
  if (environments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No environments yet. Create your first environment to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {environments.map((environment) => (
        <div
          key={environment.id}
          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
        >
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-gray-800">{environment.name}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {Object.keys(environment.variables).length} variable(s)
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Created: {new Date(environment.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onEdit(environment.id)}
              className="flex-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(environment.id)}
              className="flex-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
