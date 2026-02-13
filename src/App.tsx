import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { LoginForm } from "./components/auth/LoginForm";
import { RegisterForm } from "./components/auth/RegisterForm";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import { Home } from "./pages/Home";

// Placeholder components for future implementation
function Dashboard() {
  return (
    <Layout>
      <div className="px-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          File browser and markdown editor coming soon...
        </p>
      </div>
    </Layout>
  );
}

function AdminPanel() {
  return (
    <Layout>
      <div className="px-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Admin Panel</h1>
        <p className="text-gray-600 dark:text-gray-400">User management coming soon...</p>
      </div>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPanel />
            </AdminRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
