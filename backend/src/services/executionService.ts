// backend/src/services/executionService.ts
import prisma from "../lib/prisma";
import {
  callN8nExecute,
  upsertN8nWorkflow,
  activateN8nWorkflow,
} from "./n8nService";
import { compileToN8n } from "./n8nCompiler";
import * as auditService from "./auditService";

type ExecutionFilters = {
  status?: string;
  workflowId?: number;
};

type ExecuteWorkflowInput = {
  workflowId: number;
  triggerType?: string;
  input?: unknown;
};

type ExecutionFinalStatus = "completed" | "engine_error" | "failed";
type StepStatus = "completed" | "skipped";

type ErrorWithCode = Error & { code?: string };

type RunContextPayload = {
  input: unknown | null;
  engine: {
    n8n: unknown | null;
    n8nWorkflowId?: string | null;
    n8nCreated?: boolean | null;
    webhookPath?: string | null;
    webhookUrl?: string | null;
  };
};

function safeParseJson<T = unknown>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function makeCodedError(message: string, code: string): ErrorWithCode {
  const err: ErrorWithCode = new Error(message);
  err.code = code;
  return err;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function getErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const maybe = (err as { code?: unknown }).code;
    return typeof maybe === "string" ? maybe : undefined;
  }
  return undefined;
}

function normalizeObject(input: unknown): Record<string, unknown> | null {
  if (input == null) return null;
  if (typeof input !== "object") return null;
  if (Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

function looksLikeEmployee(obj: Record<string, unknown>): boolean {
  // loose heuristic for demo payload
  return (
    typeof obj.email === "string" ||
    typeof obj.name === "string" ||
    typeof obj.department === "string" ||
    typeof obj.role === "string"
  );
}

function buildDemoExecuteBody(input: unknown, triggerConfigFallback: Record<string, unknown> | null) {
  const obj = normalizeObject(input);

  // Best case: { employee: {...} }
  if (obj && typeof obj.employee === "object" && obj.employee && !Array.isArray(obj.employee)) {
    return { employee: obj.employee as Record<string, unknown> };
  }

  // Next: input itself looks like employee -> wrap it
  if (obj && looksLikeEmployee(obj)) {
    return { employee: obj };
  }

  // Fallback: trigger node config might contain demo employee data
  if (triggerConfigFallback) {
    // If trigger config already has employee, use it; else treat whole config as employee-ish
    const tc = triggerConfigFallback;
    if (typeof tc.employee === "object" && tc.employee && !Array.isArray(tc.employee)) {
      return { employee: tc.employee as Record<string, unknown> };
    }
    if (looksLikeEmployee(tc)) {
      return { employee: tc };
    }
  }

  // Final fallback: empty employee (keeps compiled flow from crashing)
  return { employee: {} };
}

function getWebhookBaseUrl(): string {
  const fromEnv = process.env.N8N_WEBHOOK_BASE_URL;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();

  // Sensible default for local demo if not set explicitly
  return "http://localhost:5678";
}

export async function getAllExecutions(filters: ExecutionFilters = {}) {
  const { status, workflowId } = filters;

  const where: Record<string, unknown> = {};
  if (status && status.trim().length > 0) where.status = status.trim();
  if (typeof workflowId === "number") where.workflow_id = workflowId;

  return prisma.executions.findMany({
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
      workflows: { select: { id: true, name: true } },
    },
    orderBy: { started_at: "desc" },
  });
}

export async function getExecutionById(id: number) {
  return prisma.executions.findUnique({
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
      workflows: { select: { id: true, name: true } },
    },
  });
}

export async function getExecutionStepsByExecutionId(executionId: number) {
  return prisma.execution_steps.findMany({
    where: { execution_id: executionId },
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
      workflow_nodes: { select: { id: true, name: true, kind: true } },
    },
    orderBy: { started_at: "asc" },
  });
}

export async function executeWorkflow(params: ExecuteWorkflowInput) {
  const { workflowId, triggerType, input } = params;

  const workflow = await prisma.workflows.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) throw makeCodedError("Workflow not found", "WORKFLOW_NOT_FOUND");
  if (!workflow.is_active) throw makeCodedError("Workflow is not active", "WORKFLOW_INACTIVE");

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

  if (nodesRaw.length === 0) {
    throw makeCodedError("Workflow has no nodes", "WORKFLOW_HAS_NO_NODES");
  }

  const startTime = new Date();

  const runContextPayload: RunContextPayload = {
    input: input ?? null,
    engine: {
      n8n: null,
      n8nWorkflowId: null,
      n8nCreated: null,
      webhookPath: null,
      webhookUrl: null,
    },
  };

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
      n8n_execution_id: null,
    },
  });

  // Audit log execution start
  await auditService.logAuditEvent({
    eventType: "execution_started",
    userId: workflow.owner_user_id || 1,
    targetType: "execution",
    targetId: execution.id,
    details: {
      workflowId,
      workflowName: workflow.name,
      triggerType: triggerType ?? "manual",
    },
  });

  let n8nResult: unknown | null = null;
  let finalStatus: ExecutionFinalStatus = "failed";
  let errorMessage: string | null = null;

  
  const webhookPath = `/webhook/hrflow-${workflowId}-execute`;
  const webhookUrl = `${getWebhookBaseUrl()}${webhookPath}`;

  try {
    // 1) Compile HRFlow graph -> n8n workflow JSON
    const compiled = await compileToN8n({
      hrflowWorkflowId: workflowId,
      workflowName: workflow.name,
      webhookPath,
      userId: workflow.owner_user_id || undefined,
      nodes: nodesRaw.map((n) => ({
        id: n.id,
        kind: n.kind,
        name: n.name ?? null,
        config: safeParseJson<Record<string, unknown>>(n.config_json, {}),
        posX: n.pos_x,
        posY: n.pos_y,
      })),
      edges: edgesRaw.map((e) => ({
        id: e.id,
        fromNodeId: e.from_node_id,
        toNodeId: e.to_node_id,
        priority: e.priority ?? 0,
        label: e.label ?? null,
        condition: safeParseJson<Record<string, unknown>>(e.condition_json, {}),
      })),
    });

    // 2) Upsert into n8n by name (stable)
    const n8nName = `HRFlow: ${workflow.name} (#${workflowId})`;
    const upsert = await upsertN8nWorkflow({
      name: n8nName,
      nodes: compiled.nodes,
      connections: compiled.connections,
    });

    runContextPayload.engine.n8nWorkflowId = upsert.id;
    runContextPayload.engine.n8nCreated = upsert.created;
    runContextPayload.engine.webhookPath = webhookPath;
    runContextPayload.engine.webhookUrl = webhookUrl;

    // Save engine metadata in our DB
    await prisma.workflows.update({
      where: { id: workflowId },
      data: {
        n8n_workflow_id: upsert.id,
        n8n_webhook_path: webhookPath, // ✅ store the real unique path
      },
    });

    // 3) Activate workflow
    await activateN8nWorkflow(upsert.id);

    // 4) Execute via the compiled workflow's webhook URL
    const triggerNode = nodesRaw.find((n) => n.kind === "trigger");
    const triggerConfig = triggerNode
      ? safeParseJson<Record<string, unknown>>(triggerNode.config_json, {})
      : null;

    const body = buildDemoExecuteBody(input, triggerConfig);

    n8nResult = await callN8nExecute(webhookUrl, body);

    // If we got here without throwing, we treat it as completed for MVP.
    finalStatus = "completed";
  } catch (err: unknown) {
    console.error("[ExecutionService] Engine failure:", err);

    const code = getErrorCode(err);
    if (code === "N8N_UNREACHABLE" || code === "N8N_HTTP_ERROR" || code === "N8N_MISSING_API_KEY") {
      finalStatus = "engine_error";
    } else {
      finalStatus = "failed";
    }

    errorMessage = getErrorMessage(err) || "Failed to execute workflow via n8n";
  }

  const finishedTime = new Date();
  const durationMs = finishedTime.getTime() - startTime.getTime();

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

  // Audit log execution
  await auditService.logAuditEvent({
    eventType: finalStatus === "completed" ? "execution_completed" : "execution_failed",
    userId: workflow.owner_user_id || 1,
    targetType: "execution",
    targetId: updatedExecution.id,
    details: {
      workflowId,
      workflowName: workflow.name,
      status: finalStatus,
      durationMs,
      triggerType,
    },
  });

  // MVP steps behavior: mark completed if execution completed, else skipped
  const stepsStatus: StepStatus = finalStatus === "completed" ? "completed" : "skipped";

  const stepsData = nodesRaw.map((node, index) => ({
    execution_id: updatedExecution.id,
    node_id: node.id,
    status: stepsStatus,
    input_json: "{}",
    output_json: "{}",
    logs:
      finalStatus === "completed"
        ? `Executed node ${node.name ?? node.kind} (order ${index + 1}) via n8n`
        : `Skipped node ${node.name ?? node.kind} (order ${index + 1}) due to engine status "${finalStatus}"`,
    started_at: startTime,
    finished_at: finishedTime,
  }));

  if (stepsData.length > 0) {
    await prisma.execution_steps.createMany({ data: stepsData });
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
      workflow_nodes: { select: { id: true, name: true, kind: true } },
    },
    orderBy: { id: "asc" },
  });

  return {
    execution: updatedExecution,
    steps,
    n8nResult,
  };
}

export async function deleteExecution(id: number) {
  const existing = await prisma.executions.findUnique({
    where: { id },
    select: {
      id: true,
      workflow_id: true,
      trigger_type: true,
      status: true,
    },
  });

  if (!existing) return null;

  await prisma.executions.delete({
    where: { id },
  });

  return existing;
}
