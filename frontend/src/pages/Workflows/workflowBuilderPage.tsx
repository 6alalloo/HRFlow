import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  fetchWorkflows,
  fetchWorkflowGraph,
  executeWorkflow,
  createWorkflowNode,
  updateWorkflowNodePosition,
  createWorkflowEdge,
} from "../../api/workflows";
import type {
  WorkflowApi,
  WorkflowGraphMeta,
  WorkflowGraphNode,
  WorkflowGraphEdge,
} from "../../api/workflows";

type BuilderState = {
  workflowId: number | null;
  workflowMeta?: WorkflowGraphMeta;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
};

type DragState = {
  nodeId: number;
  offsetX: number;
  offsetY: number;
};

type PanState = {
  isPanning: boolean;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
};

type ConfigTab = "general" | "config" | "advanced";
type BuilderMode = "select" | "connect";

const WorkflowBuilderPage: React.FC = () => {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState] = useState<BuilderState>({
    workflowId: null,
    workflowMeta: undefined,
    nodes: [],
    edges: [],
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("general");

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);

  const [builderMode, setBuilderMode] = useState<BuilderMode>("select");
  const [connectFromNodeId, setConnectFromNodeId] = useState<number | null>(
    null
  );

  // Scrollable canvas container
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const isGlobalBuilder = !params.id;

  // ---------------- LOAD WORKFLOW + GRAPH ----------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSelectedNodeId(null);
      setActiveTab("general");
      setBuilderMode("select");
      setConnectFromNodeId(null);

      try {
        let workflowMeta: WorkflowGraphMeta | undefined;

        if (params.id) {
          // /workflows/:id/builder
          const numericId = Number(params.id);
          if (Number.isNaN(numericId)) {
            throw new Error("Invalid workflow ID in URL");
          }

          const graph = await fetchWorkflowGraph(numericId);
          if (cancelled) return;

          workflowMeta = graph.workflow;
          setState({
            workflowId: numericId,
            workflowMeta,
            nodes: graph.nodes,
            edges: graph.edges,
          });

          localStorage.setItem("hrflow:lastWorkflowId", String(numericId));
        } else {
          // /builder (global entry)
          const lastIdStr = localStorage.getItem("hrflow:lastWorkflowId");
          if (lastIdStr) {
            const lastId = Number(lastIdStr);
            if (!Number.isNaN(lastId)) {
              try {
                const graph = await fetchWorkflowGraph(lastId);
                if (!cancelled) {
                  workflowMeta = graph.workflow;
                  setState({
                    workflowId: lastId,
                    workflowMeta,
                    nodes: graph.nodes,
                    edges: graph.edges,
                  });
                }
                return;
              } catch (e) {
                console.warn(
                  "[WorkflowBuilderPage] Failed to load last workflow from storage, falling back to first workflow.",
                  e
                );
              }
            }
          }

          const workflows: WorkflowApi[] = await fetchWorkflows();
          if (cancelled) return;

          if (!workflows || workflows.length === 0) {
            setError(
              "No workflows found. Create a workflow from the Workflows page first."
            );
            setState({
              workflowId: null,
              workflowMeta: undefined,
              nodes: [],
              edges: [],
            });
            return;
          }

          const first = workflows[0];
          const graph = await fetchWorkflowGraph(first.id);
          if (cancelled) return;

          workflowMeta =
            graph.workflow ??
            ({
              id: first.id,
              name: first.name,
              description: first.description ?? null,
            } as WorkflowGraphMeta);

          setState({
            workflowId: first.id,
            workflowMeta,
            nodes: graph.nodes,
            edges: graph.edges,
          });

          localStorage.setItem("hrflow:lastWorkflowId", String(first.id));
        }
      } catch (e: unknown) {
        console.error("[WorkflowBuilderPage] Error loading builder:", e);
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "Failed to load workflow builder.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [params.id, location.pathname]);

  const workflowName =
    state.workflowMeta?.name ??
    (state.workflowId ? `Workflow #${state.workflowId}` : "No workflow");

  const nodeTypes: string[] = [
    "trigger",
    "http",
    "email",
    "database",
    "condition",
    "variable",
    "logger",
    "datetime",
    "cv_parse",
  ];

  // ---------------- TOOLBAR HANDLERS ----------------

  const handleBackClick = () => {
    if (state.workflowId) {
      navigate(`/workflows/${state.workflowId}`);
    } else {
      navigate("/workflows");
    }
  };

  const handleRunClick = async () => {
    if (!state.workflowId || isRunning) return;

    try {
      setIsRunning(true);
      const result = await executeWorkflow(state.workflowId);
      if (result.execution?.id) {
        navigate(`/executions/${result.execution.id}`);
      }
    } catch (e: unknown) {
      console.error("[WorkflowBuilderPage] Failed to run workflow:", e);
      alert("Failed to run workflow. Check console for details.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveClick = () => {
    console.log("[WorkflowBuilderPage] Save clicked (not implemented yet).");
    alert(
      "Save is not implemented yet. This will push node and edge changes to the backend."
    );
  };

  const handleResetViewClick = () => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    canvasEl.scrollLeft = 0;
    canvasEl.scrollTop = 0;
  };

  const handleCenterViewClick = () => {
    const canvasEl = canvasRef.current;
    if (!canvasEl || state.nodes.length === 0) return;

    const xs = state.nodes.map((n) => n.pos_x);
    const ys = state.nodes.map((n) => n.pos_y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const targetScrollLeft = Math.max(0, centerX - canvasEl.clientWidth / 2);
    const targetScrollTop = Math.max(0, centerY - canvasEl.clientHeight / 2);

    canvasEl.scrollLeft = targetScrollLeft;
    canvasEl.scrollTop = targetScrollTop;
  };

  const toggleConnectMode = () => {
    setBuilderMode((prev) => (prev === "select" ? "connect" : "select"));
    setConnectFromNodeId(null);
  };

  // ---------------- NODE CREATION ----------------

  const handleAddNodeClick = async (kind: string) => {
    if (!state.workflowId) {
      alert(
        "No workflow selected. Open a workflow from the Workflows page first."
      );
      return;
    }

    try {
      const canvasEl = canvasRef.current;
      // Create near current viewport top-left so it’s always visible
      const posX = canvasEl ? canvasEl.scrollLeft + 120 : undefined;
      const posY = canvasEl ? canvasEl.scrollTop + 80 : undefined;

      const newNode = await createWorkflowNode(state.workflowId, {
        kind,
        posX,
        posY,
      });

      setState((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));

      setSelectedNodeId(newNode.id);
      setActiveTab("general");
    } catch (e: unknown) {
      console.error("[WorkflowBuilderPage] Failed to create node:", e);
      alert("Failed to create node. Check console for details.");
    }
  };

  // Drag from palette → canvas
  const handlePaletteDragStart = (
    e: React.DragEvent<HTMLButtonElement>,
    kind: string
  ) => {
    e.dataTransfer.setData("application/x-hrflow-node-kind", kind);
    e.dataTransfer.setData("text/plain", kind); // fallback
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Needed so drop fires
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleCanvasDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (!state.workflowId) {
      alert(
        "No workflow selected. Open a workflow from the Workflows page first."
      );
      return;
    }

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const kind =
      e.dataTransfer.getData("application/x-hrflow-node-kind") ||
      e.dataTransfer.getData("text/plain");

    if (!kind) {
      return;
    }

    const rect = canvasEl.getBoundingClientRect();

    // Adjust for scroll so we get coordinates in canvas space
    const posX = Math.round(
      e.clientX - rect.left + canvasEl.scrollLeft
    );
    const posY = Math.round(
      e.clientY - rect.top + canvasEl.scrollTop
    );

    try {
      const newNode = await createWorkflowNode(state.workflowId, {
        kind,
        posX,
        posY,
      });

      setState((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));

      setSelectedNodeId(newNode.id);
      setActiveTab("general");
    } catch (err) {
      console.error(
        "[WorkflowBuilderPage] Failed to create node via drop:",
        err
      );
      alert("Failed to create node. Check console for details.");
    }
  };

  // ---------------- NODE SELECTION / EDGE CREATION ----------------

  const selectedNode: WorkflowGraphNode | null =
    selectedNodeId !== null
      ? state.nodes.find((n) => n.id === selectedNodeId) ?? null
      : null;

  const prettyConfig =
    selectedNode && selectedNode.config
      ? JSON.stringify(selectedNode.config, null, 2)
      : "{ }";

  const updateSelectedNode = (
    updates: Partial<Pick<WorkflowGraphNode, "name">>
  ) => {
    if (selectedNodeId === null) return;

    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === selectedNodeId ? { ...node, ...updates } : node
      ),
    }));
  };

  const handleNodeClick = async (nodeId: number) => {
    // Edge connect mode
    if (builderMode === "connect") {
      if (!connectFromNodeId) {
        // First node selected
        setConnectFromNodeId(nodeId);
        setSelectedNodeId(nodeId);
        setActiveTab("general");
        return;
      }

      if (connectFromNodeId === nodeId) {
        // Clicking the same node again cancels
        setConnectFromNodeId(null);
        return;
      }

      // Second node selected → create edge
      if (!state.workflowId) return;

      try {
        const newEdge = await createWorkflowEdge(state.workflowId, {
          fromNodeId: connectFromNodeId,
          toNodeId: nodeId,
        });

        setState((prev) => ({
          ...prev,
          edges: [...prev.edges, newEdge],
        }));
      } catch (err) {
        console.error("[WorkflowBuilderPage] Failed to create edge:", err);
        alert("Failed to create edge. Check console for details.");
      } finally {
        // Exit connect mode after connecting
        setConnectFromNodeId(null);
        setBuilderMode("select");
      }

      return;
    }

    // Normal select mode
    setSelectedNodeId((current) => (current === nodeId ? null : nodeId));
    setActiveTab("general");
  };

  // ---------------- DRAG NODES ----------------

  const handleNodeMouseDown = (
    node: WorkflowGraphNode,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    // In connect mode, clicking nodes is for edges, not dragging
    if (builderMode === "connect") {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();

    // Mouse position in canvas "world" coordinates
    const worldX = e.clientX - rect.left + canvasEl.scrollLeft;
    const worldY = e.clientY - rect.top + canvasEl.scrollTop;

    setDragState({
      nodeId: node.id,
      offsetX: worldX - node.pos_x, // where inside the node you grabbed
      offsetY: worldY - node.pos_y,
    });

    setSelectedNodeId(node.id);
    setActiveTab("general");
  };

  // ---------------- PAN CANVAS (DRAG BACKGROUND) ----------------

  const handleCanvasBackgroundMouseDown = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    // Don’t start a pan if we’re already dragging a node
    if (dragState) return;

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    setPanState({
      isPanning: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: canvasEl.scrollLeft,
      scrollTop: canvasEl.scrollTop,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    // First: dragging a node
    if (dragState) {
      const rect = canvasEl.getBoundingClientRect();

      const worldX = e.clientX - rect.left + canvasEl.scrollLeft;
      const worldY = e.clientY - rect.top + canvasEl.scrollTop;

      const newX = worldX - dragState.offsetX;
      const newY = worldY - dragState.offsetY;

      const clampedX = Math.max(0, Math.round(newX));
      const clampedY = Math.max(0, Math.round(newY));

      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === dragState.nodeId
            ? { ...node, pos_x: clampedX, pos_y: clampedY }
            : node
        ),
      }));
      return; // don't also pan
    }

    // Second: panning
    if (panState?.isPanning) {
      const dx = e.clientX - panState.startX;
      const dy = e.clientY - panState.startY;

      canvasEl.scrollLeft = panState.scrollLeft - dx;
      canvasEl.scrollTop = panState.scrollTop - dy;
    }
  };

  const finishDragOrPan = async () => {
    const canvasEl = canvasRef.current;

    if (!canvasEl) {
      setDragState(null);
      setPanState(null);
      return;
    }

    if (dragState && state.workflowId) {
      const node = state.nodes.find((n) => n.id === dragState.nodeId);
      setDragState(null);
      setPanState(null);
      if (!node) return;

      try {
        await updateWorkflowNodePosition(
          state.workflowId,
          node.id,
          node.pos_x,
          node.pos_y
        );
      } catch (e) {
        console.error(
          "[WorkflowBuilderPage] Failed to persist node position:",
          e
        );
      }
      return;
    }

    // Only panning
    setDragState(null);
    setPanState(null);
  };

  const handleCanvasMouseUp = () => {
    if (dragState || panState?.isPanning) {
      void finishDragOrPan();
    }
  };

  const handleCanvasMouseLeave = () => {
    if (dragState || panState?.isPanning) {
      void finishDragOrPan();
    }
  };

  // ---------------- RENDER ----------------

  if (loading) {
    return (
      <div className="py-4">
        <div className="text-muted">Loading workflow builder...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
        <h1 className="h4 mb-3">Workflow Builder</h1>
        <div className="alert alert-danger">{error}</div>
        <button
          className="btn btn-outline-light btn-sm"
          onClick={() => navigate("/workflows")}
        >
          Back to Workflows
        </button>
      </div>
    );
  }

  const canvasCursor =
    dragState || panState?.isPanning ? "grabbing" : "default";

  const NODE_WIDTH = 200; // visual estimate used for edge anchors
  const NODE_HEIGHT = 80;

  return (
    <div className="py-3">
      {/* Header: title + toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-1">Workflow Builder</h1>
          <div className="text-muted small">
            {workflowName}
            {state.workflowMeta?.description
              ? ` · ${state.workflowMeta.description}`
              : ""}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-secondary">
            {isGlobalBuilder ? "Global builder" : "Workflow builder"}
          </span>
          <button
            className={
              "btn btn-outline-secondary btn-sm" +
              (builderMode === "connect" ? " active" : "")
            }
            onClick={toggleConnectMode}
          >
            {builderMode === "connect"
              ? connectFromNodeId
                ? "Pick target node…"
                : "Connect mode (pick source)"
              : "Connect nodes"}
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={handleBackClick}
          >
            Back to Workflows
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={handleResetViewClick}
          >
            Reset view
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={handleCenterViewClick}
          >
            Center view
          </button>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={handleSaveClick}
          >
            Save
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleRunClick}
            disabled={isRunning || !state.workflowId}
          >
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div
        className="row g-3"
        style={{
          minHeight: "calc(100vh - 140px)",
        }}
      >
        {/* Left: Palette */}
        <div className="col-2 d-flex flex-column">
          <div
            className="card h-100"
            style={{
              backgroundColor: "#070716",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div className="card-body d-flex flex-column">
              <h2 className="h6 mb-3">Node Palette</h2>
              <p className="text-muted small mb-2">
                Click or drag a type to add nodes.
              </p>
              <div className="d-flex flex-column gap-1">
                {nodeTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    draggable
                    onDragStart={(e) => handlePaletteDragStart(e, type)}
                    className="btn btn-sm btn-outline-light text-start"
                    style={{ borderRadius: "999px" }}
                    onClick={() => handleAddNodeClick(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="col-7 d-flex flex-column">
          <div
            className="card flex-grow-1"
            style={{
              background:
                "radial-gradient(circle at top left, #111827, #020617 60%)",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div className="card-body p-2 d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-2 px-2">
                <span className="small text-muted">Canvas</span>
                <span className="small text-muted">
                  Nodes: {state.nodes.length} · Edges: {state.edges.length}
                </span>
              </div>

              <div
                ref={canvasRef}
                className="flex-grow-1 position-relative"
                style={{
                  borderRadius: "0.75rem",
                  border: "1px dashed rgba(255,255,255,0.12)",
                  backgroundImage:
                    "linear-gradient(to right, rgba(148,163,184,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.15) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  overflow: "auto",
                  cursor: canvasCursor,
                }}
                onMouseDown={handleCanvasBackgroundMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
                onDragOver={handleCanvasDragOver}
                onDrop={handleCanvasDrop}
              >
                {/* Edges as SVG lines */}
                <svg
                  className="position-absolute"
                  style={{
                    inset: 0,
                    pointerEvents: "none",
                  }}
                >
                  {state.edges.map((edge) => {
                    const from = state.nodes.find(
                      (n) => n.id === edge.from_node_id
                    );
                    const to = state.nodes.find(
                      (n) => n.id === edge.to_node_id
                    );
                    if (!from || !to) return null;

                    const fromX = from.pos_x + NODE_WIDTH / 2;
                    const fromY = from.pos_y + NODE_HEIGHT / 2;
                    const toX = to.pos_x + NODE_WIDTH / 2;
                    const toY = to.pos_y + NODE_HEIGHT / 2;

                    const isFromPending =
                      builderMode === "connect" &&
                      connectFromNodeId === from.id;

                    return (
                      <line
                        key={edge.id}
                        x1={fromX}
                        y1={fromY}
                        x2={toX}
                        y2={toY}
                        stroke={
                          isFromPending
                            ? "#3b82f6"
                            : "rgba(148,163,184,0.7)"
                        }
                        strokeWidth={2}
                      />
                    );
                  })}
                </svg>

                {/* Nodes */}
                {state.nodes.map((node) => {
                  const isSelected = node.id === selectedNodeId;
                  const isConnectSource =
                    builderMode === "connect" &&
                    connectFromNodeId === node.id;

                  return (
                    <button
                      key={node.id}
                      type="button"
                      className="position-absolute text-start p-0 border-0 bg-transparent"
                      style={{
                        left: `${node.pos_x}px`,
                        top: `${node.pos_y}px`,
                        minWidth: "180px",
                        cursor:
                          builderMode === "connect" ? "pointer" : "grab",
                      }}
                      onMouseDown={(e) => handleNodeMouseDown(node, e)}
                      onClick={() => void handleNodeClick(node.id)}
                    >
                      <div
                        className="p-2"
                        style={{
                          borderRadius: "0.85rem",
                          backgroundColor: "rgba(15,23,42,0.95)",
                          border: isConnectSource
                            ? "2px dashed #3b82f6"
                            : isSelected
                            ? "2px solid #3b82f6"
                            : "1px solid rgba(148,163,184,0.5)",
                          boxShadow: isSelected
                            ? "0 0 0 1px rgba(59,130,246,0.7), 0 18px 35px rgba(15,23,42,0.9)"
                            : "0 10px 25px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,1)",
                          transition:
                            "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease",
                          transform: isSelected ? "translateY(-1px)" : "none",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small text-uppercase text-muted">
                            {node.kind}
                          </span>
                          <span
                            className="badge bg-primary"
                            style={{ fontSize: "0.65rem" }}
                          >
                            #{node.id}
                          </span>
                        </div>
                        <div className="fw-semibold small text-light">
                          {node.name || "Untitled node"}
                        </div>
                        {node.config &&
                          Object.keys(node.config).length > 0 && (
                            <div className="mt-1 text-muted small">
                              <code style={{ fontSize: "0.7rem" }}>
                                {JSON.stringify(node.config)}
                              </code>
                            </div>
                          )}
                      </div>
                    </button>
                  );
                })}

                {state.nodes.length === 0 && (
                  <div className="h-100 d-flex align-items-center justify-content-center text-muted small">
                    No nodes yet. Click or drag types from the palette on the
                    left.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Config Panel */}
        <div className="col-3 d-flex flex-column">
          <div
            className="card h-100"
            style={{
              backgroundColor: "#070716",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div className="card-body d-flex flex-column">
              <h2 className="h6 mb-2">Node Configuration</h2>

              {!selectedNode && (
                <p className="text-muted small mb-0">
                  Select a node on the canvas to view its details and
                  configuration.
                </p>
              )}

              {selectedNode && (
                <>
                  {/* Tabs */}
                  <ul className="nav nav-pills mb-3 small">
                    <li className="nav-item">
                      <button
                        type="button"
                        className={
                          "nav-link px-3 py-1 " +
                          (activeTab === "general" ? "active" : "")
                        }
                        onClick={() => setActiveTab("general")}
                      >
                        General
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        type="button"
                        className={
                          "nav-link px-3 py-1 " +
                          (activeTab === "config" ? "active" : "")
                        }
                        onClick={() => setActiveTab("config")}
                      >
                        Config
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        type="button"
                        className={
                          "nav-link px-3 py-1 " +
                          (activeTab === "advanced" ? "active" : "")
                        }
                        onClick={() => setActiveTab("advanced")}
                      >
                        Advanced
                      </button>
                    </li>
                  </ul>

                  {/* Tab contents */}
                  {activeTab === "general" && (
                    <div className="small">
                      <div className="mb-3">
                        <label className="text-muted form-label mb-1">
                          Node name
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={selectedNode.name ?? ""}
                          placeholder="Enter a friendly name"
                          onChange={(e) =>
                            updateSelectedNode({ name: e.target.value })
                          }
                        />
                        <div className="form-text">
                          This is how the node will appear on the canvas and in
                          logs.
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="text-muted">Node type</div>
                        <div className="fw-semibold text-uppercase">
                          {selectedNode.kind}
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="text-muted">Node ID</div>
                        <div className="fw-semibold">#{selectedNode.id}</div>
                      </div>

                      <div className="mb-2">
                        <div className="text-muted">Position</div>
                        <div className="fw-semibold">
                          ({selectedNode.pos_x}, {selectedNode.pos_y})
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="text-muted">Has configuration</div>
                        <div className="fw-semibold">
                          {selectedNode.config &&
                          Object.keys(selectedNode.config).length > 0
                            ? "Yes"
                            : "No"}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "config" && (
                    <div className="small">
                      <div className="text-muted mb-2">
                        Configuration (technical view)
                      </div>
                      <div
                        style={{
                          borderRadius: "0.5rem",
                          backgroundColor: "#020617",
                          border: "1px solid rgba(148,163,184,0.4)",
                          padding: "0.5rem",
                          maxHeight: "260px",
                          overflow: "auto",
                        }}
                      >
                        <pre
                          className="mb-0"
                          style={{
                            fontSize: "0.75rem",
                            lineHeight: 1.4,
                            color: "#e5e7eb",
                          }}
                        >
                          <code>{prettyConfig}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {activeTab === "advanced" && (
                    <div className="small text-muted">
                      This tab will later hold advanced options, such as how
                      this node interacts with external systems (e.g. email
                      gateways, HTTP requests, AI agents, etc.).
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilderPage;