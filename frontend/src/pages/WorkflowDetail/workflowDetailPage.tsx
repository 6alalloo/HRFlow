// src/pages/WorkflowDetail/WorkflowDetailPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiPlay, FiGitBranch } from "react-icons/fi";

import {
  fetchWorkflowById,
  fetchWorkflowGraph,
} from "../../api/workflows";

import type {
  WorkflowApi,
  WorkflowGraphNode,
  WorkflowGraphEdge,
} from "../../api/workflows";

/* ------------ Local UI types ------------ */

type Workflow = {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  version: number;
  ownerUserId: number | null;
  defaultTrigger: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type TabKey = "overview" | "structure" | "executions";

/* ------------ Helpers ------------ */

function mapWorkflow(api: WorkflowApi): Workflow {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? "",
    isActive: api.is_active,
    version: api.version,
    ownerUserId: api.owner_user_id,
    defaultTrigger: api.default_trigger,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    archivedAt: api.archived_at,
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

/* ------------ Main component ------------ */

const WorkflowDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const workflowId = useMemo(() => {
    const parsed = Number(id);
    return Number.isNaN(parsed) ? null : parsed;
  }, [id]);

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowGraphNode[]>([]);
  const [edges, setEdges] = useState<WorkflowGraphEdge[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);

  // Load workflow details
  useEffect(() => {
    if (workflowId == null) {
      setWorkflowError("Invalid workflow ID in URL.");
      return;
    }

    const load = async () => {
      try {
        setIsLoadingWorkflow(true);
        setWorkflowError(null);
        const api = await fetchWorkflowById(workflowId);
        setWorkflow(mapWorkflow(api));
      } catch (err) {
        console.error("[WorkflowDetail] Failed to load workflow", err);
        setWorkflowError("Failed to load workflow details.");
      } finally {
        setIsLoadingWorkflow(false);
      }
    };

    void load();
  }, [workflowId]);

  // Load workflow graph (nodes + edges)
  useEffect(() => {
    if (workflowId == null) return;

    const loadGraph = async () => {
      try {
        setIsLoadingGraph(true);
        setGraphError(null);
        const { nodes: n, edges: e } = await fetchWorkflowGraph(workflowId);
        setNodes(n);
        setEdges(e);
      } catch (err) {
        console.error("[WorkflowDetail] Failed to load graph", err);
        setGraphError("Failed to load workflow graph.");
      } finally {
        setIsLoadingGraph(false);
      }
    };

    void loadGraph();
  }, [workflowId]);

  const isArchived = workflow?.archivedAt != null;

  /* ------------ Render helpers ------------ */

  const renderStatusBadge = () => {
    if (!workflow) return null;

    const label = isArchived
      ? "Archived"
      : workflow.isActive
      ? "Active"
      : "Inactive";

    const className = isArchived
      ? "badge bg-secondary"
      : workflow.isActive
      ? "badge bg-success"
      : "badge bg-warning text-dark";

    return <span className={className}>{label}</span>;
  };

  const renderOverviewTab = () => {
    if (isLoadingWorkflow && !workflow) {
      return <p className="text-muted">Loading workflow details…</p>;
    }

    if (workflowError && !workflow) {
      return (
        <div className="alert alert-danger py-2">
          <small>{workflowError}</small>
        </div>
      );
    }

    if (!workflow) {
      return (
        <p className="text-muted">
          No workflow found. Check the URL or return to the list.
        </p>
      );
    }

    return (
      <div className="row g-4">
        {/* Left: main info */}
        <div className="col-lg-8">
          <div className="card bg-dark border-secondary mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h2 className="h4 mb-1">{workflow.name}</h2>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    {renderStatusBadge()}
                    <span className="badge bg-info text-dark">
                      v{workflow.version}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-muted mb-3">
                {workflow.description || (
                  <span className="fst-italic">No description provided.</span>
                )}
              </p>

              <div className="row small text-muted">
                <div className="col-sm-6 mb-1">
                  <span className="d-block text-uppercase fw-semibold">
                    Owner
                  </span>
                  <span>{workflow.ownerUserId ?? "—"}</span>
                </div>
                <div className="col-sm-6 mb-1">
                  <span className="d-block text-uppercase fw-semibold">
                    Default trigger
                  </span>
                  <span>{workflow.defaultTrigger ?? "—"}</span>
                </div>
                <div className="col-sm-6 mb-1">
                  <span className="d-block text-uppercase fw-semibold">
                    Created at
                  </span>
                  <span>{formatDateTime(workflow.createdAt)}</span>
                </div>
                <div className="col-sm-6 mb-1">
                  <span className="d-block text-uppercase fw-semibold">
                    Updated at
                  </span>
                  <span>{formatDateTime(workflow.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: quick actions / meta */}
        <div className="col-lg-4">
          <div className="card bg-dark border-secondary mb-3">
            <div className="card-body">
              <h3 className="h6 mb-3">Quick actions</h3>
              <button
                type="button"
                className="btn btn-primary btn-sm mb-2"
                onClick={() => navigate(`/workflows`)}
              >
                <FiArrowLeft className="me-1" />
                Back to workflows
              </button>
              <p className="text-muted small mb-0">
                From here you can inspect the workflow structure and then open
                the visual builder to edit it.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStructureTab = () => {
    if (graphError) {
      return (
        <div className="alert alert-danger py-2">
          <small>{graphError}</small>
        </div>
      );
    }

    if (isLoadingGraph && nodes.length === 0 && edges.length === 0) {
      return <p className="text-muted">Loading workflow structure…</p>;
    }

    if (nodes.length === 0 && edges.length === 0) {
      return (
        <p className="text-muted">
          No nodes or edges found for this workflow yet.
        </p>
      );
    }

    return (
      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card bg-dark border-secondary">
            <div className="card-body">
              <h3 className="h6 mb-3">
                <FiGitBranch className="me-2" />
                Nodes
              </h3>
              <div className="table-responsive">
                <table className="table table-dark table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Kind</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((n) => (
                      <tr key={n.id}>
                        <td>{n.id}</td>
                        <td>{n.name ?? "—"}</td>
                        <td>
                          <span className="badge bg-secondary">{n.kind}</span>
                        </td>
                        <td>
                          ({n.pos_x}, {n.pos_y})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card bg-dark border-secondary">
            <div className="card-body">
              <h3 className="h6 mb-3">Edges</h3>
              <div className="table-responsive">
                <table className="table table-dark table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Label</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {edges.map((e) => (
                      <tr key={e.id}>
                        <td>{e.id}</td>
                        <td>{e.from_node_id}</td>
                        <td>{e.to_node_id}</td>
                        <td>{e.label ?? "—"}</td>
                        <td>{e.priority ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted small mt-2 mb-0">
                This is the raw graph behind the visual builder.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderExecutionsTab = () => {
    return (
      <div className="card bg-dark border-secondary">
        <div className="card-body">
          <h3 className="h6 mb-2">Executions</h3>
          <p className="text-muted mb-2">
            This tab will eventually show the execution history and a timeline
            for this workflow.
          </p>
          <p className="small text-muted mb-0">
            For now you can run workflows from the list and inspect runs on the{" "}
            <code>/executions/:id</code> screen.
          </p>
        </div>
      </div>
    );
  };

  /* ------------ JSX ------------ */

  return (
    <div className="p-4">
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
          <h1 className="h3 mb-0">Workflow details</h1>
        </div>

        <div className="text-end">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/workflows")}
          >
            <FiPlay className="me-1" />
            Run from list
          </button>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={
              "nav-link " + (activeTab === "overview" ? "active" : "")
            }
            type="button"
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
        </li>
        <li className="nav-item">
          <button
            className={
              "nav-link " + (activeTab === "structure" ? "active" : "")
            }
            type="button"
            onClick={() => setActiveTab("structure")}
          >
            Nodes &amp; edges
          </button>
        </li>
        <li className="nav-item">
          <button
            className={
              "nav-link " + (activeTab === "executions" ? "active" : "")
            }
            type="button"
            onClick={() => setActiveTab("executions")}
          >
            Executions
          </button>
        </li>
      </ul>

      {activeTab === "overview" && renderOverviewTab()}
      {activeTab === "structure" && renderStructureTab()}
      {activeTab === "executions" && renderExecutionsTab()}
    </div>
  );
};

export default WorkflowDetailPage;
