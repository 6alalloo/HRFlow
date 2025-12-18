import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./contexts/AuthContext";
import AppLayout from "./layout/appLayout";
import LoginPage from "./pages/Auth/LoginPage";
import WorkflowsListPage from "./pages/Workflows/workflowListPage";
import WorkflowDetailPage from "./pages/WorkflowDetail/workflowDetailPage";
import ExecutionDetailPage from "./pages/Executions/executionDetailPage";
import WorkflowBuilderPage from "./pages/Workflows/workflowBuilderPage";
import ExecutionsListPage from "./pages/Executions/executionListPage";
import AuditLogPage from "./pages/Admin/AuditLogPage";

// Protected route wrapper component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div
        className="min-vh-100 d-flex align-items-center justify-content-center"
        style={{ backgroundColor: "#0a0e1a" }}
      >
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isLoading ? (
            <div
              className="min-vh-100 d-flex align-items-center justify-content-center"
              style={{ backgroundColor: "#0a0e1a" }}
            >
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : isAuthenticated ? (
            <Navigate to="/workflows" replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Protected routes - wrapped in AppLayout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                {/* Root redirect */}
                <Route path="/" element={<Navigate to="/workflows" replace />} />

                {/* Workflows */}
                <Route path="/workflows" element={<WorkflowsListPage />} />
                <Route path="/workflows/:id" element={<WorkflowDetailPage />} />

                {/* Executions */}
                <Route path="/executions/:id" element={<ExecutionDetailPage />} />
                <Route path="/executions" element={<ExecutionsListPage />} />

                {/* Admin */}
                <Route path="/admin/audit-logs" element={<AuditLogPage />} />

                {/* Fallback 404 */}
                <Route
                  path="*"
                  element={
                    <div className="p-4">
                      <h1 className="h3">404</h1>
                      <p className="text-muted">Page not found.</p>
                    </div>
                  }
                />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Builder Routes - Full Screen (No AppLayout) */}
      <Route
        path="/builder"
        element={
          <ProtectedRoute>
            <WorkflowBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflows/:id/builder"
        element={
          <ProtectedRoute>
            <WorkflowBuilderPage />
          </ProtectedRoute>
        }
      />

    </Routes>
  );
};

export default App;