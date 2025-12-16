import React, { useCallback, useEffect, useRef, useState } from "react";
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
  type Edge,
  type EdgeProps,
  type NodeDragHandler,
} from "reactflow";

import HRFlowNode, { type HRFlowNodeData } from "../../components/HRFlowNode";

type BuilderState = {
  workflowId: number | null;
  workflowMeta?: WorkflowGraphMeta;
  nodes: WorkflowGraphNode[];
};

type WorkflowEdgeData = { onDelete?: (edgeId: string) => void | Promise<void> };
type WorkflowEdge = Edge<WorkflowEdgeData>;

type ConfigTab = "general" | "config" | "advanced";

const nodeTypesMap = {
  hrflow: HRFlowNode,
};

/**
 * Helpers: normalize config shapes so backend/n8nCompiler gets what it expects.
 * We keep UI-friendly fields (bodyTemplate, fieldMappings, etc.) but convert
 * to compiler-friendly keys when saving.
 */
function parseKeyValueLines(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input !== "string") return {};

  const s = input.trim();
  if (!s) return {};

  // Try JSON first
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
    } catch {
      // fall through
    }
  }

  // Fallback: key:value per line
  const out: Record<string, unknown> = {};
  for (const line of s.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const idx = t.indexOf(":");
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    const value = t.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

function tryParseJsonObject(input: unknown): Record<string, unknown> | null {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  } catch {
    return null;
  }
  return null;
}

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

  type DeletableEdgeData = { onDelete?: (edgeId: string) => void };

  const onDelete = (data as DeletableEdgeData | undefined)?.onDelete;

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onDelete) onDelete(id);
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
  const e = edge as Partial<{ fromNodeId: number; from_node_id: number }>;
  return e.fromNodeId ?? e.from_node_id ?? 0;
}

function getToNodeId(edge: WorkflowGraphEdge): number {
  const e = edge as Partial<{ toNodeId: number; to_node_id: number }>;
  return e.toNodeId ?? e.to_node_id ?? 0;
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
const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<WorkflowEdgeData>([]);


  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("general");

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // autosave tracking
  const [pendingSaves, setPendingSaves] = useState(0);
  const beginSave = useCallback(() => setPendingSaves((n) => n + 1), []);
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
        console.error(
          "[WorkflowBuilderPage] Failed to delete edge on server:",
          e
        );
        alert("Failed to delete edge on the server. Check console logs.");
      } finally {
        endSave();
      }
    },
    [state.workflowId, setRfEdges, beginSave, endSave]
  );

  // Helper to map backend edges to RF edges, wiring the delete callback
  const mapToReactFlowEdge = useCallback(
  (edge: WorkflowGraphEdge): WorkflowEdge => ({
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
                  localStorage.setItem("hrflow:lastWorkflowId", String(lastId));
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
            e instanceof Error ? e.message : "Failed to load workflow builder.";
          setError(message);
          setRfNodes([]);
          setRfEdges([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
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
    if (state.workflowId) navigate(`/workflows/${state.workflowId}`);
    else navigate("/workflows");
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

  // Build input for execution from the trigger node config (friendly form fields)
  const getRunInputFromTriggerNode = useCallback((): Record<string, unknown> | null => {
    const trigger = state.nodes.find((n) => n.kind === "trigger");
    if (!trigger) return null;

    const cfg = (trigger.config ?? {}) as Record<string, unknown>;

    const name = typeof cfg.name === "string" ? cfg.name.trim() : "";
    const email = typeof cfg.email === "string" ? cfg.email.trim() : "";
    const role = typeof cfg.role === "string" ? cfg.role.trim() : "";
    const department = typeof cfg.department === "string" ? cfg.department.trim() : "";
    const startDate = typeof cfg.startDate === "string" ? cfg.startDate.trim() : "";
    const managerEmail = typeof cfg.managerEmail === "string" ? cfg.managerEmail.trim() : "";

    if (!name && !email && !role && !department && !startDate && !managerEmail) {
      return null;
    }

    const input: Record<string, unknown> = {};
    if (name) input.name = name;
    if (email) input.email = email;
    if (role) input.role = role;
    if (department) input.department = department;
    if (startDate) input.startDate = startDate;
    if (managerEmail) input.managerEmail = managerEmail;

    return { employee: input };
  }, [state.nodes]);

  const handleRunClick = async () => {
    if (!state.workflowId || isRunning) return;

    try {
      setIsRunning(true);

      const input = getRunInputFromTriggerNode();

      const result = await executeWorkflow(state.workflowId, input, "manual");
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

      // FIX: correct Y calculation
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
    if (selectedNodeId === null || !state.workflowId) return;

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
    } catch (err) {
      console.error("[WorkflowBuilderPage] Failed to delete node:", err);
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

      const newConfig: Record<string, unknown> = { ...currentConfig, ...partialConfig };

      // Normalize into the shape n8nCompiler expects (for the 5 core nodes)
      const kind = String(existingNode?.kind ?? "").toLowerCase();

      if (kind === "http") {
        // headers: string -> object
        if ("headers" in newConfig) {
          newConfig.headers = parseKeyValueLines(newConfig.headers);
        }

        // bodyTemplate -> body (object if JSON, else store _raw)
        if ("bodyTemplate" in newConfig) {
          const parsed = tryParseJsonObject(newConfig.bodyTemplate);
          if (parsed) newConfig.body = parsed;
          else if (typeof newConfig.bodyTemplate === "string" && newConfig.bodyTemplate.trim()) {
            newConfig.body = { _raw: newConfig.bodyTemplate };
          }
          delete newConfig.bodyTemplate;
        }

        // Optional query parsing if you add it later (no harm)
        if ("query" in newConfig) {
          newConfig.query = parseKeyValueLines(newConfig.query);
        }
      }

      if (kind === "email") {
        // bodyTemplate -> text
        if ("bodyTemplate" in newConfig) {
          const bt = typeof newConfig.bodyTemplate === "string" ? newConfig.bodyTemplate : "";
          newConfig.text = bt;
          delete newConfig.bodyTemplate;
        }
      }

      if (kind === "database") {
        // Convert friendly fields into a SQL query string for compiler
        const table = typeof newConfig.table === "string" ? newConfig.table.trim() : "";
        const op = typeof newConfig.operation === "string" ? newConfig.operation.trim().toLowerCase() : "insert";
        const mappings = parseKeyValueLines(newConfig.fieldMappings);

        if (table && Object.keys(mappings).length > 0) {
          const cols = Object.keys(mappings).map((c) => `"${c}"`).join(", ");
          const vals = Object.keys(mappings)
            .map((k) => {
              const v = mappings[k];
              const lit =
                typeof v === "string"
                  ? v.replaceAll("'", "''")
                  : JSON.stringify(v).replaceAll("'", "''");
              return `'${lit}'`;
            })
            .join(", ");

          if (op === "insert") {
            newConfig.query = `INSERT INTO ${table} (${cols}) VALUES (${vals});`;
          } else if (op === "update") {
            const sets = Object.keys(mappings)
              .map((k) => {
                const v = mappings[k];
                const lit =
                  typeof v === "string"
                    ? v.replaceAll("'", "''")
                    : JSON.stringify(v).replaceAll("'", "''");
                return `"${k}"='${lit}'`;
              })
              .join(", ");
            newConfig.query = `UPDATE ${table} SET ${sets};`;
          } else {
            // upsert is schema-dependent
            newConfig.query = `-- TODO UPSERT for ${table}\nINSERT INTO ${table} (${cols}) VALUES (${vals});`;
          }
        }

        // Compiler only needs query; we can keep other fields for UI.
      }

      if (kind === "condition") {
        // Your compiler expects left/op/right.
        // UI currently stores expression. Keep it, but ensure compiler has valid defaults.
        if (!("left" in newConfig)) newConfig.left = "value";
        if (!("op" in newConfig)) newConfig.op = "eq";
        if (!("right" in newConfig)) newConfig.right = "";
      }

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

      // Validate position values are finite numbers
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        console.warn(`[WorkflowBuilderPage] Invalid position values for node ${backendId}: (${x}, ${y})`);
        return;
      }

      // Verify node exists in our state before updating
      const nodeExists = state.nodes.some(n => n.id === backendId);
      if (!nodeExists) {
        console.warn(`[WorkflowBuilderPage] Node ${backendId} not found in state, skipping position update`);
        return;
      }

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
    [state.workflowId, state.nodes, beginSave, endSave]
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
const tempEdge: WorkflowEdge = {
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
      } catch (err) {
        console.error("[WorkflowBuilderPage] Failed to create edge:", err);
        setRfEdges((current) => current.filter((e) => e.id !== tempEdgeId));
        alert("Failed to create edge. Check console for details.");
      } finally {
        endSave();
      }
    },
    [state.workflowId, setRfEdges, beginSave, endSave, handleEdgeDeleteClick]
  );

  // --------------- SELECTION CHANGE ---------------

  const handleSelectionChange = useCallback(
    (params: { nodes: RFNode[]; edges: Edge[] }) => {
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
              "badge small " + (isSaving ? "bg-warning text-dark" : "bg-success")
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
      <div className="row g-3" style={{ minHeight: "calc(100vh - 140px)" }}>
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
                  <Background gap={24} size={1} color="rgba(148,163,184,0.2)" />
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
                              This will also remove any edges connected to this
                              node.
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
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          any
                        >;

                        if (selectedNode.kind === "trigger") {
                          return (
                            <>
                              <div className="text-muted mb-2">
                                Trigger node configuration
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Employee name
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.name ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      name: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Employee email
                                </label>
                                <input
                                  type="email"
                                  className="form-control form-control-sm"
                                  value={cfg.email ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      email: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Role
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.role ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      role: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Department
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.department ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      department: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="mb-2">
                                <label className="form-label text-muted mb-1">
                                  Start date (optional)
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.startDate ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      startDate: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Manager email (optional)
                                </label>
                                <input
                                  type="email"
                                  className="form-control form-control-sm"
                                  value={cfg.managerEmail ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      managerEmail: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="form-text">
                                These fields are sent as the execution input
                                when you click Run.
                              </div>
                            </>
                          );
                        }

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
                                />
                                <div className="form-text">
                                  Stored as text here, but saved to backend as an
                                  object for the compiler.
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
                                />
                                <div className="form-text">
                                  Saved to backend as <code>body</code> (object if
                                  valid JSON).
                                </div>
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
                                />
                                <div className="form-text">
                                  Saved to backend as <code>text</code> for the compiler.
                                </div>
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
                                />
                                <div className="form-text">
                                  Saved to backend as a generated SQL <code>query</code>.
                                </div>
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
                                />
                                <div className="form-text">
                                  Stored as text for now. Compiler uses left/op/right defaults
                                  unless you extend it later.
                                </div>
                              </div>
                            </>
                          );
                        }

                        if (selectedNode.kind === "cv_parse") {
                          return (
                            <>
                              <div className="text-muted mb-2">
                                CV Parse node configuration
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Input Type
                                </label>
                                <select
                                  className="form-select form-select-sm"
                                  value={cfg.inputType ?? "file"}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      inputType: e.target.value,
                                    })
                                  }
                                >
                                  <option value="file">File Upload</option>
                                  <option value="url">URL</option>
                                </select>
                                <div className="form-text">
                                  Choose whether to parse from uploaded file or URL
                                </div>
                              </div>

                              {cfg.inputType === "file" ? (
                                <div className="mb-3">
                                  <label className="form-label text-muted mb-1">
                                    File Field Name
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={cfg.fileField ?? "resume_file"}
                                    onChange={(e) =>
                                      updateSelectedNodeConfig({
                                        fileField: e.target.value,
                                      })
                                    }
                                    placeholder="resume_file"
                                  />
                                  <div className="form-text">
                                    Field name for uploaded CV file
                                  </div>
                                </div>
                              ) : (
                                <div className="mb-3">
                                  <label className="form-label text-muted mb-1">
                                    CV URL
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={cfg.cvUrl ?? ""}
                                    onChange={(e) =>
                                      updateSelectedNodeConfig({
                                        cvUrl: e.target.value,
                                      })
                                    }
                                    placeholder="https://example.com/resume.pdf"
                                  />
                                  <div className="form-text">
                                    URL to CV file (supports n8n expressions)
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        }

                        if (selectedNode.kind === "variable") {
                          return (
                            <>
                              <div className="text-muted mb-2">
                                Variable node configuration
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Variable Name
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={cfg.variableName ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      variableName: e.target.value,
                                    })
                                  }
                                  placeholder="myVariable"
                                />
                                <div className="form-text">
                                  Name of the variable to set
                                </div>
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Value
                                </label>
                                <textarea
                                  className="form-control form-control-sm font-monospace"
                                  rows={3}
                                  value={cfg.value ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      value: e.target.value,
                                    })
                                  }
                                  placeholder="Static value or expression: {{ $node.previousNode.json.field }}"
                                />
                                <div className="form-text">
                                  Supports n8n expressions
                                </div>
                              </div>
                            </>
                          );
                        }

                        if (selectedNode.kind === "datetime") {
                          return (
                            <>
                              <div className="text-muted mb-2">
                                Datetime node configuration
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Operation
                                </label>
                                <select
                                  className="form-select form-select-sm"
                                  value={cfg.operation ?? "format"}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      operation: e.target.value,
                                    })
                                  }
                                >
                                  <option value="format">Format Date</option>
                                  <option value="add">Add Time</option>
                                  <option value="subtract">Subtract Time</option>
                                  <option value="parse">Parse String</option>
                                </select>
                                <div className="form-text">
                                  Choose the datetime operation
                                </div>
                              </div>

                              {cfg.operation === "format" && (
                                <div className="mb-3">
                                  <label className="form-label text-muted mb-1">
                                    Format String
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm font-monospace"
                                    value={cfg.format ?? "YYYY-MM-DD"}
                                    onChange={(e) =>
                                      updateSelectedNodeConfig({
                                        format: e.target.value,
                                      })
                                    }
                                    placeholder="YYYY-MM-DD HH:mm:ss"
                                  />
                                  <div className="form-text">
                                    Uses moment.js format tokens
                                  </div>
                                </div>
                              )}

                              {(cfg.operation === "add" ||
                                cfg.operation === "subtract") && (
                                <>
                                  <div className="mb-3">
                                    <label className="form-label text-muted mb-1">
                                      Amount
                                    </label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={cfg.amount ?? 1}
                                      onChange={(e) =>
                                        updateSelectedNodeConfig({
                                          amount: parseInt(e.target.value),
                                        })
                                      }
                                    />
                                    <div className="form-text">
                                      Number of units to add/subtract
                                    </div>
                                  </div>

                                  <div className="mb-3">
                                    <label className="form-label text-muted mb-1">
                                      Unit
                                    </label>
                                    <select
                                      className="form-select form-select-sm"
                                      value={cfg.unit ?? "days"}
                                      onChange={(e) =>
                                        updateSelectedNodeConfig({
                                          unit: e.target.value,
                                        })
                                      }
                                    >
                                      <option value="seconds">Seconds</option>
                                      <option value="minutes">Minutes</option>
                                      <option value="hours">Hours</option>
                                      <option value="days">Days</option>
                                      <option value="weeks">Weeks</option>
                                      <option value="months">Months</option>
                                      <option value="years">Years</option>
                                    </select>
                                    <div className="form-text">Time unit</div>
                                  </div>
                                </>
                              )}
                            </>
                          );
                        }

                        if (selectedNode.kind === "logger") {
                          return (
                            <>
                              <div className="text-muted mb-2">
                                Logger node configuration
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Log Message
                                </label>
                                <textarea
                                  className="form-control form-control-sm font-monospace"
                                  rows={3}
                                  value={cfg.message ?? ""}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      message: e.target.value,
                                    })
                                  }
                                  placeholder="Workflow step completed: {{ $node.previousNode.json.status }}"
                                />
                                <div className="form-text">
                                  Supports n8n expressions
                                </div>
                              </div>

                              <div className="mb-3">
                                <label className="form-label text-muted mb-1">
                                  Log Level
                                </label>
                                <select
                                  className="form-select form-select-sm"
                                  value={cfg.level ?? "info"}
                                  onChange={(e) =>
                                    updateSelectedNodeConfig({
                                      level: e.target.value,
                                    })
                                  }
                                >
                                  <option value="debug">Debug</option>
                                  <option value="info">Info</option>
                                  <option value="warn">Warn</option>
                                  <option value="error">Error</option>
                                </select>
                                <div className="form-text">
                                  Logging severity level
                                </div>
                              </div>

                              <div className="mb-3">
                                <div className="form-check">
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="includeInputCheck"
                                    checked={cfg.includeInput !== false}
                                    onChange={(e) =>
                                      updateSelectedNodeConfig({
                                        includeInput: e.target.checked,
                                      })
                                    }
                                  />
                                  <label
                                    className="form-check-label text-muted"
                                    htmlFor="includeInputCheck"
                                  >
                                    Include input data in log
                                  </label>
                                </div>
                              </div>
                            </>
                          );
                        }

                        // Default view for other node types
                        return (
                          <div className="mb-3 text-muted">
                            No structured config editor for node type{" "}
                            <span className="fw-semibold">{selectedNode.kind}</span>{" "}
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
