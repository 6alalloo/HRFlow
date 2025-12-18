import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as dagre from 'dagre';
import { FiPlay, FiCheck } from 'react-icons/fi';

import {
  fetchWorkflowGraph,
  createWorkflowNode,
  createWorkflowEdge,
  updateWorkflowNode,
  updateWorkflowNodePosition,
  deleteWorkflowEdge,
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

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

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
      } catch (e: any) {
         if(!cancelled) setError(e.message);
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
                {/* Run Button */}
                <button onClick={handleRunClick} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:scale-105 transition shadow-lg px-4 py-2 rounded-xl text-white font-bold flex items-center gap-2 text-sm">
                    <FiPlay /> Run
                </button>
            </div>

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
                node={state.nodes.find(n => n.id === selectedNodeId) || null}
                onUpdate={async (nodeId, updates) => {
                     // Optimistic
                     const newNodes = state.nodes.map((n: WorkflowGraphNode) => n.id === nodeId ? { ...n, ...updates } : n);
                     setState((prev: BuilderState) => ({ ...prev, nodes: newNodes }));
                     
                     // Backend
                     try {
                         beginSave();
                         await updateWorkflowNode(state.workflowId!, nodeId, updates as any);
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
