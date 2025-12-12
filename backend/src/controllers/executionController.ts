// src/controllers/executionController.ts
import { Request, Response } from "express";
import * as executionService from "../services/executionService";

/**
 * GET /api/executions
 * Optional query params:
 * - ?status=completed       → filter by execution status
 * - ?workflowId=3           → filter by workflow_id
 */
export async function getAllExecutions(req: Request, res: Response) {
  try {
    const { status, workflowId } = req.query;

    let workflowIdFilter: number | undefined = undefined;
    if (typeof workflowId === "string") {
      const parsed = Number(workflowId);
      if (!Number.isNaN(parsed)) {
        workflowIdFilter = parsed;
      }
    }

    const statusFilter =
      typeof status === "string" && status.trim().length > 0
        ? status.trim()
        : undefined;

    const executions = await executionService.getAllExecutions({
      status: statusFilter,
      workflowId: workflowIdFilter,
    });

    return res.status(200).json({
      data: executions,
    });
  } catch (error) {
    console.error("[ExecutionController] Error getting all executions:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/executions/:id
 * Returns a single execution by ID.
 */
export async function getExecutionById(req: Request, res: Response) {
  const { id } = req.params;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({
      message: "Invalid execution ID",
    });
  }

  try {
    const execution = await executionService.getExecutionById(numericId);

    if (!execution) {
      return res.status(404).json({
        message: "Execution not found",
      });
    }

    return res.status(200).json({
      data: execution,
    });
  } catch (error) {
    console.error("[ExecutionController] Error getting execution by id:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/workflows/:id/executions
 * Returns all executions for a given workflow.
 * Optional query:
 * - ?status=completed|failed|running
 */
export async function getExecutionsForWorkflow(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.query;

  const workflowId = Number(id);
  if (Number.isNaN(workflowId)) {
    return res.status(400).json({
      message: "Invalid workflow ID",
    });
  }

  const statusFilter =
    typeof status === "string" && status.trim().length > 0
      ? status.trim()
      : undefined;

  try {
    const executions = await executionService.getAllExecutions({
      status: statusFilter,
      workflowId,
    });

    return res.status(200).json({
      data: executions,
    });
  } catch (error) {
    console.error(
      "[ExecutionController] Error getting executions for workflow:",
      error
    );
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/executions/:id/steps
 * Returns all steps for a given execution.
 */
export async function getExecutionSteps(req: Request, res: Response) {
  const { id } = req.params;

  const executionId = Number(id);
  if (Number.isNaN(executionId)) {
    return res.status(400).json({
      message: "Invalid execution ID",
    });
  }

  try {
    const steps = await executionService.getExecutionStepsByExecutionId(
      executionId
    );

    // Even if there are no steps, we return 200 with an empty array.
    return res.status(200).json({
      data: steps,
    });
  } catch (error) {
    console.error(
      "[ExecutionController] Error getting steps for execution:",
      error
    );
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * POST /api/workflows/:id/execute
 * Triggers a workflow execution.
 *
 * Body shape (optional):
 * {
 *   "triggerType": "manual",
 *   "input": { ... any JSON ... }
 * }
 */
export async function executeWorkflow(req: Request, res: Response) {
  const { id } = req.params;
  const { triggerType, input } = req.body || {};

  const workflowId = Number(id);
  if (Number.isNaN(workflowId)) {
    return res.status(400).json({
      message: "Invalid workflow ID",
    });
  }

  try {
    const result = await executionService.executeWorkflow({
      workflowId,
      triggerType,
      input,
    });

    // result is { execution, steps, n8nResult }
    return res.status(201).json({
      data: result,
    });
  } catch (error: any) {
    console.error("[ExecutionController] Error executing workflow:", error);

    if (error.code === "WORKFLOW_NOT_FOUND") {
      return res.status(404).json({
        message: "Workflow not found",
      });
    }

    if (error.code === "WORKFLOW_INACTIVE") {
      return res.status(400).json({
        message: "Workflow is not active",
      });
    }

    if (error.code === "WORKFLOW_HAS_NO_NODES") {
      return res.status(400).json({
        message: "Workflow has no nodes",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
