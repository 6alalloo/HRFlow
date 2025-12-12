import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  fetchWorkflows,
  fetchWorkflowGraph,
  executeWorkflow,
  createWorkflowNode,
  updateWorkflowNodePosition,
  updateWorkflowNode,
  createWorkflowEdge,
  deleteWorkflowNode,
  deleteWorkflowEdge,
  type WorkflowApi,
  type WorkflowGraphMeta,
  type WorkflowGraphNode,
  type WorkflowGraphEdge,
} from "../../api/workflows";

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  BaseEdge,
  getSmoothStepPath,
  type Connection,
  type Node as RFNode,
  type Edge as RFEdge,
  type EdgeProps,
  type NodeDragHandler,
} from "reactflow";

import HRFlowNode, {
  type HRFlowNodeData,
} from "../../components/HRFlowNode";

type BuilderState = {
  workflowId: number | null;
  workflowMeta?: WorkflowGraphMeta;
  nodes: WorkflowGraphNode[];
};

type ConfigTab = "general" | "config" | "advanced";

const nodeTypesMap = {
  hrflow: HRFlowNode,
};

/**
 * Custom edge with a small delete (X) button rendered near the middle.
 */
const DeletableEdge: React.FC<EdgeProps> = (props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    data,
  } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const onDelete = (data as any)?.onDelete as
    | ((edgeId: string) => void)
    | undefined;

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
  };

  return (
    <>
      <BaseEdge path={edgePath} style={style} markerEnd={markerEnd} />
      <foreignObject
        width={24}
        height={24}
        x={labelX - 10}
        y={labelY - 10}
        requiredExtensions="http://www.w3.org/1999/xhtml"
        style={{ overflow: "visible" }}
      >
        <div
          onClick={handleDeleteClick}
          className="edge-delete-btn"
          style={{
            width: "22px",
            height: "22px",
            cursor: "pointer",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transition: "opacity 0.15s ease-out, transform 0.15s ease-out",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            stroke="#ff4d4d"
            strokeWidth="2.3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
        </div>
      </foreignObject>
    </>
  );
};

const edgeTypes = {
  deletable: DeletableEdge,
};

const nodePaletteTypes: string[] = [
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

// Helpers to normalise edge shape (works with fromNodeId/toNodeId OR from_node_id/to_node_id)
function getFromNodeId(edge: WorkflowGraphEdge): number {
  if ("fromNodeId" in edge) return (edge as any).fromNodeId;
  return (edge as { from_node_id: number }).from_node_id;
}

function getToNodeId(edge: WorkflowGraphEdge): number {
  if ("toNodeId" in edge) return (edge as any).toNodeId;
  return (edge as { to_node_id: number }).to_node_id;
}

function toReactFlowNode(node: WorkflowGraphNode): RFNode<HRFlowNodeData> {
  return {
    id: String(node.id),
    type: "hrflow",
    position: { x: node.pos_x, y: node.pos_y },
    data: {
      backendId: node.id,
      name: node.name,
      kind: node.kind,
      config: node.config ?? {},
    },
  };
}

const WorkflowBuilderContent: React.FC = () => {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { fitView, project } = useReactFlow();
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const hasInitialFit = useRef(false);

  const [state, setState] = useState<BuilderState>({
    workflowId: null,
    workflowMeta: undefined,
    nodes: [],
  });

  const [rfNodes, setRfNodes, onNodesChange] =
    useNodesState<HRFlowNodeData>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<RFEdge>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("general");

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // autosave tracking
  const [pendingSaves, setPendingSaves] = useState(0);
  const beginSave = useCallback(
    () => setPendingSaves((n) => n + 1),
    []
  );
  const endSave = useCallback(
    () => setPendingSaves((n) => Math.max(0, n - 1)),
    []
  );
  const isSaving = pendingSaves > 0;

  const isGlobalBuilder = !params.id;

  // --------------- EDGE DELETE CLICK HANDLER ---------------

  const handleEdgeDeleteClick = useCallback(
    async (edgeIdStr: string) => {
      const edgeId = Number(edgeIdStr);
      if (!state.workflowId || Number.isNaN(edgeId)) {
        // Still remove from UI if ID is weird
        setRfEdges((current) => current.filter((e) => e.id !== edgeIdStr));
        return;
      }

      // Optimistic removal
      setRfEdges((current) => current.filter((e) => e.id !== edgeIdStr));

      try {
        beginSave();
        await deleteWorkflowEdge(state.workflowId, edgeId);
      } catch (e) {
        console.error("[WorkflowBuilderPage] Failed to delete edge on server:", e);
        alert("Failed to delete edge on the server. Check console logs.");
      } finally {
        endSave();
      }
    },
    [state.workflowId, setRfEdges, beginSave, endSave]
  );

  // Helper to map backend edges to RF edges, wiring the delete callback
  const mapToReactFlowEdge = useCallback(
    (edge: WorkflowGraphEdge): RFEdge => ({
      id: String(edge.id),
      source: String(getFromNodeId(edge)),
      target: String(getToNodeId(edge)),
      label: edge.label ?? undefined,
      type: "deletable",
      data: { onDelete: handleEdgeDeleteClick },
    }),
    [handleEdgeDeleteClick]
  );

  // --------------- LOAD WORKFLOW + GRAPH ----------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSelectedNodeId(null);
      setActiveTab("general");
      setDeleteConfirmOpen(false);
      hasInitialFit.current = false;

      try {
        let workflowMeta: WorkflowGraphMeta | undefined;
        let workflowId: number | null = null;
        let nodes: WorkflowGraphNode[] = [];
        let edges: WorkflowGraphEdge[] = [];

        if (params.id) {
          const numericId = Number(params.id);
          if (Number.isNaN(numericId)) {
            throw new Error("Invalid workflow ID in URL");
          }

          const graph = await fetchWorkflowGraph(numericId);
          if (cancelled) return;

          workflowMeta = graph.workflow;
          workflowId = numericId;
          nodes = graph.nodes;
          edges = graph.edges;

          localStorage.setItem("hrflow:lastWorkflowId", String(numericId));
        } else {
          const lastIdStr = localStorage.getItem("hrflow:lastWorkflowId");

          if (lastIdStr) {
            const lastId = Number(lastIdStr);
            if (!Number.isNaN(lastId)) {
              try {
                const graph = await fetchWorkflowGraph(lastId);
                if (!cancelled) {
                  workflowMeta = graph.workflow;
                  workflowId = lastId;
                  nodes = graph.nodes;
                  edges = graph.edges;
                  localStorage.setItem(
                    "hrflow:lastWorkflowId",
                    String(lastId)
                  );
                }
              } catch (err) {
                console.warn(
                  "[WorkflowBuilderPage] Failed to load last workflow from storage, falling back to first workflow.",
                  err
                );
              }
            }
          }

          // Fallback: first workflow from list
          if (!workflowId) {
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
              });
              setRfNodes([]);
              setRfEdges([]);
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

            workflowId = first.id;
            nodes = graph.nodes;
            edges = graph.edges;

            localStorage.setItem("hrflow:lastWorkflowId", String(first.id));
          }
        }

        if (cancelled) return;

        setState({
          workflowId,
          workflowMeta,
          nodes,
        });

        setRfNodes(nodes.map(toReactFlowNode));
        setRfEdges(edges.map(mapToReactFlowEdge));
        setPendingSaves(0);
      } catch (e: unknown) {
        console.error("[WorkflowBuilderPage] Error loading builder:", e);
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "Failed to load workflow builder.";
          setError(message);
          setRfNodes([]);
          setRfEdges([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [params.id, location.pathname, setRfNodes, setRfEdges, mapToReactFlowEdge]);

  // Initial fitView once nodes are loaded
  useEffect(() => {
    if (!loading && !hasInitialFit.current && rfNodes.length > 0) {
      fitView({ padding: 0.4, duration: 200 });
      hasInitialFit.current = true;
    }
  }, [loading, rfNodes, fitView]);

  const workflowName =
    state.workflowMeta?.name ??
    (state.workflowId ? `Workflow #${state.workflowId}` : "No workflow");

  // --------------- TOOLBAR HANDLERS ----------------

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
    alert("This workflow uses autosave. Changes are saved as you edit.");
  };

  const handleResetViewClick = () => {
    fitView({ padding: 0.3, duration: 200 });
  };

  const handleCenterViewClick = () => {
    fitView({ padding: 0.6, duration: 200 });
  };

  // --------------- NODE CREATION (click + drag) ---------------

  const handleAddNodeClick = useCallback(
    async (kind: string) => {
      if (!state.workflowId) {
        alert(
          "No workflow selected. Open a workflow from the Workflows page first."
        );
        return;
      }

      try {
        let posX = 200;
        let posY = 120;

        if (flowWrapperRef.current) {
          const bounds = flowWrapperRef.current.getBoundingClientRect();
          const centerPoint = project({
            x: bounds.left + bounds.width / 2,
            y: bounds.top + bounds.height / 2,
          });
          posX = centerPoint.x;
          posY = centerPoint.y;
        }

        beginSave();
        const newNode = await createWorkflowNode(state.workflowId, {
          kind,
          posX,
          posY,
        });

        setState((prev) => ({
          ...prev,
          nodes: [...prev.nodes, newNode],
        }));

        setRfNodes((prev) => [...prev, toReactFlowNode(newNode)]);

        setSelectedNodeId(newNode.id);
        setActiveTab("general");
      } catch (e) {
        console.error("[WorkflowBuilderPage] Failed to create node:", e);
        alert("Failed to create node. Check console for details.");
      } finally {
        endSave();
      }
    },
    [project, state.workflowId, setRfNodes, beginSave, endSave]
  );

  const handlePaletteDragStart = (
    e: React.DragEvent<HTMLButtonElement>,
    kind: string
  ) => {
    e.dataTransfer.setData("application/reactflow", kind);
    e.dataTransfer.setData("text/plain", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleCanvasDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (!state.workflowId) {
        alert(
          "No workflow selected. Open a workflow from the Workflows page first."
        );
        return;
      }

      const kind =
        event.dataTransfer.getData("application/reactflow") ||
        event.dataTransfer.getData("text/plain");

      if (!kind) return;
      if (!flowWrapperRef.current) return;

      const bounds = flowWrapperRef.current.getBoundingClientRect();

      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      try {
        beginSave();
        const newNode = await createWorkflowNode(state.workflowId, {
          kind,
          posX: position.x,
          posY: position.y,
        });

        setState((prev) => ({
          ...prev,
          nodes: [...prev.nodes, newNode],
        }));

        setRfNodes((prev) => [...prev, toReactFlowNode(newNode)]);

        setSelectedNodeId(newNode.id);
        setActiveTab("general");
      } catch (e) {
        console.error(
          "[WorkflowBuilderPage] Failed to create node via drop:",
          e
        );
        alert("Failed to create node. Check console for details.");
      } finally {
        endSave();
      }
    },
    [project, state.workflowId, setRfNodes, beginSave, endSave]
  );

  // --------------- SELECTION + CONFIG PANEL ---------------

  const selectedNode: WorkflowGraphNode | null =
    selectedNodeId !== null
      ? state.nodes.find((n) => n.id === selectedNodeId) ?? null
      : null;

  const prettyConfig =
    selectedNode && selectedNode.config
      ? JSON.stringify(selectedNode.config, null, 2)
      : "{ }";

  const updateSelectedNode = useCallback(
    (updates: Partial<Pick<WorkflowGraphNode, "name">>) => {
      if (selectedNodeId === null) return;

      // 1) Update builder's internal node list
      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === selectedNodeId ? { ...node, ...updates } : node
        ),
      }));

      // 2) Update React Flow node data so the label on the canvas updates
      setRfNodes((prev) =>
        prev.map((node) =>
          Number(node.id) === selectedNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...(updates.name !== undefined
                    ? { name: updates.name ?? null }
                    : {}),
                },
              }
            : node
        )
      );

      // 3) Persist to backend (name only for now)
      if (state.workflowId && updates.name !== undefined) {
        const workflowId = state.workflowId;
        const name = updates.name ?? null;

        (async () => {
          try {
            beginSave();
            await updateWorkflowNode(workflowId, selectedNodeId, { name });
          } catch (e) {
            console.error(
              "[WorkflowBuilderPage] Failed to persist node name:",
              e
            );
          } finally {
            endSave();
          }
        })();
      }
    },
    [selectedNodeId, state.workflowId, setRfNodes, beginSave, endSave]
  );

  const handleDeleteSelectedNode = useCallback(async () => {
    if (selectedNodeId === null || !state.workflowId) {
      return;
    }

    const nodeId = selectedNodeId;
    const workflowId = state.workflowId;

    // Optimistic UI: remove from React Flow + local state immediately
    setRfNodes((prev) =>
      prev.filter((n) => (n.data as HRFlowNodeData).backendId !== nodeId)
    );

    setRfEdges((prev) =>
      prev.filter(
        (e) => e.source !== String(nodeId) && e.target !== String(nodeId)
      )
    );

    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
    }));

    setSelectedNodeId(null);
    setDeleteConfirmOpen(false);

    try {
      beginSave();
      await deleteWorkflowNode(workflowId, nodeId);
    } catch (error) {
      console.error("[WorkflowBuilderPage] Failed to delete node:", error);
      alert("Failed to delete node on the server. Check console for details.");
    } finally {
      endSave();
    }
  }, [
    selectedNodeId,
    state.workflowId,
    setRfNodes,
    setRfEdges,
    setState,
    beginSave,
    endSave,
  ]);

  const handleDeleteNodeCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
  }, []);

  const updateSelectedNodeConfig = useCallback(
    (partialConfig: Record<string, unknown>) => {
      if (selectedNodeId === null || !state.workflowId) return;

      const existingNode = state.nodes.find((n) => n.id === selectedNodeId);
      const currentConfig = (existingNode?.config ?? {}) as Record<
        string,
        unknown
      >;
      const newConfig = { ...currentConfig, ...partialConfig };

      // 1) Update our in-memory graph state
      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === selectedNodeId ? { ...node, config: newConfig } : node
        ),
      }));

      // 2) Update React Flow node data so the canvas has the latest config
      setRfNodes((prev) =>
        prev.map((rfNode) =>
          Number(rfNode.id) === selectedNodeId
            ? {
                ...rfNode,
                data: {
                  ...(rfNode.data as HRFlowNodeData),
                  config: newConfig,
                },
              }
            : rfNode
        )
      );

      // 3) Persist to backend
      (async () => {
        try {
          beginSave();
          await updateWorkflowNode(state.workflowId!, selectedNodeId, {
            config: newConfig,
          });
        } catch (e) {
          console.error(
            "[WorkflowBuilderPage] Failed to persist node config:",
            e
          );
        } finally {
          endSave();
        }
      })();
    },
    [selectedNodeId, state.workflowId, state.nodes, setRfNodes, beginSave, endSave]
  );

  // --------------- NODE POSITION SYNC ---------------

  const handleNodeDragStop = useCallback<NodeDragHandler>(
    (_event, node) => {
      const data = node.data as HRFlowNodeData;
      const backendId = data.backendId;
      const { x, y } = node.position;

      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === backendId ? { ...n, pos_x: x, pos_y: y } : n
        ),
      }));

      if (state.workflowId) {
        (async () => {
          try {
            beginSave();
            await updateWorkflowNodePosition(state.workflowId!, backendId, x, y);
          } catch (e) {
            console.error(
              "[WorkflowBuilderPage] Failed to persist node position:",
              e
            );
          } finally {
            endSave();
          }
        })();
      }
    },
    [state.workflowId, beginSave, endSave]
  );

  // --------------- CONNECT HANDLER ---------------

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!state.workflowId) return;
      if (!connection.source || !connection.target) return;

      const fromId = Number(connection.source);
      const toId = Number(connection.target);

      // Optimistic edge so you SEE it immediately
      const tempEdgeId = `temp-${Date.now()}`;
      const tempEdge: RFEdge = {
        id: tempEdgeId,
        source: connection.source,
        target: connection.target,
        type: "deletable",
        data: { onDelete: handleEdgeDeleteClick },
      };

      setRfEdges((current) => addEdge(tempEdge, current));

      try {
        beginSave();
        const created = await createWorkflowEdge(state.workflowId, {
          fromNodeId: fromId,
          toNodeId: toId,
        });

        setRfEdges((current) =>
          current.map((edge) =>
            edge.id === tempEdgeId
              ? {
                  id: String(created.id),
                  source: String(getFromNodeId(created)),
                  target: String(getToNodeId(created)),
                  type: "deletable",
                  data: { onDelete: handleEdgeDeleteClick },
                }
              : edge
          )
        );
      } catch (error) {
        console.error("[WorkflowBuilderPage] Failed to create edge:", error);
        setRfEdges((current) =>
          current.filter((edge) => edge.id !== tempEdgeId)
        );
        alert("Failed to create edge. Check console for details.");
      } finally {
        endSave();
      }
    },
    [state.workflowId, setRfEdges, beginSave, endSave, handleEdgeDeleteClick]
  );

  // --------------- SELECTION CHANGE ---------------

  const handleSelectionChange = useCallback(
    (params: { nodes: RFNode[]; edges: RFEdge[] }) => {
      const nodes = params.nodes ?? [];
      if (nodes.length === 0) {
        setSelectedNodeId(null);
        setDeleteConfirmOpen(false);
        return;
      }

      const first = nodes[0];
      const idNum = Number(first.id);
      setSelectedNodeId(idNum);
      setActiveTab("general");
      setDeleteConfirmOpen(false);
    },
    []
  );

  // --------------- RENDER ---------------

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
          <span
            className={
              "badge small " +
              (isSaving ? "bg-warning text-dark" : "bg-success")
            }
          >
            {isSaving ? "Saving…" : "All changes saved"}
          </span>
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
                {nodePaletteTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    draggable
                    onDragStart={(e) => handlePaletteDragStart(e, type)}
                    className="btn btn-sm btn-outline-light text-start"
                    style={{ borderRadius: "999px" }}
                    onClick={() => void handleAddNodeClick(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center: React Flow Canvas */}
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
                  Nodes: {rfNodes.length} · Edges: {rfEdges.length}
                </span>
              </div>

              <div
                ref={flowWrapperRef}
                className="flex-grow-1"
                style={{
                  borderRadius: "0.75rem",
                  border: "1px dashed rgba(255,255,255,0.12)",
                  overflow: "hidden",
                }}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
              >
                <ReactFlow
                  nodes={rfNodes}
                  edges={rfEdges}
                  nodeTypes={nodeTypesMap}
                  edgeTypes={edgeTypes}
                  fitView
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeDragStop={handleNodeDragStop}
                  onConnect={handleConnect}
                  onSelectionChange={handleSelectionChange}
                  proOptions={{ hideAttribution: false }}
                  defaultEdgeOptions={{
                    type: "deletable",
                    style: { stroke: "#38bdf8", strokeWidth: 2 },
                  }}
                  connectionLineStyle={{
                    stroke: "#38bdf8",
                    strokeWidth: 2,
                  }}
                >
                  <Background
                    gap={24}
                    size={1}
                    color="rgba(148,163,184,0.2)"
                  />
                  <MiniMap
                    pannable
                    zoomable
                    style={{
                      backgroundColor: "#020617",
                      borderRadius: "0.75rem",
                    }}
                  />
                  <Controls />
                </ReactFlow>
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
                          This is how the node will appear on the canvas and
                          in logs.
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

                      <div className="mt-3 pt-2 border-top border-secondary">
                        {!deleteConfirmOpen && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger w-100"
                              onClick={() => setDeleteConfirmOpen(true)}
                            >
                              Delete node
                            </button>
                            <div className="form-text">
                              This will also remove any edges connected to
                              this node.
                            </div>
                          </>
                        )}

                        {deleteConfirmOpen && (
                          <div className="alert alert-danger py-2 px-3 mt-2 mb-0 small">
                            <div className="fw-semibold mb-1">
                              Delete this node and all edges connected to it?
                            </div>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-danger btn-sm flex-grow-1"
                                onClick={() => void handleDeleteSelectedNode()}
                              >
                                Yes, delete
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-light btn-sm"
                                onClick={handleDeleteNodeCancel}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "config" && selectedNode && (
                    <div className="small">
                      {/* Friendly forms per node type */}
                      {(() => {
                        const cfg = (selectedNode.config ?? {}) as Record<
                          string,
                          any
                        >;

                        if (selectedNode.kind === "http") {
                          return (
                            <>
                              <div className="text-muted mb-2">
                                HTTP node configuration
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Method
                                </label>
                                <select
                                  className="form-select form-select-sm"
                                  value={cfg.method ?? "GET"}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      method: e.target.value,
                                    })
                                  }
                                >
                                  <option value="GET">GET</option>
                                  <option value="POST">POST</option>
                                  <option value="PUT">PUT</option>
                                  <option value="PATCH">PATCH</option>
                                  <option value="DELETE">DELETE</option>
                                </select>
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  URL
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.url ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      url: e.target.value,
                                    })
                                  }
                                  placeholder="https://api.example.com/resource"
                                />
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Headers (JSON or key:value lines)
                                </label>
                                <textarea
                                  className="form-control form-control-sm"
                                  rows={3}
                                  value={cfg.headers ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      headers: e.target.value,
                                    })
                                  }
                                  placeholder={`Authorization: Bearer {{token}}`}
                                />
                                <div className="form-text">
                                  For now this is stored as plain text. Later
                                  we can add a proper key/value editor.
                                </div>
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Body template
                                </label>
                                <textarea
                                  className="form-control form-control-sm"
                                  rows={4}
                                  value={cfg.bodyTemplate ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      bodyTemplate: e.target.value,
                                    })
                                  }
                                  placeholder={`{"name": "{{user.name}}", "email": "{{user.email}}"}`}
                                />
                              </div>
                            </>
                          );
                        }

                        if (selectedNode.kind === "email") {
                          return (
                            <>
                              <div className="text-muted mb-2">
                                Email node configuration
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  To
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.to ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      to: e.target.value,
                                    })
                                  }
                                  placeholder="user@example.com, {{recipientEmail}}"
                                />
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  CC
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.cc ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      cc: e.target.value,
                                    })
                                  }
                                  placeholder="Optional, comma-separated"
                                />
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  BCC
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.bcc ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      bcc: e.target.value,
                                    })
                                  }
                                  placeholder="Optional, comma-separated"
                                />
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Subject
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.subject ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      subject: e.target.value,
                                    })
                                  }
                                  placeholder="Welcome {{user.name}}"
                                />
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Body template
                                </label>
                                <textarea
                                  className="form-control form-control-sm"
                                  rows={4}
                                  value={cfg.bodyTemplate ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      bodyTemplate: e.target.value,
                                    })
                                  }
                                  placeholder={`Hi {{user.name}},\n\nYour account is now active.\n\nThanks,\nHRFlow`}
                                />
                              </div>
                            </>
                          );
                        }

                        if (selectedNode.kind === "database") {
                          return (
                            <>
                              <div className="text-muted mb-2">
                                Database node configuration
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Table
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.table ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      table: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. hr_candidates"
                                />
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Operation
                                </label>
                                <select
                                  className="form-select form-select-sm"
                                  value={cfg.operation ?? "insert"}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      operation: e.target.value,
                                    })
                                  }
                                >
                                  <option value="insert">Insert</option>
                                  <option value="update">Update</option>
                                  <option value="upsert">Upsert</option>
                                </select>
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Field mappings (JSON or key:value lines)
                                </label>
                                <textarea
                                  className="form-control form-control-sm"
                                  rows={4}
                                  value={cfg.fieldMappings ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      fieldMappings: e.target.value,
                                    })
                                  }
                                  placeholder={`name: {{candidate.name}}\nemail: {{candidate.email}}`}
                                />
                              </div>
                            </>
                          );
                        }

                        if (selectedNode.kind === "condition") {
                          return (
                            <>
                              <div className="text-muted mb-2">
                                Condition node configuration
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Condition expression
                                </label>
                                <textarea
                                  className="form-control form-control-sm"
                                  rows={4}
                                  value={cfg.expression ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      expression: e.target.value,
                                    })
                                  }
                                  placeholder={`{{candidate.score}} > 80 && {{candidate.yearsExperience}} >= 3`}
                                />
                                <div className="form-text">
                                  For now this is just a string. Later we can
                                  build a visual condition builder that outputs
                                  this expression.
                                </div>
                              </div>
                            </>
                          );
                        }

                        // Default view for other node types
                        return (
                          <div className="mb-3 text-muted">
                            No structured config editor for node type{" "}
                            <span className="fw-semibold">
                              {selectedNode.kind}
                            </span>{" "}
                            yet. You can still inspect the raw JSON below.
                          </div>
                        );
                      })()}

                      {/* Technical JSON view */}
                      <div className="text-muted mb-2 mt-3">
                        Configuration (technical view)
                      </div>
                      <div
                        style={{
                          borderRadius: "0.5rem",
                          backgroundColor: "#020617",
                          border: "1px solid rgba(148,163,184,0.4)",
                          padding: "0.5rem",
                          maxHeight: "220px",
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

const WorkflowBuilderPage: React.FC = () => {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderContent />
    </ReactFlowProvider>
  );
};

export default WorkflowBuilderPage;
