import React from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Auth/LoginPage';
import { RegisterPage } from './pages/Auth/RegisterPage';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { useAuthSession } from './hooks/useAuthApi';
import { useAuthStore } from './store/authStore';

const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useAuthSession();
  const { isAuthenticated } = useAuthStore();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading Session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes (No Sidebar) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* App Routes (With Sidebar and Topbar) */}
        <Route element={<AuthWrapper><Layout><Outlet /></Layout></AuthWrapper>}>
          <Route path="/" element={<div className="p-8"><h1 className="text-2xl font-semibold mb-4 text-foreground">Welcome to Personal CMS</h1><p className="text-muted-foreground">Select a repository or file from the sidebar to begin.</p></div>} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
