import { Link } from "@tanstack/react-router";
import { Collection } from "../../services/collections.service";

interface CollectionsListProps {
  collections: Collection[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function CollectionsList({ collections, onEdit, onDelete }: CollectionsListProps) {
  if (collections.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No collections yet. Create your first collection to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {collections.map((collection) => (
        <div
          key={collection.id}
          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
        >
          <Link
            to="/panel/collections/$collectionId/requests"
            params={{ collectionId: collection.id }}
            className="block mb-2"
          >
            <h3 className="text-lg font-semibold text-gray-800 hover:text-blue-600">
              {collection.name}
            </h3>
            <p className="text-sm text-gray-500">
              Created: {new Date(collection.created_at).toLocaleDateString()}
            </p>
          </Link>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onEdit(collection.id)}
              className="flex-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(collection.id)}
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
