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
