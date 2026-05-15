import { Link, Outlet } from "@tanstack/react-router";
import ThemeToggle from "@/components/functional/theme-toggle";

export default function PanelLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">putch</h1>
          <p className="text-xs text-gray-400 mt-1">API Client</p>
        </div>
        <nav className="flex-1 p-4">
          <Link
            to="/panel/collections"
            className="block px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors mb-2"
          >
            Collections
          </Link>
          <Link
            to="/panel/git"
            className="block px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors mb-2"
          >
            Sincronização
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
