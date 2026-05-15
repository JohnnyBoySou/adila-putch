import {
  useSelectedEnvironmentId,
  useSetSelectedEnvironmentId,
} from "@/stores/selected-environment.store";
import { Environment } from "../../services/enviroments.service";

interface EnvironmentsListCompactProps {
  environments: Environment[];
  collectionId: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function EnvironmentsListCompact({
  environments,
  collectionId,
  onEdit,
  onDelete,
}: EnvironmentsListCompactProps) {
  const currentSelectedId = useSelectedEnvironmentId(collectionId);
  const setSelectedEnvironmentId = useSetSelectedEnvironmentId();

  if (environments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        <p>No environments yet. Create your first environment!</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {environments.map((environment) => (
        <div
          key={environment.id}
          className={`p-2 rounded cursor-pointer transition-colors ${
            currentSelectedId === environment.id
              ? "bg-blue-100 border border-blue-300"
              : "hover:bg-gray-100 border border-transparent"
          }`}
          onClick={() =>
            setSelectedEnvironmentId(
              currentSelectedId === environment.id ? null : environment.id,
              collectionId,
            )
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-800 truncate">{environment.name}</h3>
                {currentSelectedId === environment.id && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Active</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {Object.keys(environment.variables).length} variable(s)
              </p>
            </div>
            <div className="flex gap-1 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(environment.id);
                }}
                className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(environment.id);
                }}
                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
