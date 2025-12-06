// src/services/workflowService.ts
import prisma from "../lib/prisma";

type WorkflowFilters = {
  isActive?: boolean;
  ownerId?: number;
  query?: string; // for ?q= search
};

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
 * Get a workflow graph = { nodes, edges }.
 */
export async function getWorkflowGraph(workflowId: number) {
  const [nodes, edges] = await Promise.all([
    getWorkflowNodes(workflowId),
    getWorkflowEdges(workflowId),
  ]);

  return {
    nodes,
    edges,
  };
}
