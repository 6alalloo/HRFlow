// src/pages/Executions/executionDetailPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiClock, FiAlertCircle } from "react-icons/fi";

import {
  fetchExecution,
  fetchExecutionSteps,
} from "../../api/workflows";
import type { ExecutionApi, ExecutionStepApi } from "../../api/workflows";

/* ---------- Helpers ---------- */

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(0);
  return `${minutes} min ${remainingSeconds}s`;
}



/* ---------- Main component ---------- */

const ExecutionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const executionId = useMemo(() => {
    const parsed = Number(id);
    return Number.isNaN(parsed) ? null : parsed;
  }, [id]);

  const [execution, setExecution] = useState<ExecutionApi | null>(null);
  const [steps, setSteps] = useState<ExecutionStepApi[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load execution + steps
 useEffect(() => {
  if (executionId == null) {
    setError("Invalid execution ID in URL.");
    return;
  }

  const load = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [exec, s] = await Promise.all([
        fetchExecution(executionId),
        fetchExecutionSteps(executionId),
      ]);

      setExecution(exec);
      setSteps(s);
    } catch (err) {
      console.error("[ExecutionDetail] Failed to load execution", err);
      setError("Failed to load execution details.");
    } finally {
      setIsLoading(false);
    }
  };

  load();
}, [executionId]);

  const renderStatusBadge = () => {
    if (!execution) return null;

    const status = execution.status.toLowerCase();
    let className = "badge bg-secondary";
    if (status === "completed") className = "badge bg-success";
    else if (status === "running") className = "badge bg-warning text-dark";
    else if (status === "failed") className = "badge bg-danger";

    return <span className={className}>{execution.status}</span>;
  };

  const renderHeader = () => (
    <div className="d-flex justify-content-between align-items-center mb-3">
      <div>
        <button
          type="button"
          className="btn btn-link text-decoration-none text-light p-0 mb-1"
          onClick={() => navigate("/workflows")}
        >
          <FiArrowLeft className="me-1" />
          Back to workflows
        </button>
        <h1 className="h3 mb-0">Execution details</h1>
      </div>
    </div>
  );

  const renderSummaryCard = () => {
    if (!execution) return null;

    return (
      <div className="card bg-dark border-secondary mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h2 className="h5 mb-1">
                Execution #{execution.id}
              </h2>
              <div className="d-flex align-items-center gap-2 mb-2">
                {renderStatusBadge()}
                <span className="badge bg-secondary">
                  Trigger: {execution.trigger_type}
                </span>
                {execution.workflow_id && (
                  <span className="badge bg-info text-dark">
                    Workflow ID: {execution.workflow_id}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="row small text-muted">
            <div className="col-md-4 mb-1">
              <span className="d-block text-uppercase fw-semibold">
                Started at
              </span>
              <span>{formatDateTime(execution.started_at)}</span>
            </div>
            <div className="col-md-4 mb-1">
              <span className="d-block text-uppercase fw-semibold">
                Finished at
              </span>
              <span>{formatDateTime(execution.finished_at)}</span>
            </div>
            <div className="col-md-4 mb-1">
              <span className="d-block text-uppercase fw-semibold">
                Duration
              </span>
              <span>{formatDurationMs(execution.duration_ms)}</span>
            </div>
          </div>

          {execution.error_message && (
            <div className="alert alert-danger mt-3 mb-0 py-2">
              <FiAlertCircle className="me-2" />
              <strong>Error:</strong> {execution.error_message}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStepsCard = () => {
    if (!execution) return null;

    if (steps.length === 0 && !isLoading && !error) {
      return (
        <div className="card bg-dark border-secondary">
          <div className="card-body">
            <h3 className="h6 mb-2">Steps</h3>
            <p className="text-muted mb-0">
              No steps were recorded for this execution.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="card bg-dark border-secondary">
        <div className="card-body">
          <h3 className="h6 mb-2">
            <FiClock className="me-2" />
            Steps timeline
          </h3>
          <div className="table-responsive">
            <table className="table table-dark table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Node</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Finished</th>
                  <th>Logs</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, index) => {
                  const nodeInfo = step.workflow_nodes;
                  const nodeLabel = nodeInfo
                    ? `${nodeInfo.name ?? "Node"} (${nodeInfo.kind})`
                    : step.node_id ?? "—";

                  return (
                    <tr key={step.id}>
                      <td>{index + 1}</td>
                      <td>{nodeLabel}</td>
                      <td>
                        <span className="badge bg-secondary">
                          {step.status}
                        </span>
                      </td>
                      <td>{formatDateTime(step.started_at)}</td>
                      <td>{formatDateTime(step.finished_at)}</td>
                      <td className="small text-muted">
                        {step.logs ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-muted small mt-2 mb-0">
            For now this is a simple tabular view. Later we can turn this into a
            visual timeline and optionally show parsed input/output JSON for
            each step.
          </p>
        </div>
      </div>
    );
  };

  if (isLoading && !execution && !error) {
    return (
      <div className="p-4">
        {renderHeader()}
        <p className="text-muted">Loading execution details…</p>
      </div>
    );
  }

  if (error && !execution) {
    return (
      <div className="p-4">
        {renderHeader()}
        <div className="alert alert-danger py-2">
          <small>{error}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {renderHeader()}
      {renderSummaryCard()}
      {renderStepsCard()}
    </div>
  );
};

export default ExecutionDetailPage;
