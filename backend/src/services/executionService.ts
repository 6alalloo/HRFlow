// src/services/executionService.ts
import prisma from "../lib/prisma";

type ExecutionFilters = {
  status?: string;
  workflowId?: number;
};

/**
 * Get all executions with optional filters:
 * - status: filter by execution status
 * - workflowId: filter by workflow_id
 */
export async function getAllExecutions(filters: ExecutionFilters = {}) {
  const { status, workflowId } = filters;

  const where: any = {};

  if (status && status.trim().length > 0) {
    // Exact match on status (you can later normalize to lowercase if you want).
    where.status = status.trim();
  }

  if (typeof workflowId === "number") {
    where.workflow_id = workflowId;
  }

  const executions = await prisma.executions.findMany({
    where,
    select: {
      id: true,
      workflow_id: true,
      trigger_type: true,
      status: true,
      started_at: true,
      finished_at: true,
      duration_ms: true,
      error_message: true,
      workflows: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      started_at: "desc",
    },
  });

  return executions;
}

/**
 * Get a single execution by ID, including its workflow.
 */
export async function getExecutionById(id: number) {
  const execution = await prisma.executions.findUnique({
    where: { id },
    select: {
      id: true,
      workflow_id: true,
      trigger_type: true,
      status: true,
      run_context: true,
      started_at: true,
      finished_at: true,
      duration_ms: true,
      error_message: true,
      workflows: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return execution;
}
