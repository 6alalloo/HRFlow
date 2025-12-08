import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layout/appLayout";
import WorkflowsListPage from "./pages/Workflows/workflowListPage";
import WorkflowDetailPage from "./pages/WorkflowDetail/workflowDetailPage";
import ExecutionDetailPage from "./pages/Executions/executionDetailPage";

const App: React.FC = () => {
  return (
    <AppLayout>
      <Routes>
        {/* Redirect root -> /workflows */}
        <Route path="/" element={<Navigate to="/workflows" replace />} />

        <Route path="/workflows" element={<WorkflowsListPage />} />
        <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
        <Route path="/executions/:id" element={<ExecutionDetailPage />} />

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
  );
};

export default App;