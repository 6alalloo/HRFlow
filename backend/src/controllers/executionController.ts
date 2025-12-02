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

    // Normalize workflowId from string to number (or undefined).
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