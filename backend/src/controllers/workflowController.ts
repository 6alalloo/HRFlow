// src/controllers/workflowController.ts
import { Request, Response } from "express";
import * as workflowService from "../services/workflowService";

/**
 * GET /api/workflows
 * List all workflows.
 */
export async function getAllWorkflows(req: Request, res: Response) {
  try {
    const { active, ownerId, q } = req.query;

    // active → boolean | undefined
    let isActiveFilter: boolean | undefined = undefined;
    if (active === "true") {
      isActiveFilter = true;
    } else if (active === "false") {
      isActiveFilter = false;
    }

    // ownerId → number | undefined
    let ownerIdFilter: number | undefined = undefined;
    if (typeof ownerId === "string") {
      const parsed = Number(ownerId);
      if (!Number.isNaN(parsed)) {
        ownerIdFilter = parsed;
      }
    }

    // q → string | undefined
    const query =
      typeof q === "string" && q.trim().length > 0 ? q.trim() : undefined;

    const workflows = await workflowService.getAllWorkflows({
      isActive: isActiveFilter,
      ownerId: ownerIdFilter,
      query,
    });

    return res.status(200).json({
      data: workflows,
    });
  } catch (error) {
    console.error("[WorkflowController] Error getting all workflows:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/workflows/:id
 * Get a single workflow by ID.
 */
export async function getWorkflowById(req: Request, res: Response) {
  const { id } = req.params;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({
      message: "Invalid workflow ID",
    });
  }

  try {
    const workflow = await workflowService.getWorkflowById(numericId);

    if (!workflow) {
      return res.status(404).json({
        message: "Workflow not found",
      });
    }

    return res.status(200).json({
      data: workflow,
    });
  } catch (error) {
    console.error("[WorkflowController] Error getting workflow by id:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/workflows/:id/nodes
 * Get all nodes for a workflow.
 */
export async function getWorkflowNodes(req: Request, res: Response) {
  const { id } = req.params;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({
      message: "Invalid workflow ID",
    });
  }

  try {
    const nodes = await workflowService.getWorkflowNodes(numericId);

    return res.status(200).json({
      data: nodes,
    });
  } catch (error) {
    console.error("[WorkflowController] Error getting workflow nodes:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/workflows/:id/edges
 * Get all edges for a workflow.
 */
export async function getWorkflowEdges(req: Request, res: Response) {
  const { id } = req.params;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({
      message: "Invalid workflow ID",
    });
  }

  try {
    const edges = await workflowService.getWorkflowEdges(numericId);

    return res.status(200).json({
      data: edges,
    });
  } catch (error) {
    console.error("[WorkflowController] Error getting workflow edges:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/workflows/:id/graph
 * Return { nodes, edges } for a workflow graph.
 */
export async function getWorkflowGraph(req: Request, res: Response) {
  const { id } = req.params;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({
      message: "Invalid workflow ID",
    });
  }

  try {
    const graph = await workflowService.getWorkflowGraph(numericId);

    if (!graph) {
      return res.status(404).json({
        message: "Workflow not found",
      });
    }

    return res.status(200).json({
      data: graph,
    });
  } catch (error) {
    console.error("[WorkflowController] Error getting workflow graph:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * POST /api/workflows/:id/nodes
 * Create a new node in the workflow.
 */


/**
 * PUT /api/workflows/:id/nodes/:nodeId
 * Update an existing node in the workflow.
 */
export async function updateWorkflowNode(req: Request, res: Response) {
  const { id, nodeId } = req.params;

  const workflowId = Number(id);
  const numericNodeId = Number(nodeId);

  if (Number.isNaN(workflowId) || Number.isNaN(numericNodeId)) {
    return res
      .status(400)
      .json({ message: "Invalid workflow ID or node ID" });
  }

  try {
    const { kind, name, config, posX, posY } = req.body ?? {};

    const updated = await workflowService.updateWorkflowNode(
      workflowId,
      numericNodeId,
      {
        kind,
        name,
        config,
        posX,
        posY,
      }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Node not found for this workflow",
      });
    }

    // Return whatever the frontend expects as the node shape
    return res.status(200).json({ data: updated });
  } catch (err) {
    console.error("[updateWorkflowNode] error:", err);
    return res.status(500).json({
      message: "Failed to update node",
    });
  }
}

/**
 * DELETE /api/workflows/:id/nodes/:nodeId
 * Delete a node from the workflow.
 */
export async function deleteWorkflowNode(req: Request, res: Response) {
  const { id, nodeId } = req.params;
  const numericId = Number(id);
  const numericNodeId = Number(nodeId);

  if (Number.isNaN(numericId) || Number.isNaN(numericNodeId)) {
    return res
      .status(400)
      .json({ message: "Invalid workflow ID or node ID" });
  }

  try {
    const ok = await workflowService.deleteWorkflowNode(
      numericId,
      numericNodeId
    );

    if (!ok) {
      return res.status(404).json({ message: "Node not found" });
    }

    // 204 No Content is standard for successful delete
    return res.status(204).send();
  } catch (error) {
    console.error("[WorkflowController] Error deleting workflow node:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * POST /api/workflows/:id/edges
 * Create a new edge between two nodes in the workflow.
 */
export async function createWorkflowEdge(req: Request, res: Response) {
  const { id } = req.params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) {
    return res.status(400).json({ message: "Invalid workflow ID" });
  }

  const { fromNodeId, toNodeId, label, priority, condition } = req.body;

  if (typeof fromNodeId !== "number" || typeof toNodeId !== "number") {
    return res.status(400).json({
      message: "fromNodeId and toNodeId must be numbers",
    });
  }

  try {
    const edge = await workflowService.createWorkflowEdge(numericId, {
      fromNodeId,
      toNodeId,
      label,
      priority,
      condition,
    });

    return res.status(201).json({ data: edge });
  } catch (error: any) {
    console.error("[WorkflowController] Error creating workflow edge:", error);
    return res.status(400).json({
      message: error?.message ?? "Bad request",
    });
  }
}

/**
 * PUT /api/workflows/:id/edges/:edgeId
 * Update an existing edge in the workflow.
 */
export async function updateWorkflowEdge(req: Request, res: Response) {
  const { id, edgeId } = req.params;
  const numericId = Number(id);
  const numericEdgeId = Number(edgeId);

  if (Number.isNaN(numericId) || Number.isNaN(numericEdgeId)) {
    return res
      .status(400)
      .json({ message: "Invalid workflow ID or edge ID" });
  }

  const { fromNodeId, toNodeId, label, priority, condition } = req.body;

  try {
    const edge = await workflowService.updateWorkflowEdge(
      numericId,
      numericEdgeId,
      {
        fromNodeId,
        toNodeId,
        label,
        priority,
        condition,
      }
    );

    if (!edge) {
      return res.status(404).json({ message: "Edge not found" });
    }

    return res.status(200).json({ data: edge });
  } catch (error: any) {
    console.error("[WorkflowController] Error updating workflow edge:", error);
    return res.status(400).json({
      message: error?.message ?? "Bad request",
    });
  }
}

/**
 * DELETE /api/workflows/:id/edges/:edgeId
 * Delete an edge from the workflow.
 */
export async function deleteWorkflowEdge(req: Request, res: Response) {
  const { id, edgeId } = req.params;
  const numericId = Number(id);
  const numericEdgeId = Number(edgeId);

  if (Number.isNaN(numericId) || Number.isNaN(numericEdgeId)) {
    return res
      .status(400)
      .json({ message: "Invalid workflow ID or edge ID" });
  }

  try {
    const ok = await workflowService.deleteWorkflowEdge(
      numericId,
      numericEdgeId
    );

    if (!ok) {
      return res.status(404).json({ message: "Edge not found" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("[WorkflowController] Error deleting workflow edge:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * POST /api/workflows/:id/nodes
 * Create a new node for a workflow.
 */
export async function createWorkflowNode(req: Request, res: Response) {
  const { id } = req.params;
  const workflowId = Number(id);

  if (Number.isNaN(workflowId)) {
    return res.status(400).json({ message: "Invalid workflow ID" });
  }

  const { kind, name, config, posX, posY } = req.body as {
    kind?: string;
    name?: string;
    config?: Record<string, any>;
    posX?: number;
    posY?: number;
  };

  if (!kind) {
    return res.status(400).json({ message: "Node kind is required" });
  }

  try {
    const node = await workflowService.createWorkflowNode(workflowId, {
      kind: kind as any,
      name: name ?? null,
      config: config ?? {},
      posX,
      posY,
    });

    return res.status(201).json({ data: node });
  } catch (error) {
    console.error(
      "[WorkflowController] Error creating workflow node:",
      error
    );
    return res
      .status(500)
      .json({ message: "Internal server error while creating node" });
  }
}
export async function updateWorkflowNodePosition(req: Request, res: Response) {
  const { id, nodeId } = req.params;
  const { posX, posY } = req.body as {
    posX?: number;
    posY?: number;
  };

  const numericId = Number(id);
  const numericNodeId = Number(nodeId);

  if (Number.isNaN(numericId) || Number.isNaN(numericNodeId)) {
    return res
      .status(400)
      .json({ message: "Invalid workflow ID or node ID" });
  }

  if (typeof posX !== "number" || typeof posY !== "number") {
    return res
      .status(400)
      .json({ message: "posX and posY must be numbers" });
  }

  try {
    const updated = await workflowService.updateWorkflowNodePosition(
      numericId,
      numericNodeId,
      posX,
      posY
    );

    if (!updated) {
      return res.status(404).json({ message: "Node not found" });
    }

    return res.status(200).json({ data: updated });
  } catch (error) {
    console.error(
      "[WorkflowController] Error updating workflow node position:",
      error
    );
    return res.status(500).json({ message: "Internal server error" });
  }

}

/**
 * POST /api/workflows
 * Create a workflow.
 */
export async function createWorkflow(req: Request, res: Response) {
  try {
    const { name, description, isActive, ownerUserId, defaultTrigger } =
      req.body ?? {};

    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "Workflow name is required" });
    }

    const created = await workflowService.createWorkflow({
      name: name.trim(),
      description:
        typeof description === "string" && description.trim().length > 0
          ? description.trim()
          : null,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
      ownerUserId: typeof ownerUserId === "number" ? ownerUserId : null,
      defaultTrigger:
        typeof defaultTrigger === "string" && defaultTrigger.trim().length > 0
          ? defaultTrigger.trim()
          : null,
    });

    return res.status(201).json({ data: created });
  } catch (error) {
    console.error("[WorkflowController] Error creating workflow:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}