// src/pages/Executions/executionsListPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchExecutions,
  type ExecutionSummary,
  type ExecutionStatus,
} from "../../api/executions";

type StatusFilter = "all" | ExecutionStatus;

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

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Failed to load executions";
}

const statusBadgeClass: Record<ExecutionStatus, string> = {
  running: "badge bg-info",
  completed: "badge bg-success",
  failed: "badge bg-danger",
  engine_error: "badge bg-warning text-dark",
  queued: "badge bg-secondary",
};

const POLL_INTERVAL_MS = 3000;

const ExecutionsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // Optional MVP: filter by workflow ID (separate from general search)
  const [workflowIdFilterText, setWorkflowIdFilterText] = useState("");

  // Keep interval stable + avoid overlapping fetches
  const pollTimerRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);

  const workflowIdFilter = useMemo(() => {
    const trimmed = workflowIdFilterText.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [workflowIdFilterText]);

  const loadExecutions = async (opts?: { silent?: boolean }) => {
    // silent = true means: don't show big "loading" state, just "refreshing"
    const silent = opts?.silent ?? false;

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      // NOTE: We keep server-side filtering optional.
      // For MVP, we can still fetch everything and filter client-side.
      // If you want less data later, we can pass params to fetchExecutions().
      const data = await fetchExecutions();
      setExecutions(data);
    } catch (err: unknown) {
      console.error("[ExecutionsListPage] Failed to load executions:", err);
      setError(getErrorMessage(err));
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  };

  // Initial load
  useEffect(() => {
    void loadExecutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side filtered list (status + search + workflowId filter)
  const filteredExecutions = useMemo(() => {
    return executions.filter((ex) => {
      if (statusFilter !== "all" && ex.status !== statusFilter) return false;

      // Optional workflowId filter
      if (workflowIdFilter != null && ex.workflow_id !== workflowIdFilter) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (!q) return true;

      const wfName = ex.workflows?.name?.toLowerCase() ?? "";
      const idStr = String(ex.id);
      const wfIdStr = String(ex.workflow_id ?? "");

      return wfName.includes(q) || idStr.includes(q) || wfIdStr.includes(q);
    });
  }, [executions, statusFilter, search, workflowIdFilter]);

  // Polling logic:
  // - If user is filtering "running", poll.
  // - Or if we currently have any running/queued executions in the list, poll.
  const shouldPoll = useMemo(() => {
    if (statusFilter === "running") return true;

    return executions.some((ex) => ex.status === "running" || ex.status === "queued");
  }, [executions, statusFilter]);

  useEffect(() => {
    // Clear any existing timer
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (!shouldPoll) return;

    pollTimerRef.current = window.setInterval(() => {
      void loadExecutions({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPoll]);

  const handleRowClick = (id: number) => {
    navigate(`/executions/${id}`);
  };

  const handleRefreshClick = () => {
    void loadExecutions({ silent: true });
  };

  const runningCount = useMemo(() => {
    return executions.filter((e) => e.status === "running").length;
  }, [executions]);

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Executions</h1>
          <p className="text-muted mb-0">
            View recent workflow runs and inspect their status.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {shouldPoll && (
            <span className="text-muted small">
              Auto-refresh:{" "}
              <span className="badge bg-secondary">
                {refreshing ? "Refreshing…" : `Every ${POLL_INTERVAL_MS / 1000}s`}
              </span>
            </span>
          )}

          {runningCount > 0 && (
            <span className="badge bg-info text-dark">
              Running: {runningCount}
            </span>
          )}

          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={handleRefreshClick}
            disabled={refreshing || loading}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <div style={{ minWidth: 260 }}>
            <input
              type="text"
              className="form-control form-control-sm bg-dark text-light border-secondary"
              placeholder="Search by execution ID, workflow ID, or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Optional MVP: filter by workflow ID */}
          <div style={{ width: 180 }}>
            <input
              type="text"
              inputMode="numeric"
              className="form-control form-control-sm bg-dark text-light border-secondary"
              placeholder="Workflow ID (optional)"
              value={workflowIdFilterText}
              onChange={(e) => setWorkflowIdFilterText(e.target.value)}
            />
            {workflowIdFilterText.trim().length > 0 && workflowIdFilter == null && (
              <div className="text-danger small mt-1">
                Enter a valid workflow ID number.
              </div>
            )}
          </div>
        </div>

        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className={
              "btn " +
              (statusFilter === "all" ? "btn-primary" : "btn-outline-secondary")
            }
            onClick={() => setStatusFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={
              "btn " +
              (statusFilter === "running"
                ? "btn-primary"
                : "btn-outline-secondary")
            }
            onClick={() => setStatusFilter("running")}
          >
            Running
          </button>
          <button
            type="button"
            className={
              "btn " +
              (statusFilter === "completed"
                ? "btn-primary"
                : "btn-outline-secondary")
            }
            onClick={() => setStatusFilter("completed")}
          >
            Completed
          </button>
          <button
            type="button"
            className={
              "btn " +
              (statusFilter === "engine_error"
                ? "btn-primary"
                : "btn-outline-secondary")
            }
            onClick={() => setStatusFilter("engine_error")}
          >
            Engine error
          </button>
          <button
            type="button"
            className={
              "btn " +
              (statusFilter === "failed"
                ? "btn-primary"
                : "btn-outline-secondary")
            }
            onClick={() => setStatusFilter("failed")}
          >
            Failed
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-muted small mb-2">Loading executions…</div>
      )}
      {error && (
        <div className="alert alert-danger py-2">
          <small>{error}</small>
        </div>
      )}

      <div className="card bg-dark border-secondary">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-dark table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Workflow</th>
                  <th>Status</th>
                  <th>Trigger</th>
                  <th>Started</th>
                  <th>Finished</th>
                  <th>Duration</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {filteredExecutions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      No executions found.
                    </td>
                  </tr>
                )}

                {filteredExecutions.map((ex) => {
                  const wfName =
                    ex.workflows?.name ??
                    (ex.workflow_id ? `Workflow #${ex.workflow_id}` : "—");

                  const badgeClass =
                    statusBadgeClass[ex.status] ?? "badge bg-secondary";

                  return (
                    <tr
                      key={ex.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleRowClick(ex.id)}
                    >
                      <td>
                        <code>{ex.id}</code>
                      </td>
                      <td>{wfName}</td>
                      <td>
                        <span className={badgeClass}>{ex.status}</span>
                      </td>
                      <td className="small">{ex.trigger_type ?? "manual"}</td>
                      <td className="small">{formatDate(ex.started_at)}</td>
                      <td className="small">{formatDate(ex.finished_at)}</td>
                      <td className="small">{formatDuration(ex.duration_ms)}</td>
                      <td className="small">
                        {ex.error_message ? (
                          <span className="text-danger">{ex.error_message}</span>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Small footer hint during polling */}
          {shouldPoll && (
            <div className="px-3 py-2 border-top border-secondary text-muted small">
              Auto-refresh is enabled while executions are running.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionsListPage;
