import { useAuthStore } from "../stores/authStore";

export function Home() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <div className="px-4 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to Personal CMS
        </h1>
        {isAuthenticated ? (
          <>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              Hello, {user?.username}! 👋
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl mx-auto">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
                Quick Start
              </h2>
              <ul className="text-left space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="mr-2">📁</span>
                  <div>
                    <strong>Upload Files:</strong> Start by uploading your markdown files
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">🎨</span>
                  <div>
                    <strong>Highlight Text:</strong> Select text and choose colors to highlight
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">🔗</span>
                  <div>
                    <strong>Preview Links:</strong> Hover over markdown links for instant previews
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">🔒</span>
                  <div>
                    <strong>Manage Permissions:</strong> Control who can access your files
                  </div>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              Advanced markdown content management with real-time collaboration
            </p>
            <div className="space-x-4">
              <a
                href="/login"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 font-medium"
              >
                Get Started
              </a>
              <a
                href="/register"
                className="inline-block border border-primary-600 text-primary-600 px-6 py-3 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 font-medium"
              >
                Create Account
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
