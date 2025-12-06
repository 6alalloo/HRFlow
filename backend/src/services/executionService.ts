
import prisma from "../lib/prisma";

type ExecutionFilters = {
  status?: string;
  workflowId?: number;
};

type ExecuteWorkflowInput = {
  workflowId: number;
  triggerType?: string;
  input?: any;
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

/**
 * Get all steps for a given execution ID.
 */
export async function getExecutionStepsByExecutionId(executionId: number) {
  const steps = await prisma.execution_steps.findMany({
    where: {
      execution_id: executionId,
    },
    select: {
      id: true,
      execution_id: true,
      node_id: true,
      status: true,
      input_json: true,
      output_json: true,
      logs: true,
      started_at: true,
      finished_at: true,
      workflow_nodes: {
        select: {
          id: true,
          name: true,
          kind: true,
        },
      },
    },
    orderBy: {
      started_at: "asc",
    },
  });

  return steps;
}

export async function executeWorkflow(params: ExecuteWorkflowInput) {
  const { workflowId, triggerType, input } = params;

  // 1. Fetch workflow
  const workflow = await prisma.workflows.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    const error: any = new Error("Workflow not found");
    error.code = "WORKFLOW_NOT_FOUND";
    throw error;
  }

  if (!workflow.is_active) {
    const error: any = new Error("Workflow is not active");
    error.code = "WORKFLOW_INACTIVE";
    throw error;
  }

  // 2. Fetch nodes for this workflow
  const nodes = await prisma.workflow_nodes.findMany({
    where: { workflow_id: workflowId },
    orderBy: { id: "asc" },
  });

  if (nodes.length === 0) {
    const error: any = new Error("Workflow has no nodes");
    error.code = "WORKFLOW_HAS_NO_NODES";
    throw error;
  }

  // 3. Create execution
  const now = new Date();
  const runContext = input ? JSON.stringify(input) : null;

  const execution = await prisma.executions.create({
    data: {
      workflow_id: workflowId,
      trigger_type:
        typeof triggerType === "string" && triggerType.trim().length > 0
          ? triggerType.trim()
          : "manual",
      status: "completed", // MVP: we treat execution as instantly completed
      run_context: runContext ?? undefined,
      started_at: now,
      finished_at: now,
      duration_ms: 0,
      error_message: null,
    },
  });

  // 4. Create execution steps (one per node, simple mock)
  const stepsData = nodes.map((node, index) => ({
    execution_id: execution.id,
    node_id: node.id,
    status: "completed",
    input_json: "{}", // later you can embed runContext or per-node input
    output_json: "{}", // later you can embed n8n or engine output here
    logs: `Executed node ${node.name ?? node.kind} (order ${index + 1})`,
    started_at: now,
    finished_at: now,
  }));

  await prisma.execution_steps.createMany({
    data: stepsData,
  });

  // 5. Fetch steps with node info for response
  const steps = await prisma.execution_steps.findMany({
    where: { execution_id: execution.id },
    select: {
      id: true,
      execution_id: true,
      node_id: true,
      status: true,
      input_json: true,
      output_json: true,
      logs: true,
      started_at: true,
      finished_at: true,
      workflow_nodes: {
        select: {
          id: true,
          name: true,
          kind: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  return {
    execution,
    steps,
  };
}