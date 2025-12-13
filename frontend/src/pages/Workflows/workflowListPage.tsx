import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlay, FiEye, FiPlus } from "react-icons/fi";
import {
  fetchWorkflows,
  executeWorkflow,
  createWorkflow,
} from "../../api/workflows";
import type { WorkflowApi } from "../../api/workflows";

/** ---------- Types ---------- **/

type Workflow = {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  version: number;
  ownerUserId: number | null;
  createdAt: string;
  archivedAt: string | null;
};

type LastExecution = {
  executionId: number;
  workflowId: number;
  workflowName: string;
  status: "completed" | "failed" | "running";
  stepsCount: number;
  finishedAt: string;
};

/** ---------- Helpers ---------- **/

function mapWorkflow(api: WorkflowApi): Workflow {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? "",
    isActive: api.is_active,
    version: api.version,
    ownerUserId: api.owner_user_id,
    createdAt: api.created_at,
    archivedAt: api.archived_at,
  };
}

/** ---------- Small helper components ---------- **/

type SearchBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: "all" | "active" | "archived";
  onStatusFilterChange: (value: "all" | "active" | "archived") => void;
};

const WorkflowSearchBar: React.FC<SearchBarProps> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
      <div style={{ minWidth: 260 }}>
        <input
          type="text"
          className="form-control form-control-sm bg-dark text-light border-secondary"
          placeholder="Search workflows by name or description..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="btn-group btn-group-sm">
        <button
          type="button"
          className={
            "btn " +
            (statusFilter === "all" ? "btn-primary" : "btn-outline-secondary")
          }
          onClick={() => onStatusFilterChange("all")}
        >
          All
        </button>
        <button
          type="button"
          className={
            "btn " +
            (statusFilter === "active"
              ? "btn-primary"
              : "btn-outline-secondary")
          }
          onClick={() => onStatusFilterChange("active")}
        >
          Active
        </button>
        <button
          type="button"
          className={
            "btn " +
            (statusFilter === "archived"
              ? "btn-primary"
              : "btn-outline-secondary")
          }
          onClick={() => onStatusFilterChange("archived")}
        >
          Archived
        </button>
      </div>
    </div>
  );
};

type WorkflowTableProps = {
  workflows: Workflow[];
  onView: (workflow: Workflow) => void;
  onRun: (workflow: Workflow) => void;
};

const WorkflowTable: React.FC<WorkflowTableProps> = ({
  workflows,
  onView,
  onRun,
}) => {
  return (
    <div className="table-responsive">
      <table className="table table-dark table-sm align-middle mb-0">
        <thead>
          <tr>
            <th style={{ width: "24%" }}>Name</th>
            <th style={{ width: "26%" }}>Description</th>
            <th>Status</th>
            <th>Version</th>
            <th>Owner</th>
            <th>Created</th>
            <th style={{ width: "130px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {workflows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-muted py-4">
                No workflows matched your filters.
              </td>
            </tr>
          )}

          {workflows.map((wf) => {
            const isArchived = Boolean(wf.archivedAt);
            const statusLabel = isArchived
              ? "Archived"
              : wf.isActive
              ? "Active"
              : "Inactive";

            const statusClass = isArchived
              ? "badge bg-secondary"
              : wf.isActive
              ? "badge bg-success"
              : "badge bg-warning text-dark";

            const createdDate = new Date(wf.createdAt).toLocaleDateString();

            return (
              <tr key={wf.id}>
                <td className="fw-semibold">{wf.name}</td>
                <td className="text-muted">{wf.description}</td>
                <td>
                  <span className={statusClass}>{statusLabel}</span>
                </td>
                <td>v{wf.version}</td>
                <td>{wf.ownerUserId ?? "—"}</td>
                <td>{createdDate}</td>
                <td>
                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className="btn btn-outline-light btn-sm"
                      onClick={() => onView(wf)}
                    >
                      <FiEye className="me-1" />
                      View
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onRun(wf)}
                    >
                      <FiPlay className="me-1" />
                      Run
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

type RunModalProps = {
  workflow: Workflow | null;
  isOpen: boolean;
  inputText: string;
  onInputTextChange: (value: string) => void;
  onClose: () => void;
  onConfirmRun: () => void;
  isRunning: boolean;
  error: string | null;
};

const ExecuteWorkflowModal: React.FC<RunModalProps> = ({
  workflow,
  isOpen,
  inputText,
  onInputTextChange,
  onClose,
  onConfirmRun,
  isRunning,
  error,
}) => {
  if (!isOpen || !workflow) return null;

  return (
    <>
      <div
        className="position-fixed top-0 start-0 w-100 h-100"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          zIndex: 1040,
        }}
        onClick={onClose}
      />

      <div
        className="position-fixed top-50 start-50 translate-middle"
        style={{ zIndex: 1050, minWidth: "420px", maxWidth: "95vw" }}
      >
        <div className="modal-content bg-dark text-light border border-secondary">
          <div className="modal-header">
            <h5 className="modal-title">Run Workflow</h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={isRunning}
            />
          </div>
          <div className="modal-body">
            <p className="mb-2">
              You are about to run the workflow:
              <br />
              <strong>{workflow.name}</strong>
            </p>
            <p className="text-muted small mb-3">
              Workflow ID: <code>{workflow.id}</code>
            </p>

            {error && (
              <div className="alert alert-danger py-2">
                <small>{error}</small>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">Run input (JSON)</label>
              <textarea
                className="form-control bg-dark text-light border-secondary"
                rows={7}
                placeholder={`{
  "name": "Sara Ali",
  "email": "sara@company.com",
  "role": "Analyst",
  "department": "HR"
}`}
                value={inputText}
                onChange={(e) => onInputTextChange(e.target.value)}
              />
              <div className="form-text">
                This JSON is sent to the backend and forwarded to n8n as the
                execution input.
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onClose}
              disabled={isRunning}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onConfirmRun}
              disabled={isRunning}
            >
              <FiPlay className="me-1" />
              {isRunning ? "Running..." : "Run workflow"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

type LastExecutionCardProps = {
  execution: LastExecution | null;
};

const LastExecutionCard: React.FC<LastExecutionCardProps> = ({ execution }) => {
  const navigate = useNavigate();

  if (!execution) {
    return (
      <div className="card bg-dark border-secondary">
        <div className="card-body">
          <h2 className="h5 mb-2">Last execution</h2>
          <p className="text-muted mb-0">No executions yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-dark border-secondary">
      <div className="card-body">
        <h2 className="h5 mb-2">Last execution</h2>
        <p className="mb-1">
          <span className="text-muted">Workflow:</span>{" "}
          <strong>{execution.workflowName}</strong>
        </p>
        <p className="mb-1">
          <span className="text-muted">Execution ID:</span>{" "}
          <code>{execution.executionId}</code>
        </p>
        <p className="mb-1">
          <span className="text-muted">Status:</span>{" "}
          <span
            className={
              "badge " +
              (execution.status === "completed"
                ? "bg-success"
                : execution.status === "running"
                ? "bg-warning text-dark"
                : "bg-danger")
            }
          >
            {execution.status}
          </span>
        </p>
        <p className="mb-1">
          <span className="text-muted">Steps:</span> {execution.stepsCount}
        </p>
        <p className="mb-3">
          <span className="text-muted">Finished at:</span>{" "}
          {new Date(execution.finishedAt).toLocaleString()}
        </p>

        <button
          type="button"
          className="btn btn-outline-light btn-sm"
          onClick={() => navigate(`/executions/${execution.executionId}`)}
        >
          <FiEye className="me-1" />
          View details
        </button>
      </div>
    </div>
  );
};

/** ---------- Main page component ---------- **/

const WorkflowsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "archived"
  >("all");

  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null
  );
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);

  const [runInputText, setRunInputText] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [lastExecution, setLastExecution] = useState<LastExecution | null>(null);

  // Create workflow UI state
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const apiWorkflows = await fetchWorkflows();
        setWorkflows(apiWorkflows.map(mapWorkflow));
      } catch (err) {
        console.error("[Workflows] Failed to load workflows", err);
        setLoadError("Failed to load workflows. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((wf) => {
      const isArchived = Boolean(wf.archivedAt);

      if (statusFilter === "active" && (isArchived || !wf.isActive))
        return false;
      if (statusFilter === "archived" && !isArchived) return false;

      const query = search.trim().toLowerCase();
      if (!query) return true;

      return (
        wf.name.toLowerCase().includes(query) ||
        wf.description.toLowerCase().includes(query)
      );
    });
  }, [workflows, search, statusFilter]);

  const handleViewWorkflow = (wf: Workflow) => {
    navigate(`/workflows/${wf.id}`);
  };

  const handleOpenRunModal = (wf: Workflow) => {
    setSelectedWorkflow(wf);
    setRunInputText("");
    setRunError(null);
    setIsRunModalOpen(true);
  };

  const handleConfirmRun = async () => {
    if (!selectedWorkflow) return;

    let inputObj: Record<string, unknown> | null = null;

    const trimmed = runInputText.trim();
    if (trimmed.length > 0) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;

        if (
          parsed === null ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          setRunError(
            'Run input must be a JSON object (example: { "name": "Sara" }).'
          );
          return;
        }

        inputObj = parsed as Record<string, unknown>;
      } catch {
        setRunError("Invalid JSON. Fix the Run input field and try again.");
        return;
      }
    }

    try {
      setIsRunning(true);
      setRunError(null);

      const { execution, steps } = await executeWorkflow(
        selectedWorkflow.id,
        inputObj,
        "manual"
      );

      const last: LastExecution = {
        executionId: execution.id,
        workflowId: selectedWorkflow.id,
        workflowName: selectedWorkflow.name,
        status:
          execution.status === "completed"
            ? "completed"
            : execution.status === "running"
            ? "running"
            : "failed",
        stepsCount: steps.length,
        finishedAt: execution.finished_at || execution.started_at,
      };

      setLastExecution(last);
      setIsRunModalOpen(false);
    } catch (err) {
      console.error("[Workflows] Failed to run workflow", err);
      setRunError("Failed to run workflow. Please try again.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleCloseModal = () => {
    if (isRunning) return;
    setIsRunModalOpen(false);
  };

  const handleCreateWorkflow = async () => {
    try {
      setIsCreating(true);
      setCreateError(null);

      const created = await createWorkflow({
        name: "New Workflow",
        description: "Empty workflow. Add nodes to build your flow.",
        is_active: true,
      });

      const mapped = mapWorkflow(created);
      setWorkflows((prev) => [mapped, ...prev]);

      navigate(`/workflows/${created.id}/builder`);
    } catch (err) {
      console.error("[Workflows] Failed to create workflow", err);
      setCreateError("Failed to create workflow. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Workflows</h1>
          <p className="text-muted mb-0">
            Browse, filter, and run HR automation workflows.
          </p>

          {createError && (
            <div className="alert alert-danger py-2 mt-2 mb-0">
              <small>{createError}</small>
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleCreateWorkflow}
          disabled={isCreating}
        >
          <FiPlus className="me-1" />
          {isCreating ? "Creating..." : "Create workflow"}
        </button>
      </div>

      <WorkflowSearchBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card bg-dark border-secondary mb-0">
            <div className="card-body">
              {isLoading && (
                <div className="text-muted small mb-2">Loading workflows…</div>
              )}
              {loadError && (
                <div className="alert alert-danger py-2">
                  <small>{loadError}</small>
                </div>
              )}

              <WorkflowTable
                workflows={filteredWorkflows}
                onView={handleViewWorkflow}
                onRun={handleOpenRunModal}
              />
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <LastExecutionCard execution={lastExecution} />
        </div>
      </div>

      <ExecuteWorkflowModal
        workflow={selectedWorkflow}
        isOpen={isRunModalOpen}
        inputText={runInputText}
        onInputTextChange={setRunInputText}
        onClose={handleCloseModal}
        onConfirmRun={handleConfirmRun}
        isRunning={isRunning}
        error={runError}
      />
    </div>
  );
};

export default WorkflowsListPage;
