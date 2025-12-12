import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layout/appLayout";
import WorkflowsListPage from "./pages/Workflows/workflowListPage";
import WorkflowDetailPage from "./pages/WorkflowDetail/workflowDetailPage";
import ExecutionDetailPage from "./pages/Executions/executionDetailPage";
import WorkflowBuilderPage from "./pages/Workflows/workflowBuilderPage"; 
import ExecutionsListPage from "./pages/Executions/executionListPage";

const App: React.FC = () => {
  return (
    <AppLayout>
      <Routes>
        {/* For now: root -> /workflows (we'll change this to / later when we build the landing page) */}
        <Route path="/" element={<Navigate to="/workflows" replace />} />

        {/* Workflows */}
        <Route path="/workflows" element={<WorkflowsListPage />} />
        <Route path="/workflows/:id" element={<WorkflowDetailPage />} />

        {/* Builder */}
        <Route path="/builder" element={<WorkflowBuilderPage />} />
        <Route path="/workflows/:id/builder" element={<WorkflowBuilderPage />} />

        {/* Executions */}
        <Route path="/executions/:id" element={<ExecutionDetailPage />} />
        <Route path="/executions" element={<ExecutionsListPage />} />
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