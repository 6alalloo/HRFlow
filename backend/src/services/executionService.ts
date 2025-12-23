// backend/src/services/executionService.ts
import prisma from "../lib/prisma";
import {
  callN8nExecute,
  upsertN8nWorkflow,
  activateN8nWorkflow,
  getN8nExecutionForWorkflow,
} from "./n8nService";
import { compileToN8n } from "./n8nCompiler";
import * as auditService from "./auditService";
import { config } from "../config/appConfig";
import { parseCV, type CVParseResult } from "./cvParserService";
import logger from "../lib/logger";

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
  return (
    typeof obj.email === "string" ||
    typeof obj.name === "string" ||
    typeof obj.department === "string" ||
    typeof obj.role === "string"
  );
}

function buildDemoExecuteBody(input: unknown, triggerConfigFallback: Record<string, unknown> | null) {
  const obj = normalizeObject(input);
  const result: Record<string, unknown> = {};

  let employeeData: Record<string, unknown> | null = null;

  if (obj && typeof obj.employee === "object" && obj.employee && !Array.isArray(obj.employee)) {
    employeeData = obj.employee as Record<string, unknown>;
  } else if (obj && looksLikeEmployee(obj)) {
    employeeData = obj;
  } else if (triggerConfigFallback) {
    const tc = triggerConfigFallback;
    if (typeof tc.employee === "object" && tc.employee && !Array.isArray(tc.employee)) {
      employeeData = tc.employee as Record<string, unknown>;
    } else if (looksLikeEmployee(tc)) {
      employeeData = tc;
    }
  }

  // If found, populate both nested and flat structure
  if (employeeData) {
    result.employee = employeeData;
    // Flatten fields for convenient access (e.g. {{trigger.email}})
    Object.assign(result, employeeData);
  } else {
    result.employee = {};
  }

  // Also include any other root properties from the original input if it was an object
  if (obj) {
      Object.assign(result, obj);
  }

  return result;
}

function getWebhookBaseUrl(): string {
  return config.n8n.webhookBaseUrl;
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

  let workflow = await prisma.workflows.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) throw makeCodedError("Workflow not found", "WORKFLOW_NOT_FOUND");
  
  // Auto-activate workflow if not active (better UX for builder testing)
  if (!workflow.is_active) {
    workflow = await prisma.workflows.update({
      where: { id: workflowId },
      data: { is_active: true },
    });
  }

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

  // Pre-process CV parser nodes - parse CVs before n8n workflow execution
  const cvParserResults = new Map<number, CVParseResult>();
  for (const node of nodesRaw) {
    if (node.kind === "cv_parser" || node.kind === "cv_parse") {
      const config = safeParseJson<Record<string, unknown>>(node.config_json, {});
      const fileId = config.fileId as string | undefined;

      if (fileId) {
        logger.info('Parsing CV for node', { nodeId: node.id, fileId });
        const result = await parseCV(fileId);
        cvParserResults.set(node.id, result);
        logger.info('CV parse result', {
          nodeId: node.id,
          success: result.success,
          error: result.success ? undefined : result.error
        });
      } else {
        logger.warn('No fileId provided for cv_parser node', { nodeId: node.id });
        cvParserResults.set(node.id, {
          success: false,
          source: "file",
          data: {
            name: null,
            email: null,
            phone: null,
            skills: [],
            experience_years: null,
            education: [],
          },
          error: "No file uploaded for CV parser",
        });
      }
    }
  }

  const startTime = new Date();

  const runContextPayload: RunContextPayload & { cvParserResults?: Record<number, CVParseResult> } = {
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
        n8n_webhook_path: webhookPath,
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

    finalStatus = "completed";
  } catch (err: unknown) {
    const code = getErrorCode(err);
    logger.error('Workflow execution failed', {
      workflowId,
      executionId,
      errorCode: code,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });

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

  // Store CV parser results in run_context for UI access
  if (cvParserResults.size > 0) {
    runContextPayload.cvParserResults = Object.fromEntries(cvParserResults);
  }

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

  // Parse n8n result to extract output data
  // n8n webhook returns array of items, each with json data
  let n8nOutputData: Record<string, unknown> = {};
  let n8nOutputRaw: unknown[] = [];

  if (n8nResult) {
    if (Array.isArray(n8nResult)) {
      n8nOutputRaw = n8nResult;
      // Get the last item's json data as the final output
      const lastItem = n8nResult[n8nResult.length - 1];
      if (lastItem && typeof lastItem === "object") {
        if ("json" in lastItem && typeof lastItem.json === "object") {
          n8nOutputData = lastItem.json as Record<string, unknown>;
        } else {
          n8nOutputData = lastItem as Record<string, unknown>;
        }
      }
    } else if (typeof n8nResult === "object") {
      n8nOutputData = n8nResult as Record<string, unknown>;
    }
  }

  // Fetch per-node execution data from n8n API for accurate outputs
  let perNodeOutputs: Map<string, Record<string, unknown>> = new Map();
  const n8nWorkflowId = runContextPayload.engine.n8nWorkflowId;

  if (finalStatus === "completed" && n8nWorkflowId) {
    try {
      // Small delay to ensure n8n has processed the execution
      await new Promise((resolve) => setTimeout(resolve, 500));

      logger.debug('Fetching per-node outputs from n8n', {
        executionId,
        n8nWorkflowId
      });
      const executionData = await getN8nExecutionForWorkflow(n8nWorkflowId);

      if (executionData?.nodeOutputs) {
        logger.debug('Retrieved node outputs from n8n', {
          executionId,
          nodeCount: executionData.nodeOutputs.size
        });
        for (const [nodeName, nodeData] of executionData.nodeOutputs) {
          logger.debug('Node output retrieved', {
            executionId,
            nodeName,
            dataPreview: JSON.stringify(nodeData.data).slice(0, 200)
          });
          perNodeOutputs.set(nodeName, nodeData.data);
        }
      } else {
        logger.debug('No node outputs in execution data', {
          executionId,
          hasExecutionData: !!executionData
        });
      }
    } catch (err) {
      logger.warn('Could not fetch per-node outputs from n8n', {
        executionId,
        n8nWorkflowId,
        error: err instanceof Error ? err.message : String(err)
      });
      // Fall back to webhook response data
    }
  }

  // Build input data from trigger config or execution input
  const triggerNode = nodesRaw.find((n) => n.kind === "trigger");
  const triggerConfig = triggerNode
    ? safeParseJson<Record<string, unknown>>(triggerNode.config_json, {})
    : {};
  const inputData = buildDemoExecuteBody(input, triggerConfig);

  // Helper to get stable node name (matches n8nCompiler naming)
  const getStableNodeName = (node: { id: number; name: string | null; kind: string }) => {
    const name = node.name ?? node.kind;
    return `HRFlow ${node.id} ${name}`.replace(/\s+/g, " ").trim();
  };

  const stepsData = nodesRaw.map((node, index) => {
    // First node gets the trigger input, subsequent nodes get previous output
    const stepInput = index === 0 ? inputData : n8nOutputData;

    // Try to get node-specific output from n8n execution data
    const stableNodeName = getStableNodeName(node);
    let stepOutput: Record<string, unknown> = perNodeOutputs.get(stableNodeName) || {};

    // For CV parser nodes, use the pre-computed cvParserResults
    if ((node.kind === "cv_parser" || node.kind === "cv_parse") && cvParserResults.has(node.id)) {
      const cvResult = cvParserResults.get(node.id)!;
      stepOutput = {
        ...cvResult.data,
        _hrflow: {
          nodeType: "cv_parser",
          cvParsed: cvResult.success,
          source: cvResult.source,
          filename: cvResult.filename,
          error: cvResult.error,
        },
      };
    } else if (Object.keys(stepOutput).length === 0) {
      // If no per-node data available, fall back to webhook response
      // If n8n returned multiple items, try to map to node order
      if (n8nOutputRaw.length > index) {
        const nodeResult = n8nOutputRaw[index];
        if (nodeResult && typeof nodeResult === "object") {
          if ("json" in nodeResult && typeof (nodeResult as Record<string, unknown>).json === "object") {
            stepOutput = (nodeResult as Record<string, unknown>).json as Record<string, unknown>;
          } else {
            stepOutput = nodeResult as Record<string, unknown>;
          }
        }
      } else {
        stepOutput = n8nOutputData;
      }
    }

    // Build meaningful log message
    let logMessage: string;
    if (finalStatus === "completed") {
      const hrflowMeta = stepOutput._hrflow as Record<string, unknown> | undefined;
      if (hrflowMeta?.log) {
        const logData = hrflowMeta.log as Record<string, unknown>;
        logMessage = `[${logData.level ?? "info"}] ${logData.message ?? "Logged"}`;
      } else if (node.kind === "trigger") {
        logMessage = `Trigger executed - Employee: ${(stepOutput.employee as Record<string, unknown>)?.name ?? "Unknown"}`;
      } else if (node.kind === "cv_parse" || node.kind === "cv_parser") {
        const cvMeta = stepOutput._hrflow as Record<string, unknown> | undefined;
        if (cvMeta?.cvParsed) {
          const name = stepOutput.name || "Unknown";
          const skills = Array.isArray(stepOutput.skills) ? stepOutput.skills.length : 0;
          logMessage = `CV parsed successfully - Candidate: ${name}, Skills found: ${skills}`;
        } else {
          logMessage = `CV parsing failed - ${cvMeta?.error || "Unknown error"}`;
        }
      } else {
        logMessage = `Executed node ${node.name ?? node.kind} (order ${index + 1}) via n8n`;
      }
    } else {
      logMessage = `Skipped node ${node.name ?? node.kind} (order ${index + 1}) due to engine status "${finalStatus}"`;
    }

    return {
      execution_id: updatedExecution.id,
      node_id: node.id,
      status: stepsStatus,
      input_json: JSON.stringify(stepInput),
      output_json: JSON.stringify(stepOutput),
      logs: logMessage,
      started_at: startTime,
      finished_at: finishedTime,
    };
  });

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
