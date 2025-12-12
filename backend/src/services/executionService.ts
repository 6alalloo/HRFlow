// src/services/executionService.ts
import prisma from "../lib/prisma";
import { callN8nExecute } from "./n8nService";

type ExecutionFilters = {
  status?: string;
  workflowId?: number;
};

type ExecuteWorkflowInput = {
  workflowId: number;
  triggerType?: string;
  input?: any;
};

// Small helper to safely parse JSON from DB columns
function safeParseJson<T = any>(
  value: string | null | undefined,
  fallback: T
): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

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

/**
 * Execute a workflow:
 * 1) Validate workflow + nodes
 * 2) Create an execution row (status = running)
 * 3) Send graph to n8n via callN8nExecute
 * 4) Update execution status + create execution_steps
 * 5) Always return execution + steps, even if engine failed
 */
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

  // 2. Fetch nodes AND edges for this workflow
  const [nodes, edges] = await Promise.all([
    prisma.workflow_nodes.findMany({
      where: { workflow_id: workflowId },
      orderBy: { id: "asc" },
    }),
    prisma.workflow_edges.findMany({
      where: { workflow_id: workflowId },
      orderBy: { id: "asc" },
    }),
  ]);

  if (nodes.length === 0) {
    const error: any = new Error("Workflow has no nodes");
    error.code = "WORKFLOW_HAS_NO_NODES";
    throw error;
  }

  const startTime = new Date();

  // We'll keep both input and engine info in run_context so we can debug later.
  const runContextPayload: any = {
    input: input ?? null,
    engine: {
      n8n: null as any,
    },
  };

  // 3. Create execution in "running" state
  const execution = await prisma.executions.create({
    data: {
      workflow_id: workflowId,
      trigger_type:
        typeof triggerType === "string" && triggerType.trim().length > 0
          ? triggerType.trim()
          : "manual",
      status: "running",
      run_context: JSON.stringify(runContextPayload),
      started_at: startTime,
      finished_at: null,
      duration_ms: null,
      error_message: null,
    },
  });

  let n8nResult: any = null;
  let finalStatus: "completed" | "engine_error" | "failed" = "completed";
  let errorMessage: string | null = null;

  // 4. Call n8n
  try {
    n8nResult = await callN8nExecute({
      hrflowWorkflowId: workflowId,
      executionId: execution.id,
      nodes: nodes.map((node) => ({
        id: node.id,
        name: node.name,
        kind: node.kind,
        config: safeParseJson<Record<string, unknown>>(node.config_json, {}),
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        from: edge.from_node_id,
        to: edge.to_node_id,
      })),
      input: input ?? null,
    });

    // For now, if n8n returns a 2xx response, we treat it as completed.
    finalStatus = "completed";
  } catch (err: any) {
    console.error("[ExecutionService] Failed to call n8n:", err);

    if (err?.code === "N8N_UNREACHABLE" || err?.code === "N8N_HTTP_ERROR") {
      finalStatus = "engine_error";
    } else {
      finalStatus = "failed";
    }

    errorMessage =
      err?.message ??
      "Failed to execute workflow via automation engine (n8n)";
  }

  const finishedTime = new Date();
  const durationMs = finishedTime.getTime() - startTime.getTime();

  // Attach engine result (might be null on failure) for debugging
  runContextPayload.engine.n8n = n8nResult;

  const updatedExecution = await prisma.executions.update({
    where: { id: execution.id },
    data: {
      status: finalStatus,
      run_context: JSON.stringify(runContextPayload),
      finished_at: finishedTime,
      duration_ms: durationMs,
      error_message: errorMessage,
    },
  });

  // 5. Create synthetic steps for now (even if engine failed → mark as "skipped")
  const stepsStatus = finalStatus === "completed" ? "completed" : "skipped";

  const stepsData = nodes.map((node, index) => ({
    execution_id: updatedExecution.id,
    node_id: node.id,
    status: stepsStatus,
    input_json: "{}", // later we can put per-node input
    output_json: "{}", // later we can put per-node output from the engine
    logs:
      finalStatus === "completed"
        ? `Executed node ${node.name ?? node.kind} (order ${
            index + 1
          }) via n8n`
        : `Skipped node ${node.name ?? node.kind} (order ${
            index + 1
          }) due to engine status "${finalStatus}"`,
    started_at: startTime,
    finished_at: finishedTime,
  }));

  if (stepsData.length > 0) {
    await prisma.execution_steps.createMany({
      data: stepsData,
    });
  }

  const steps = await prisma.execution_steps.findMany({
    where: { execution_id: updatedExecution.id },
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

  // We do NOT throw here; the controller always gets an execution.
  // The frontend can navigate to /executions/:id and show status + error_message.
  return {
    execution: updatedExecution,
    steps,
    n8nResult,
  };
}
