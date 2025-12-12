import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchExecutionWithSteps,
  type ExecutionDetailResponse,
  type ExecutionStep,
  type ExecutionStatus,
  type ExecutionStepStatus,
} from "../../api/executions";

const executionStatusBadgeClass: Record<ExecutionStatus, string> = {
  running: "bg-info",
  completed: "bg-success",
  failed: "bg-danger",
  queued: "bg-secondary",
  engine_error: "bg-warning text-dark",
};

const stepStatusBadgeClass: Record<ExecutionStepStatus, string> = {
  completed: "bg-success",
  skipped: "bg-secondary",
  failed: "bg-danger",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes} min ${rem}s`;
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "// Could not stringify engine payload";
  }
}

const ExecutionDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ExecutionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEngine, setShowEngine] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const executionId = params.id ? Number(params.id) : NaN;

  const load = useCallback(async () => {
    if (!executionId || Number.isNaN(executionId)) {
      setError("Invalid execution ID");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const result = await fetchExecutionWithSteps(executionId);
      setData(result);
    } catch (err: unknown) {
      console.error("[ExecutionDetailPage] Failed to load execution:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  const handleRefresh = useCallback(async () => {
    if (!executionId || Number.isNaN(executionId)) return;

    try {
      setRefreshing(true);
      setError(null);
      const result = await fetchExecutionWithSteps(executionId);
      setData(result);
    } catch (err: unknown) {
      console.error("[ExecutionDetailPage] Refresh failed:", err);
      setError(getErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, [executionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data && !error) {
    return (
      <div className="py-4">
        <div className="text-muted">Loading execution…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
        <h1 className="h4 mb-3">Execution details</h1>
        <div className="alert alert-danger">{error}</div>
        <Link to="/executions" className="btn btn-outline-light btn-sm">
          Back to executions
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-4">
        <div className="text-muted">Execution not found.</div>
      </div>
    );
  }

  const { execution, steps, n8nResult } = data;
  const wfName =
    execution.workflows?.name ?? `Workflow #${execution.workflow_id}`;

  const badgeClass =
    executionStatusBadgeClass[execution.status] ?? "bg-secondary";

  const hasEnginePayload = n8nResult !== undefined && n8nResult !== null;

  return (
    <div className="py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-1">Execution #{execution.id}</h1>
          <div className="text-muted small">
            Workflow:&nbsp;
            <Link to={`/workflows/${execution.workflow_id}`}>{wfName}</Link>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className={`badge ${badgeClass} text-uppercase`}>
            {formatStatusLabel(execution.status)}
          </span>

          {execution.error_message && (
            <span className="badge bg-danger-subtle text-danger border border-danger border-opacity-50">
              Error
            </span>
          )}

          <Link to="/executions" className="btn btn-outline-secondary btn-sm">
            Back to executions
          </Link>

          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary + meta */}
      <div className="row g-3">
        <div className="col-md-7">
          <div
            className="card h-100"
            style={{
              backgroundColor: "#070716",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div className="card-body">
              <h2 className="h6 mb-3">Execution summary</h2>
              <dl className="row small mb-0">
                <dt className="col-4 text-muted">Trigger</dt>
                <dd className="col-8">{execution.trigger_type ?? "manual"}</dd>

                <dt className="col-4 text-muted">Started at</dt>
                <dd className="col-8">{formatDate(execution.started_at)}</dd>

                <dt className="col-4 text-muted">Finished at</dt>
                <dd className="col-8">{formatDate(execution.finished_at)}</dd>

                <dt className="col-4 text-muted">Duration</dt>
                <dd className="col-8">
                  {formatDuration(execution.duration_ms)}
                </dd>

                <dt className="col-4 text-muted">Error message</dt>
                <dd className="col-8">
                  {execution.error_message ? (
                    <span className="text-danger">{execution.error_message}</span>
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        {/* Engine panel */}
        <div className="col-md-5">
          <div
            className="card h-100"
            style={{
              backgroundColor: "#070716",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div className="card-body d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h2 className="h6 mb-0">Automation engine</h2>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowEngine((v) => !v)}
                >
                  {showEngine ? "Hide raw result" : "Show raw result"}
                </button>
              </div>

              <p className="text-muted small mb-2">
                {execution.status === "engine_error"
                  ? "This execution could not reach n8n or n8n returned an error. Check the error message in the summary. Engine payload may be empty."
                  : "This execution was sent to n8n. The raw engine payload is stored in run_context.engine.n8n."}
              </p>

              {showEngine && (
                <div
                  className="mt-2"
                  style={{
                    maxHeight: "260px",
                    overflow: "auto",
                    borderRadius: "0.5rem",
                    backgroundColor: "#020617",
                    border: "1px solid rgba(148,163,184,0.4)",
                    padding: "0.5rem",
                  }}
                >
                  <pre
                    className="mb-0"
                    style={{
                      fontSize: "0.7rem",
                      lineHeight: 1.4,
                      color: "#e5e7eb",
                    }}
                  >
                    <code>
                      {hasEnginePayload
                        ? safeStringify(n8nResult)
                        : "// No engine payload recorded"}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Steps table */}
      <div className="mt-3">
        <div
          className="card"
          style={{
            backgroundColor: "#070716",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <div className="card-body">
            <h2 className="h6 mb-3">Execution steps</h2>

            {steps.length === 0 && (
              <p className="text-muted small mb-0">
                No steps were recorded for this execution. This usually means
                the engine failed before running any nodes.
              </p>
            )}

            {steps.length > 0 && (
              <div className="table-responsive">
                <table className="table table-sm table-dark table-striped align-middle mb-0">
                  <thead>
                    <tr className="small text-muted">
                      <th scope="col">#</th>
                      <th scope="col">Node</th>
                      <th scope="col">Kind</th>
                      <th scope="col">Status</th>
                      <th scope="col">Started</th>
                      <th scope="col">Finished</th>
                      <th scope="col">Logs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((step: ExecutionStep, idx: number) => {
                      const stepBadge =
                        stepStatusBadgeClass[step.status] ?? "bg-secondary";

                      return (
                        <tr key={step.id}>
                          <td>{idx + 1}</td>
                          <td>
                            {step.workflow_nodes?.name ??
                              `Node #${step.node_id}`}
                          </td>
                          <td className="text-muted small">
                            {step.workflow_nodes?.kind ?? "-"}
                          </td>
                          <td>
                            <span className={"badge " + stepBadge}>
                              {formatStatusLabel(step.status)}
                            </span>
                          </td>
                          <td className="small">{formatDate(step.started_at)}</td>
                          <td className="small">{formatDate(step.finished_at)}</td>
                          <td className="small">
                            <code>{step.logs ?? "-"}</code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionDetailPage;
