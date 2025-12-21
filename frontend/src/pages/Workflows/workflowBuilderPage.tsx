import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as dagre from 'dagre';
import { FiPlay, FiCheck, FiCopy, FiLink } from 'react-icons/fi';
import { LuLayoutTemplate, LuChevronDown, LuUsers, LuServer, LuTriangleAlert } from 'react-icons/lu';

import {
  fetchWorkflowGraph,
  createWorkflowNode,
  createWorkflowEdge,
  updateWorkflowNode,
  updateWorkflowNodePosition,
  deleteWorkflowEdge,
  deleteWorkflowNode,
  updateWorkflow,
  type WorkflowGraphNode,
  type WorkflowGraphEdge,
  type WorkflowGraphMeta,
  executeWorkflow,
} from '../../api/workflows';

import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Connection, // Fix: type-only
  type Edge,
  type EdgeProps,
  ReactFlowProvider,
  useReactFlow,
  getBezierPath,
  BaseEdge,
  type Node as RFNode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import PremiumNode from '../../components/builder/PremiumNode';
import GhostNode from '../../components/builder/GhostNode';
import Sidebar from '../../layout/sidebar'; // Import Sidebar
import ConfigPanel from '../../components/builder/ConfigPanel';
import NodePicker from '../../components/builder/NodePicker';
import { templates, type WorkflowTemplate } from '../../data/templates';

// ... existing types ...

type BuilderState = {
  workflowId: number | null;
  workflowMeta?: WorkflowGraphMeta;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
};

// --- CUSTOM EDGE (Animated Blue) ---
const CustomEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Animated particle */}
      <circle r="4" fill="#38bdf8">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
};

const nodeTypesMap = {
  hrflow: PremiumNode,
  ghost: GhostNode,
};

const edgeTypes = {
  custom: CustomEdge,
};


// Local Type Definition since we removed the old component
export type WorkflowNodeData = {
  backendId?: number; // Optional for ghost
  name?: string | null;
  kind: string;
  config?: Record<string, unknown>;
  onAdd?: (event: React.MouseEvent) => void; // For ghost nodes
};

// --- DAGRE LAYOUT HELPER ---
const nodeWidth = 240;
const nodeHeight = 100;

const getLayoutedElements = (nodes: RFNode<WorkflowNodeData>[], edges: Edge[]) => {
  // Create a fresh graph for each layout to avoid stale node accumulation
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // Add padding to ensure nodes aren't at edge of canvas
    return {
      ...node,
      position: {
        x: (nodeWithPosition?.x ?? 100) - nodeWidth / 2 + 100,
        y: (nodeWithPosition?.y ?? 100) - nodeHeight / 2 + 100,
      },
    };
  });

  return { nodes: newNodes, edges };
};

/**
 * Custom edge with a small delete (X) button rendered near the middle.
 */



  // Helpers to normalise edge shape (works with fromNodeId/toNodeId OR from_node_id/to_node_id)
function getFromNodeId(edge: WorkflowGraphEdge): number {
  const e = edge as Partial<{ fromNodeId: number; from_node_id: number }>;
  return e.fromNodeId ?? e.from_node_id ?? 0;
}

function getToNodeId(edge: WorkflowGraphEdge): number {
  const e = edge as Partial<{ toNodeId: number; to_node_id: number }>;
  return e.toNodeId ?? e.to_node_id ?? 0;
}


const WorkflowBuilderContent: React.FC = () => {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const { fitView, project } = useReactFlow();
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const hasInitialFit = useRef(false);

  const [state, setState] = useState<BuilderState>({
    workflowId: null,
    workflowMeta: undefined,
    nodes: [],
    edges: [], // Initialize edges in state
  });

  const [rfNodes, setRfNodes, onNodesChange] =
    useNodesState<WorkflowNodeData>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<WorkflowGraphEdge>([]); // Used Generic
  const [nodePickerOpen, setNodePickerOpen] = useState(false);
  const [pickerParentId, setPickerParentId] = useState<number | null>(null);
  const [pickerPosition, setPickerPosition] = useState<{x: number, y: number} | null>(null); // New: cursor pos


  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showRunConfirmation, setShowRunConfirmation] = useState<boolean>(false);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  // Template dropdown state
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState<WorkflowTemplate | null>(null);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);

  // autosave tracking
  const [pendingSaves, setPendingSaves] = useState(0);
  const beginSave = useCallback(() => setPendingSaves((n: number) => n + 1), []);
  const endSave = useCallback(
    () => setPendingSaves((n: number) => Math.max(0, n - 1)),
    []
  );
  const isSaving = pendingSaves > 0;

  // Use a ref to store the latest refresh function to break circular dependency
  const refreshRef = useRef<(backendNodes: WorkflowGraphNode[], backendEdges: WorkflowGraphEdge[]) => void>(() => {});

  const handleEdgeDeleteClick = useCallback(
    async (edgeIdStr: string) => {
      const edgeId = Number(edgeIdStr);
      if (!state.workflowId || Number.isNaN(edgeId)) {
        setRfEdges((current) => current.filter((e) => e.id !== edgeIdStr));
        return;
      }

      try {
        beginSave();
        await deleteWorkflowEdge(state.workflowId, edgeId);
        // After successful deletion, refresh the graph
        const graph = await fetchWorkflowGraph(state.workflowId);
        setState(prev => ({ ...prev, nodes: graph.nodes, edges: graph.edges }));
        refreshRef.current(graph.nodes, graph.edges);
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
    [state.workflowId, beginSave, endSave, setRfEdges]
  );

  // Helper to map backend edges to RF edges, wiring the delete callback
  const mapToReactFlowEdge = useCallback(
    (edge: WorkflowGraphEdge): Edge => ({
      id: String(edge.id),
      source: String(getFromNodeId(edge)),
      target: String(getToNodeId(edge)),
      label: edge.label ?? undefined,
      type: "custom", // Use our Animated Blue Edge
      data: { onDelete: handleEdgeDeleteClick },
    }),
    [handleEdgeDeleteClick]
  );

  // --- LAYOUT & GHOST LOGIC ---
  const refreshVisualGraph = useCallback((backendNodes: WorkflowGraphNode[], backendEdges: WorkflowGraphEdge[]) => {
      // 1. Map Real Nodes
      const realNodes: RFNode<WorkflowNodeData>[] = backendNodes.map(n => ({
          id: String(n.id),
          type: 'hrflow',
          position: { x: n.pos_x || 0, y: n.pos_y || 0 },
          data: {
              backendId: n.id,
              name: n.name,
              kind: n.kind,
              config: n.config || {}
          }
      }));

      // 1b. Handle Empty State (No nodes yet)
      if (realNodes.length === 0) {
          const startGhost: RFNode<WorkflowNodeData> = {
            id: 'ghost-start',
            type: 'ghost',
            position: { x: 0, y: 0 },
            data: {
              kind: 'ghost',
              onAdd: (e: React.MouseEvent) => {
                const bounds = flowWrapperRef.current?.getBoundingClientRect();
                if (bounds && e) {
                   // Calculate relative to the viewport or just use client coords if Picker is fixed
                   setPickerPosition({ x: e.clientX + 20, y: e.clientY }); 
                }
                setPickerParentId(null); // Root node
                setNodePickerOpen(true);
              }
            }
          };
          setRfNodes([startGhost]);
          setRfEdges([]);
          return;
      }

      // 2. Identify Leaves (Nodes with no outgoing edges)
      const sourceIds = new Set(backendEdges.map(e => getFromNodeId(e)));
      const leafNodes = backendNodes.filter(n => !sourceIds.has(n.id));

      // 3. Create Ghost Nodes for Leaves
      const ghostNodes: RFNode<WorkflowNodeData>[] = leafNodes.map(leaf => ({
          id: `ghost-${leaf.id}`,
          type: 'ghost',
          // Position relative to parent (since we aren't using Dagre for updates)
          position: { x: (leaf.pos_x || 0) + 400, y: (leaf.pos_y || 0) }, 
          data: {
              kind: 'ghost',
              onAdd: (e: React.MouseEvent) => {
                  if (e) setPickerPosition({ x: e.clientX + 20, y: e.clientY });
                  setPickerParentId(leaf.id);
                  setNodePickerOpen(true);
              }
          }
      }));

      // 4. Create Edges (Real + Ghost connections)
      const realRfEdges = backendEdges.map(mapToReactFlowEdge);
      const ghostEdges: Edge[] = leafNodes.map(leaf => ({
          id: `e-ghost-${leaf.id}`,
          source: String(leaf.id),
          target: `ghost-${leaf.id}`,
          type: 'custom', // Use our Animated Blue Edge
          animated: true,
          style: { stroke: '#38bdf8', strokeDasharray: '5,5', opacity: 0.5 }, // Blue-ish for ghost connection
      }));

      // 5. Run Layout (Only if needed)
      const allNodes = [...realNodes, ...ghostNodes];
      const allEdges = [...realRfEdges, ...ghostEdges];

      // Check if any real node has a non-zero position (meaning it's been moved/saved)
      const hasPositions = realNodes.some(n => n.position.x !== 0 || n.position.y !== 0);

      // We only force layout if it's a fresh graph (all 0,0) OR if specifically requested (could add flag later)
      // For now, if we have positions, we TRUST them.
      // Exception: Ghost nodes always get layouted relative to their parents, but since they are leaves, 
      // we might need a smarter way. For now, let's trust Dagre only for initial load.
      
      if (!hasPositions && realNodes.length > 0) {
          const layouted = getLayoutedElements(allNodes, allEdges);
          setRfNodes(layouted.nodes);
          setRfEdges(layouted.edges);
      } else {
          // Trust backend positions for real nodes, but we still need specific spots for ghosts.
          // Ghosts are tricky without Dagre. 
          // Simple fix: If we skip Dagre, just place ghosts near their parents?
          // Since "ghosts" are just "+" buttons, maybe simple offsets work.
          
          // Actually, if we skip Dagre, we just pass the nodes as is. 
          // But realNodes have (0,0) if created without pos.
          // Backend creations should ideally have positions. Auto-layout is mostly for "first view".
          
          // Better logic: IF positions exist, use them. IF (0,0), run layout for those specific nodes?
          // Mixed mode is hard. Let's stick to: "If mostly 0,0, run full layout. Else, respect positions."
          
          setRfNodes(allNodes);
          setRfEdges(allEdges);
      }
  }, [setRfNodes, setRfEdges, mapToReactFlowEdge]);

  // Keep the ref updated
  useEffect(() => {
    refreshRef.current = refreshVisualGraph;
  }, [refreshVisualGraph]);


  // --------------- LOAD WORKFLOW + GRAPH ----------------
  // ... (Load logic stays mostly same, ensuring we fetch graph) ... 
  
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSelectedNodeId(null);
      hasInitialFit.current = false;

      try {
        if (!params.id) throw new Error("No ID");
        const numericId = Number(params.id);
        
        // Fetch
        const graph = await fetchWorkflowGraph(numericId);
        if (cancelled) return;

        setState({
            workflowId: numericId,
            workflowMeta: graph.workflow,
            nodes: graph.nodes,
            edges: graph.edges
        });
        
        refreshRef.current(graph.nodes, graph.edges);
      } catch (e) {
         if(!cancelled) setError(e instanceof Error ? e.message : "Failed to load workflow");
      } finally {
         if(!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params.id]);

  // Initial fitView once nodes are loaded
  useEffect(() => {
    if (!loading && !hasInitialFit.current && rfNodes.length > 0) {
      // Small delay to allow React Flow to measure the nodes in the DOM
      setTimeout(() => {
          fitView({ padding: 0.4, duration: 500 });
          hasInitialFit.current = true;
      }, 100);
    }
  }, [loading, rfNodes, fitView]);

  const handleRename = async (newName: string) => {
      if (!state.workflowId || !state.workflowMeta) return;
      // Optimistic update
      const updatedMeta = { ...state.workflowMeta, name: newName };
      setState(prev => ({ ...prev, workflowMeta: updatedMeta }));

      try {
          await updateWorkflow(state.workflowId, { name: newName });
      } catch (e) {
          console.error("Rename failed", e);
      }
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

  const handleRunClick = () => {
    if (!state.workflowId || isRunning) return;
    setShowRunConfirmation(true);
  };

  const webhookUrl = state.workflowId
    ? `${window.location.origin}/webhook/hrflow/${state.workflowId}/execute`
    : null;

  const handleCopyWebhook = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch (err) {
      console.error('Failed to copy webhook URL:', err);
    }
  };

  const handleConfirmRun = async () => {
    if (!state.workflowId || isRunning) return;

    try {
      setIsRunning(true);
      setShowRunConfirmation(false);

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

  // Handler for applying template to current workflow
  const handleApplyTemplate = async (template: WorkflowTemplate) => {
    if (!state.workflowId || isApplyingTemplate) return;

    try {
      setIsApplyingTemplate(true);
      setShowTemplateConfirm(null);
      setIsTemplateDropdownOpen(false);

      // Delete all existing nodes (this also deletes edges due to cascade)
      for (const node of state.nodes) {
        await deleteWorkflowNode(state.workflowId, node.id);
      }

      // Create a mapping of template node IDs to actual node IDs
      const nodeIdMap: Record<string, number> = {};

      // Add nodes from template
      for (const templateNode of template.nodes) {
        const nodeResponse = await createWorkflowNode(state.workflowId, {
          kind: templateNode.kind,
          name: templateNode.name,
          posX: templateNode.pos_x,
          posY: templateNode.pos_y,
          config: templateNode.config,
        });
        nodeIdMap[templateNode.id] = nodeResponse.id;
      }

      // Add edges from template
      for (const templateEdge of template.edges) {
        const fromNodeId = nodeIdMap[templateEdge.from];
        const toNodeId = nodeIdMap[templateEdge.to];

        if (fromNodeId && toNodeId) {
          await createWorkflowEdge(state.workflowId, {
            fromNodeId,
            toNodeId,
            label: templateEdge.label || undefined,
            condition: templateEdge.condition || undefined,
          });
        }
      }

      // Update workflow name to template name
      await updateWorkflow(state.workflowId, { name: template.name });

      // Refresh the graph
      const graph = await fetchWorkflowGraph(state.workflowId);
      setState(prev => ({
        ...prev,
        workflowMeta: graph.workflow,
        nodes: graph.nodes,
        edges: graph.edges,
      }));
      refreshRef.current(graph.nodes, graph.edges);

    } catch (e) {
      console.error("Failed to apply template:", e);
      alert("Failed to apply template. Check console for details.");
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  // --------------- NODE CREATION (click + drag) ---------------



  // DnD Handlers removed (using NodePicker now)


  // --------------- SELECTION + CONFIG PANEL ---------------



  // --------------- NODE POSITION SYNC ---------------

  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: RFNode) => {
      const data = node.data as WorkflowNodeData;
      const backendId = data.backendId;
      const { x, y } = node.position;

      if (!backendId) return; // Don't save ghost node positions

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

      // Update local state optimistically
      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === backendId ? { ...n, pos_x: x, pos_y: y } : n
        ),
      }));

      if (state.workflowId) {
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

      try {
        beginSave();
        await createWorkflowEdge(state.workflowId, {
          fromNodeId: fromId,
          toNodeId: toId,
        });

        // After creating edge, refresh the graph
        const graph = await fetchWorkflowGraph(state.workflowId);
        setState(prev => ({ ...prev, nodes: graph.nodes, edges: graph.edges }));
        refreshRef.current(graph.nodes, graph.edges);
      } catch (err) {
        console.error("[WorkflowBuilderPage] Failed to create edge:", err);
        alert("Failed to create edge. Check console for details.");
      } finally {
        endSave();
      }
    },
    [state.workflowId, beginSave, endSave, refreshRef]
  );

  // --------------- SELECTION CHANGE ---------------

  const handleSelectionChange = useCallback(
    (params: { nodes: RFNode[]; edges: Edge[] }) => {
      const nodes = params.nodes ?? [];
      if (nodes.length === 0) {
        setSelectedNodeId(null);
        return;
      }

      const first = nodes[0];
      // Only select 'hrflow' nodes, ignore ghost nodes for config panel
      if (first.type === 'hrflow') {
        const idNum = Number(first.id);
        setSelectedNodeId(idNum);

      } else {
        setSelectedNodeId(null);
      }
    },
    []
  );

  // Wrapper for node creation
  const handleNodeSelect = async (kind: string) => {
      setNodePickerOpen(false);
      if (!state.workflowId) return;

      try {
          beginSave();
          
          let posX = 100;
          let posY = 100;

          if (pickerPosition) {
              // Convert the screen coordinates (from the click event) to ReactFlow internal coordinates
              const projected = project({ x: pickerPosition.x, y: pickerPosition.y });
              posX = projected.x;
              posY = projected.y;
          } else if (pickerParentId) {
             // Fallback if we don't have position for some reason
             const parent = state.nodes.find(n => n.id === pickerParentId);
             if (parent) {
                 posX = parent.pos_x + 300;
                 posY = parent.pos_y;
             }
          }

          // 1. Create Node (backend positions now used since we skip auto-layout often)
          const newNode = await createWorkflowNode(state.workflowId, {
              kind,
              posX, 
              posY
          });

          // 2. Create Edge from Parent -> New Node (ONLY if parent exists)
          if (pickerParentId) {
            await createWorkflowEdge(state.workflowId, {
                fromNodeId: pickerParentId,
                toNodeId: newNode.id
            });
          }

          // 3. Update Local State (Abstracted)
          // Re-fetch graph
          const graph = await fetchWorkflowGraph(state.workflowId);
          setState(prev => ({ ...prev, nodes: graph.nodes, edges: graph.edges })); 
          refreshRef.current(graph.nodes, graph.edges);

      } catch (e) {
          console.error("Failed to add node", e);
          alert("Failed to add node. Check console for details.");
      } finally {
          endSave();
      }
  };

  // --------------- RENDER ---------------

  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-navy-950"
        style={{ width: '100vw', height: '100vh' }}
      >
        <div className="text-slate-400 text-lg">Loading workflow builder...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 bg-navy-950"
        style={{ width: '100vw', height: '100vh' }}
      >
        <h1 className="text-xl font-bold text-white">Workflow Builder</h1>
        <div className="px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300">{error}</div>
        <button
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition"
          onClick={() => navigate("/workflows")}
        >
          Back to Workflows
        </button>
      </div>
    );
  }


  return (
    <div className="flex h-screen w-screen overflow-hidden bg-navy-950">
        {/* 1. Sidebar */}
        <Sidebar />

        {/* 2. Main Content Area */}
        <div className="flex-1 flex flex-col relative min-w-0">
            
            {/* Header Overlay */}
            <div className="absolute top-4 left-4 z-40 flex items-center gap-4">
                <div className="bg-navy-900/90 backdrop-blur border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3 shadow-xl">
                    <input 
                        className="bg-transparent border-none text-white font-bold text-lg focus:ring-0 placeholder-white/30 w-[300px]"
                        value={state.workflowMeta?.name || ''}
                        onChange={e => handleRename(e.target.value)}
                        placeholder="Untitled Workflow"
                    />
                    <div className="h-4 w-px bg-white/10" />
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        {isSaving ? (
                            <span className="flex items-center gap-1 text-amber-400"><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"/> Saving...</span>
                        ) : (
                            <span className="flex items-center gap-1"><FiCheck className="text-emerald-400"/> Saved</span>
                        )}
                    </div>
                </div>
                
                {/* Template Dropdown */}
                <div className="relative">
                    <button 
                        onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                        disabled={isApplyingTemplate}
                        className="bg-purple-600/90 hover:bg-purple-500 transition shadow-lg px-3 py-2 rounded-xl text-white font-medium flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                        {isApplyingTemplate ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <LuLayoutTemplate className="w-4 h-4" />
                        )}
                        Templates
                        <LuChevronDown className={`w-3 h-3 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {isTemplateDropdownOpen && (
                        <div className="absolute top-full mt-2 left-0 bg-navy-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[280px] z-50">
                            <div className="p-2 border-b border-white/10 bg-white/5">
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Apply Template</span>
                            </div>
                            {templates.map((template) => {
                                const CategoryIcon = template.category === 'hr' ? LuUsers : LuServer;
                                return (
                                    <button
                                        key={template.id}
                                        onClick={() => setShowTemplateConfirm(template)}
                                        className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 border-b border-white/5 last:border-b-0"
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                            template.category === 'hr' ? 'bg-blue-400/10 text-blue-400' : 'bg-green-400/10 text-green-400'
                                        }`}>
                                            <CategoryIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white">{template.name}</div>
                                            <div className="text-xs text-slate-500 truncate">{template.nodes.length} nodes</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                {/* Run Button */}
                <button onClick={handleRunClick} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:scale-105 transition shadow-lg px-4 py-2 rounded-xl text-white font-bold flex items-center gap-2 text-sm">
                    <FiPlay /> Run
                </button>
            </div>

            {/* Template Confirmation Modal */}
            {showTemplateConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTemplateConfirm(null)}>
                    <div className="bg-navy-900 border border-white/10 rounded-2xl p-6 max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <LuTriangleAlert className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Apply Template?</h3>
                                <p className="text-sm text-slate-400">This will replace all existing nodes</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-300 mb-6">
                            Applying "<span className="font-medium text-white">{showTemplateConfirm.name}</span>" will remove all current nodes and replace them with the template's {showTemplateConfirm.nodes.length} nodes.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowTemplateConfirm(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleApplyTemplate(showTemplateConfirm)}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                            >
                                Apply Template
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Webhook URL Display */}
            {webhookUrl && (
                <div className="absolute top-4 right-4 z-40">
                    <div className="bg-navy-900/90 backdrop-blur border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 shadow-xl max-w-md">
                        <FiLink className="text-cyan-400 flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Webhook URL</span>
                            <span className="text-xs text-slate-300 font-mono truncate" title={webhookUrl}>
                                {webhookUrl}
                            </span>
                        </div>
                        <button
                            onClick={handleCopyWebhook}
                            className={`ml-2 p-2 rounded-lg transition-all flex-shrink-0 ${
                                copiedWebhook
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                            }`}
                            title={copiedWebhook ? 'Copied!' : 'Copy webhook URL'}
                        >
                            {copiedWebhook ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                        </button>
                    </div>
                    {copiedWebhook && (
                        <div className="absolute top-full mt-2 right-0 bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg animate-fade-in">
                            Copied to clipboard!
                        </div>
                    )}
                </div>
            )}

            {/* Canvas */}
            <div className="flex-1 w-full h-full" ref={flowWrapperRef}>
                <ReactFlow
                    nodes={rfNodes}
                    edges={rfEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypesMap}
                    edgeTypes={edgeTypes} 
                    onConnect={handleConnect} 
                    onNodeDragStop={handleNodeDragStop}
                    onSelectionChange={handleSelectionChange}
                    onNodeClick={(_, node) => {
                         if (node.type === 'hrflow') {
                             setSelectedNodeId(Number(node.id));
                         }
                    }}
                    // Removed default fitView to prevent "weird zoom" on updates
                    fitViewOptions={{ padding: 0.2 }}
                    minZoom={0.5} // Prevent too far zoom out
                    maxZoom={1.5}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color="#1e293b" gap={20} size={1} />
                    <Controls className="glass-panel" position="bottom-left" />
                </ReactFlow>
            </div>
            
            {/* Context Panels */}
            <NodePicker 
                isOpen={nodePickerOpen} 
                onClose={() => setNodePickerOpen(false)} 
                onSelect={handleNodeSelect}
                position={pickerPosition}
            />
            
            <ConfigPanel
                isOpen={!!selectedNodeId}
                node={(() => {
                    const found = state.nodes.find(n => n.id === selectedNodeId);
                    if (!found) return null;
                    return {
                        id: found.id,
                        name: found.name || '',
                        kind: found.kind as 'trigger' | 'http' | 'email' | 'database' | 'condition' | 'cv_parser' | 'wait' | 'logger' | 'datetime' | 'variable',
                        config: found.config || {}
                    };
                })()}
                onUpdate={async (nodeId, updates: { config?: Record<string, unknown>; name?: string }) => {
                     // Optimistic
                     const newNodes = state.nodes.map((n: WorkflowGraphNode) => n.id === nodeId ? { ...n, ...updates } : n);
                     setState((prev: BuilderState) => ({ ...prev, nodes: newNodes }));

                     // Backend
                     try {
                         beginSave();
                         await updateWorkflowNode(state.workflowId!, nodeId, updates);
                     } finally {
                         endSave();
                     }
                }}
                onDelete={async (nodeId) => {
                     if (!state.workflowId) return;

                     // 1. Optimistic Backend State Update
                     const newNodes = state.nodes.filter(n => n.id !== nodeId);
                     const newEdges = state.edges.filter(e => e.from_node_id !== nodeId && e.to_node_id !== nodeId);

                     setState(prev => ({
                        ...prev,
                        nodes: newNodes,
                        edges: newEdges
                     }));

                     // 2. Optimistic Visual Update (Crucial fix for "node still visible")
                     setRfNodes(prev => prev.filter(n => n.id !== String(nodeId)));
                     setRfEdges(prev => prev.filter(e => e.source !== String(nodeId) && e.target !== String(nodeId)));

                     try {
                         beginSave();
                         // 3. Backend Call
                         await import('../../api/workflows').then(api => api.deleteWorkflowNode(state.workflowId!, nodeId));
                         /*
                            Values are already updated optimistically.
                            If we want to be safe, we could re-fetch, but that causes a flicker.
                            Optimistic is better for UX.
                         */
                     } catch(e) {
                         console.error("Delete failed", e);
                         alert("Failed to delete node");
                         // Revert on failure (optional but good practice)
                     } finally {
                         endSave();
                     }
                }}
                onClose={() => setSelectedNodeId(null)}
            />

            {/* Run Confirmation Modal */}
            {showRunConfirmation && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                                <FiPlay className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Run Workflow?</h3>
                                <p className="text-xs text-slate-400">This will execute the workflow immediately</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-300 mb-6">
                            You are about to run <strong className="text-white">{state.workflowMeta?.name || 'this workflow'}</strong>.
                            The workflow will use the trigger node configuration as input.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowRunConfirmation(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmRun}
                                disabled={isRunning}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                            >
                                <FiPlay className="w-4 h-4" />
                                {isRunning ? 'Running...' : 'Confirm Run'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
