// src/services/workflowService.ts
import prisma from "../lib/prisma";

type WorkflowFilters = {
  isActive?: boolean;
  ownerId?: number;
  query?: string; // for ?q= search
};


function safeParseJson<T = any>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    // If the stored JSON is invalid, we don't want to crash the API
    return fallback;
  }
}

// 2) Node kinds our engine/canvas understands
export type WorkflowNodeKind =
  | "trigger"
  | "http"
  | "email"
  | "database"
  | "condition"
  | "variable"
  | "logger"
  | "datetime"
  | "cv_parse";

// 3) DTOs for nodes and edges (these are service-level types, not Prisma models)
export interface WorkflowNodeDTO {
  kind: WorkflowNodeKind;
  name?: string | null;
  config?: Record<string, any>;
  posX?: number;
  posY?: number;
}

export interface WorkflowEdgeDTO {
  fromNodeId?: number;
  toNodeId?: number;
  label?: string | null;
  priority?: number | null;
  condition?: Record<string, any>;
}
/**
 * Get all workflows (list) with optional filters:
 * - isActive: filter by is_active
 * - ownerId: filter by owner_user_id
 * - query: search in name OR description (case-insensitive)
 */
export async function getAllWorkflows(filters: WorkflowFilters = {}) {
  const { isActive, ownerId, query } = filters;

  const whereClauses: any[] = [];

  if (typeof isActive === "boolean") {
    whereClauses.push({ is_active: isActive });
  }

  if (typeof ownerId === "number") {
    whereClauses.push({ owner_user_id: ownerId });
  }

  if (query && query.trim().length > 0) {
    const q = query.trim();
    whereClauses.push({
      OR: [
        {
          name: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  const where = whereClauses.length > 0 ? { AND: whereClauses } : {};

  const workflows = await prisma.workflows.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      is_active: true,
      version: true,
      default_trigger: true,
      owner_user_id: true,
      created_at: true,
      updated_at: true,
      users: {
        select: {
          id: true,
          full_name: true,
          email: true,
        },
      },
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return workflows;
}

/**
 * Get a single workflow by ID.
 */
export async function getWorkflowById(id: number) {
  const workflow = await prisma.workflows.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      is_active: true,
      version: true,
      default_trigger: true,
      owner_user_id: true,
      archived_at: true,
      created_at: true,
      updated_at: true,
      users: {
        select: {
          id: true,
          full_name: true,
          email: true,
        },
      },
    },
  });

  return workflow;
}

/**
 * Get all nodes for a workflow.
 */
export async function getWorkflowNodes(workflowId: number) {
  const nodes = await prisma.workflow_nodes.findMany({
    where: {
      workflow_id: workflowId,
    },
    select: {
      id: true,
      workflow_id: true,
      kind: true,
      name: true,
      config_json: true,
      pos_x: true,
      pos_y: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return nodes;
}

/**
 * Get all edges for a workflow.
 */
export async function getWorkflowEdges(workflowId: number) {
  const edges = await prisma.workflow_edges.findMany({
    where: {
      workflow_id: workflowId,
    },
    select: {
      id: true,
      workflow_id: true,
      from_node_id: true,
      to_node_id: true,
      condition_json: true,
      label: true,
      priority: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return edges;
}

/**
 * Get a workflow graph = { workflow, nodes, edges } with parsed JSON config.
 */
export async function getWorkflowGraph(workflowId: number) {
  // 1) Fetch the workflow itself
  const workflow = await prisma.workflows.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    // Let the controller decide how to turn this into HTTP 404
    return null;
  }

  // 2) Fetch nodes and edges in parallel 
  const [nodesRaw, edgesRaw] = await Promise.all([
    prisma.workflow_nodes.findMany({
      where: { workflow_id: workflowId },
      orderBy: { id: "asc" },
    }),
    prisma.workflow_edges.findMany({
      where: { workflow_id: workflowId },
      orderBy: { id: "asc" },
    }),
  ]);

  // 3) Shape them into a graph object for the API
  const nodes = nodesRaw.map((n) => ({
    id: n.id,
    workflowId: n.workflow_id,
    kind: n.kind as WorkflowNodeKind,
    name: n.name,
    config: safeParseJson(n.config_json, {} as Record<string, any>),
    posX: n.pos_x,
    posY: n.pos_y,
  }));

  const edges = edgesRaw.map((e) => ({
    id: e.id,
    workflowId: e.workflow_id,
    fromNodeId: e.from_node_id,
    toNodeId: e.to_node_id,
    label: e.label,
    priority: e.priority ?? 0,
    condition: safeParseJson(e.condition_json, {} as Record<string, any>),
  }));

  return {
    workflow: {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.is_active,
      version: workflow.version,
      defaultTrigger: workflow.default_trigger,
      archivedAt: workflow.archived_at,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at,
    },
    nodes,
    edges,
  };
}

// -------------------- NODE CRUD --------------------

/**
 * Create a new node for a workflow.
 */


/**
 * Update an existing node for a workflow.
 */
export async function updateWorkflowNode(
  workflowId: number,
  nodeId: number,
  dto: Partial<WorkflowNodeDTO>
) {
  // 1) Ensure the node belongs to this workflow
  const existing = await prisma.workflow_nodes.findFirst({
    where: { id: nodeId, workflow_id: workflowId },
  });

  if (!existing) {
    return null; // controller will return 404
  }

  // 2) Build the update data, falling back to existing values
  const updated = await prisma.workflow_nodes.update({
    where: { id: nodeId },
    data: {
      kind: dto.kind ?? existing.kind,
      name: dto.name ?? existing.name,
      config_json:
        dto.config !== undefined
          ? JSON.stringify(dto.config)
          : existing.config_json,
      pos_x: dto.posX ?? existing.pos_x,
      pos_y: dto.posY ?? existing.pos_y,
    },
  });

  return {
    id: updated.id,
    workflowId: updated.workflow_id,
    kind: updated.kind as WorkflowNodeKind,
    name: updated.name,
    config: safeParseJson(updated.config_json, {} as Record<string, any>),
    posX: updated.pos_x,
    posY: updated.pos_y,
  };
}

/**
 * Delete a node from a workflow.
 */
export async function deleteWorkflowNode(
  workflowId: number,
  nodeId: number
) {
  // Check ownership
  const existing = await prisma.workflow_nodes.findFirst({
    where: { id: nodeId, workflow_id: workflowId },
  });

  if (!existing) {
    return false;
  }

  // Deleting the node will also impact edges/steps via FK rules
  await prisma.workflow_nodes.delete({
    where: { id: nodeId },
  });

  return true;
}

/**
 * List edges for a workflow with parsed JSON condition.
 * 
 */
export async function listWorkflowEdgesParsed(workflowId: number) {
  const edgesRaw = await prisma.workflow_edges.findMany({
    where: { workflow_id: workflowId },
    orderBy: { id: "asc" },
  });

  return edgesRaw.map((e) => ({
    id: e.id,
    workflowId: e.workflow_id,
    fromNodeId: e.from_node_id,
    toNodeId: e.to_node_id,
    label: e.label,
    priority: e.priority ?? 0,
    condition: safeParseJson(e.condition_json, {} as Record<string, any>),
  }));
}

/**
 * Create a new edge between two nodes in the same workflow.
 */
export async function createWorkflowEdge(
  workflowId: number,
  dto: Required<Pick<WorkflowEdgeDTO, "fromNodeId" | "toNodeId">> &
    WorkflowEdgeDTO
) {
  // 1) Validate that both nodes exist and belong to this workflow
  const [fromNode, toNode] = await Promise.all([
    prisma.workflow_nodes.findFirst({
      where: { id: dto.fromNodeId, workflow_id: workflowId },
    }),
    prisma.workflow_nodes.findFirst({
      where: { id: dto.toNodeId, workflow_id: workflowId },
    }),
  ]);

  if (!fromNode || !toNode) {
    throw new Error("fromNodeId and toNodeId must belong to this workflow");
  }

  // 2) Create the edge
  const edge = await prisma.workflow_edges.create({
    data: {
      workflow_id: workflowId,
      from_node_id: dto.fromNodeId!,
      to_node_id: dto.toNodeId!,
      label: dto.label ?? null,
      priority: dto.priority ?? 0,
      condition_json: JSON.stringify(dto.condition ?? {}),
    },
  });

  // 3) Return parsed version for the API
  return {
    id: edge.id,
    workflowId: edge.workflow_id,
    fromNodeId: edge.from_node_id,
    toNodeId: edge.to_node_id,
    label: edge.label,
    priority: edge.priority ?? 0,
    condition: safeParseJson(edge.condition_json, {} as Record<string, any>),
  };
}

/**
 * Update an existing edge in the workflow.
 */
export async function updateWorkflowEdge(
  workflowId: number,
  edgeId: number,
  dto: WorkflowEdgeDTO
) {
  // 1) Ensure the edge belongs to this workflow
  const existing = await prisma.workflow_edges.findFirst({
    where: { id: edgeId, workflow_id: workflowId },
  });

  if (!existing) {
    return null; // controller will return 404
  }

  // 2) Decide the final from/to node IDs (may be unchanged)
  let fromNodeId = existing.from_node_id;
  let toNodeId = existing.to_node_id;

  if (dto.fromNodeId !== undefined) {
    fromNodeId = dto.fromNodeId;
  }
  if (dto.toNodeId !== undefined) {
    toNodeId = dto.toNodeId;
  }

  // 3) If either from/to changed, validate they still belong to this workflow
  if (dto.fromNodeId !== undefined || dto.toNodeId !== undefined) {
    const [fromNode, toNode] = await Promise.all([
      prisma.workflow_nodes.findFirst({
        where: { id: fromNodeId, workflow_id: workflowId },
      }),
      prisma.workflow_nodes.findFirst({
        where: { id: toNodeId, workflow_id: workflowId },
      }),
    ]);

    if (!fromNode || !toNode) {
      throw new Error("fromNodeId and toNodeId must belong to this workflow");
    }
  }

  // 4) Perform the update
  const updated = await prisma.workflow_edges.update({
    where: { id: edgeId },
    data: {
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      label: dto.label ?? existing.label,
      priority:
        dto.priority !== undefined ? dto.priority : existing.priority ?? 0,
      condition_json:
        dto.condition !== undefined
          ? JSON.stringify(dto.condition)
          : existing.condition_json,
    },
  });

  return {
    id: updated.id,
    workflowId: updated.workflow_id,
    fromNodeId: updated.from_node_id,
    toNodeId: updated.to_node_id,
    label: updated.label,
    priority: updated.priority ?? 0,
    condition: safeParseJson(updated.condition_json, {} as Record<string, any>),
  };
}

/**
 * Delete an edge from the workflow.
 */
export async function deleteWorkflowEdge(
  workflowId: number,
  edgeId: number
) {
  // 1) Ensure the edge belongs to this workflow
  const existing = await prisma.workflow_edges.findFirst({
    where: { id: edgeId, workflow_id: workflowId },
  });

  if (!existing) {
    return false;
  }

  // 2) Delete
  await prisma.workflow_edges.delete({
    where: { id: edgeId },
  });

  return true;
}

export async function createWorkflowNode(
  workflowId: number,
  dto: WorkflowNodeDTO
) {
  // How many nodes already exist for this workflow?
  const count = await prisma.workflow_nodes.count({
    where: { workflow_id: workflowId },
  });

  let posX = dto.posX;
  let posY = dto.posY;

  // If no explicit position was provided, place node in a simple grid
  if (posX === undefined || posY === undefined) {
    const col = count % 3;               // 0,1,2
    const row = Math.floor(count / 3);   // 0,1,2,...

    posX = 80 + col * 220;               // 80, 300, 520,...
    posY = 80 + row * 160;               // 80, 240, 400,...
  }

  const node = await prisma.workflow_nodes.create({
    data: {
      workflow_id: workflowId,
      kind: dto.kind,
      name: dto.name ?? null,
      config_json: JSON.stringify(dto.config ?? {}),
      pos_x: Math.round(posX),
      pos_y: Math.round(posY),
    },
  });

  return {
    id: node.id,
    workflowId: node.workflow_id,
    kind: node.kind as WorkflowNodeKind,
    name: node.name,
    config: safeParseJson(node.config_json, {} as Record<string, any>),
    posX: node.pos_x,
    posY: node.pos_y,
  };
}