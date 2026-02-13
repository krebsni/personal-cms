import { Link } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

export function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuthStore();

  return (
    <header className="bg-white dark:bg-gray-800 shadow">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold text-gray-900 dark:text-white">Personal CMS</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {user?.username}
                  {isAdmin && (
                    <span className="ml-2 px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded">
                      Admin
                    </span>
                  )}
                </span>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600"
                  >
                    Admin Panel
                  </Link>
                )}
                <button
                  onClick={() => logout()}
                  className="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
