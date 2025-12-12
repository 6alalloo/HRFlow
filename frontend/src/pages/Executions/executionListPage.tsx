// src/pages/Executions/executionsListPage.tsx
import React, { useEffect, useMemo, useState } from "react";
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

const statusBadgeClass: Record<ExecutionStatus, string> = {
  running: "badge bg-info",
  completed: "badge bg-success",
  failed: "badge bg-danger",
  queued: "badge bg-secondary",
};

const ExecutionsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // Load executions from backend
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // For now we fetch everything and filter client-side.
        const data = await fetchExecutions();
        setExecutions(data);
      } catch (err: any) {
        console.error("[ExecutionsListPage] Failed to load executions:", err);
        setError(err?.message ?? "Failed to load executions");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredExecutions = useMemo(() => {
    return executions.filter((ex) => {
      // Status filter
      if (statusFilter !== "all" && ex.status !== statusFilter) {
        return false;
      }

      // Search filter (by workflow name or ID)
      const q = search.trim().toLowerCase();
      if (!q) return true;

      const wfName = ex.workflows?.name?.toLowerCase() ?? "";
      const idStr = String(ex.id);
      const wfIdStr = String(ex.workflow_id ?? "");

      return (
        wfName.includes(q) ||
        idStr.includes(q) ||
        wfIdStr.includes(q)
      );
    });
  }, [executions, statusFilter, search]);

  const handleRowClick = (id: number) => {
    navigate(`/executions/${id}`);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Executions</h1>
          <p className="text-muted mb-0">
            View recent workflow runs and inspect their status.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div style={{ minWidth: 260 }}>
          <input
            type="text"
            className="form-control form-control-sm bg-dark text-light border-secondary"
            placeholder="Search by execution ID, workflow ID, or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              (statusFilter === "failed"
                ? "btn-primary"
                : "btn-outline-secondary")
            }
            onClick={() => setStatusFilter("failed")}
          >
            Failed
          </button>
          <button
            type="button"
            className={
              "btn " +
              (statusFilter === "queued"
                ? "btn-primary"
                : "btn-outline-secondary")
            }
            onClick={() => setStatusFilter("queued")}
          >
            Queued
          </button>
        </div>
      </div>

      {/* Errors / loading */}
      {loading && (
        <div className="text-muted small mb-2">
          Loading executions…
        </div>
      )}
      {error && (
        <div className="alert alert-danger py-2">
          <small>{error}</small>
        </div>
      )}

      {/* Table */}
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
                    (ex.workflow_id
                      ? `Workflow #${ex.workflow_id}`
                      : "—");

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
                      <td className="small">
                        {ex.trigger_type ?? "manual"}
                      </td>
                      <td className="small">
                        {formatDate(ex.started_at)}
                      </td>
                      <td className="small">
                        {formatDate(ex.finished_at)}
                      </td>
                      <td className="small">
                        {formatDuration(ex.duration_ms)}
                      </td>
                      <td className="small">
                        {ex.error_message ? (
                          <span className="text-danger">
                            {ex.error_message}
                          </span>
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
        </div>
      </div>
    </div>
  );
};

export default ExecutionsListPage;
