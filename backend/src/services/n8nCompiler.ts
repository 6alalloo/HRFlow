// backend/src/services/n8nCompiler.ts
import type { WorkflowNodeKind } from "./workflowService";
import * as allowListService from "./allowListService";
import * as auditService from "./auditService";
import { config } from "../config/appConfig";

import {
  N8N_POSTGRES_CREDENTIAL_ID,
  N8N_POSTGRES_CREDENTIAL_NAME,
  N8N_SMTP_CREDENTIAL_ID,
  N8N_SMTP_CREDENTIAL_NAME,
} from "../config/n8nConfig";

type HRFlowNode = {
  id: number;
  kind: string;
  name: string | null;
  config: Record<string, unknown>;
  posX: number;
  posY: number;
};

type HRFlowEdge = {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  priority: number;
  label?: string | null;
  condition?: Record<string, unknown> | null;
};

type CompileInput = {
  hrflowWorkflowId: number;
  workflowName: string;
  // full path like "/webhook/hrflow-1002-execute"
  webhookPath: string;
  nodes: HRFlowNode[];
  edges: HRFlowEdge[];
  // Optional user ID for audit logging
  userId?: number;
};

type N8nCompiled = {
  nodes: any[];
  connections: Record<string, any>;
};

type UrlValidationError = {
  nodeId: number;
  nodeName: string;
  url: string;
  reason: string;
};

/**
 * Validate all URLs in the workflow against the allow-list
 * Returns an array of validation errors (empty if all URLs are allowed)
 */
async function validateWorkflowUrls(
  nodes: HRFlowNode[],
  workflowId: number,
  userId?: number
): Promise<UrlValidationError[]> {
  const errors: UrlValidationError[] = [];
  const urls = allowListService.extractUrlsFromWorkflow(nodes);

  for (const url of urls) {
    const result = await allowListService.isUrlAllowed(url);

    if (!result.allowed) {
      // Find which node(s) contain this URL
      for (const node of nodes) {
        const cfg = node.config || {};
        const nodeUrls: string[] = [];

        if (node.kind === "http" && typeof cfg.url === "string") {
          nodeUrls.push(cfg.url);
        }
        if (node.kind === "cv_parse" && cfg.inputType === "url" && typeof cfg.cvUrl === "string") {
          nodeUrls.push(cfg.cvUrl);
        }

        if (nodeUrls.includes(url)) {
          errors.push({
            nodeId: node.id,
            nodeName: node.name || node.kind,
            url,
            reason: result.reason || "Domain not in allow-list",
          });

          // Log the blocked request
          if (userId) {
            await auditService.logAuditEvent({
              eventType: "http_domain_blocked",
              userId,
              targetType: "workflow",
              targetId: workflowId,
              details: {
                nodeId: node.id,
                nodeName: node.name,
                blockedUrl: url,
                reason: result.reason,
              },
            });
          }
        }
      }
    }
  }

  return errors;
}


function normalizeName(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function stableNodeName(n: HRFlowNode) {
  return normalizeName(`HRFlow ${n.id} ${n.name ?? n.kind}`);
}

function safeString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function safeBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function safeRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function makeNoOpNode(id: string, name: string, position: [number, number]) {
  return {
    id,
    name,
    type: "n8n-nodes-base.noOp",
    typeVersion: 1,
    position,
    parameters: {},
  };
}


/**
 * Parse headers/kv text in either:
 * 1) JSON object string: {"Authorization":"Bearer x"}
 * 2) key:value lines:
 *    Authorization: Bearer x
 *    X-Test: 1
 */
function parseKeyValueText(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input !== "string") return {};

  const text = input.trim();
  if (!text) return {};

  const looksJson =
    (text.startsWith("{") && text.endsWith("}")) ||
    (text.startsWith("[") && text.endsWith("]"));

  if (looksJson) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }

  const out: Record<string, unknown> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (!k) continue;

    out[k] = v;
  }
  return out;
}

function parseJsonObjectOrEmpty(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input !== "string") return {};

  const text = input.trim();
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function pickStartNode(nodes: HRFlowNode[], edges: HRFlowEdge[]): HRFlowNode | null {
  const incoming = new Set<number>();
  for (const e of edges) incoming.add(e.toNodeId);
  return nodes.find((n) => !incoming.has(n.id)) ?? nodes[0] ?? null;
}

function groupOutgoing(edges: HRFlowEdge[]) {
  const map = new Map<number, HRFlowEdge[]>();
  for (const e of edges) {
    const list = map.get(e.fromNodeId) ?? [];
    list.push(e);
    map.set(e.fromNodeId, list);
  }
  for (const [k, list] of map) {
    list.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    map.set(k, list);
  }
  return map;
}

function buildReachableOrder(nodes: HRFlowNode[], edges: HRFlowEdge[]): HRFlowNode[] {
  if (nodes.length === 0) return [];
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const outgoing = groupOutgoing(edges);
  const start = pickStartNode(nodes, edges);
  if (!start) return [];

  const order: HRFlowNode[] = [];
  const visited = new Set<number>();
  const stack: number[] = [start.id];

  while (stack.length) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = byId.get(id);
    if (node) order.push(node);

    const outs = outgoing.get(id) ?? [];
    for (let i = outs.length - 1; i >= 0; i--) {
      stack.push(outs[i].toNodeId);
    }
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) order.push(n);
  }

  return order;
}

function connect(
  fromName: string,
  toName: string,
  connections: Record<string, any>,
  outputIndex = 0
) {
  connections[fromName] = connections[fromName] ?? { main: [] };
  connections[fromName].main[outputIndex] =
    connections[fromName].main[outputIndex] ?? [];
  connections[fromName].main[outputIndex].push({
    node: toName,
    type: "main",
    index: 0,
  });
}

function connectConditionNode(
  fromNode: HRFlowNode,
  outgoingEdges: HRFlowEdge[],
  byId: Map<number, HRFlowNode>,
  connections: Record<string, any>
) {
  const fromName = stableNodeName(fromNode);

  const outs = [...outgoingEdges];
  const trueEdges = outs.filter((e) => (e.label ?? "").toLowerCase().includes("true"));
  const falseEdges = outs.filter((e) => (e.label ?? "").toLowerCase().includes("false"));

  if (trueEdges.length || falseEdges.length) {
    for (const e of trueEdges) {
      const to = byId.get(e.toNodeId);
      if (to) connect(fromName, stableNodeName(to), connections, 0);
    }
    for (const e of falseEdges) {
      const to = byId.get(e.toNodeId);
      if (to) connect(fromName, stableNodeName(to), connections, 1);
    }

    const used = new Set([...trueEdges, ...falseEdges].map((e) => e.id));
    for (const e of outs) {
      if (used.has(e.id)) continue;
      const to = byId.get(e.toNodeId);
      if (to) connect(fromName, stableNodeName(to), connections, 0);
    }
    return;
  }

  for (let i = 0; i < outs.length; i++) {
    const e = outs[i];
    const to = byId.get(e.toNodeId);
    if (!to) continue;

    if (i === 0) connect(fromName, stableNodeName(to), connections, 0);
    else if (i === 1) connect(fromName, stableNodeName(to), connections, 1);
    else connect(fromName, stableNodeName(to), connections, 0);
  }
}

function makeCodeNode(args: {
  id: string;
  name: string;
  position: [number, number];
  jsCode: string;
}) {
  // IMPORTANT for your n8n:
  // Code node expects jsCode to exist and is read from node parameters.
  // Also include mode+language to match what the UI/runtime expects.
  return {
    id: args.id,
    name: args.name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: args.position,
    parameters: {
      mode: "runOnceForAllItems",
      language: "javascript",
      jsCode: args.jsCode,
    },
  };
}

function mapHrflowNodeToN8n(n: HRFlowNode, position: [number, number]) {
  const kind = safeString(n.kind).toLowerCase() as WorkflowNodeKind;
  const name = stableNodeName(n);
  const cfg = safeRecord(n.config);

  switch (kind) {
case "trigger": {
  // HRFlow "trigger" passes through the webhook data with employee info exposed.
  // Use Set node to make the data available for subsequent nodes.
  const employeeName = safeString(cfg.name, "");
  const employeeEmail = safeString(cfg.email, "");
  const department = safeString(cfg.department, "");
  const role = safeString(cfg.role, "");
  const startDate = safeString(cfg.startDate, "");
  const managerEmail = safeString(cfg.managerEmail, "");

  return {
    id: `hrflow_node_${n.id}`,
    name,
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position,
    parameters: {
      mode: "manual",
      duplicateItem: false,
      assignments: {
        assignments: [
          {
            id: `trigger_name_${n.id}`,
            name: "employee.name",
            value: employeeName || "={{ $json.body?.employee?.name || $json.employee?.name || '' }}",
            type: "string",
          },
          {
            id: `trigger_email_${n.id}`,
            name: "employee.email",
            value: employeeEmail || "={{ $json.body?.employee?.email || $json.employee?.email || '' }}",
            type: "string",
          },
          {
            id: `trigger_dept_${n.id}`,
            name: "employee.department",
            value: department || "={{ $json.body?.employee?.department || $json.employee?.department || '' }}",
            type: "string",
          },
          {
            id: `trigger_role_${n.id}`,
            name: "employee.role",
            value: role || "={{ $json.body?.employee?.role || $json.employee?.role || '' }}",
            type: "string",
          },
          {
            id: `trigger_start_${n.id}`,
            name: "employee.startDate",
            value: startDate || "={{ $json.body?.employee?.startDate || $json.employee?.startDate || '' }}",
            type: "string",
          },
          {
            id: `trigger_manager_${n.id}`,
            name: "employee.managerEmail",
            value: managerEmail || "={{ $json.body?.employee?.managerEmail || $json.employee?.managerEmail || '' }}",
            type: "string",
          },
          {
            id: `trigger_ts_${n.id}`,
            name: "_hrflow.triggeredAt",
            value: "={{ $now.toISO() }}",
            type: "string",
          },
          {
            id: `trigger_type_${n.id}`,
            name: "_hrflow.nodeType",
            value: "trigger",
            type: "string",
          },
        ],
      },
      includeOtherFields: true,
      options: {},
    },
  };
}

    case "http": {
      // Default to httpbin for testing/demo purposes
      const url = safeString(cfg.url, "https://httpbin.org/anything");
      const method = safeString(cfg.method, "GET").toUpperCase();

      const headersObj = parseKeyValueText(cfg.headers);
      const bodyObj = parseJsonObjectOrEmpty(cfg.bodyTemplate);

      return {
        id: `hrflow_node_${n.id}`,
        name,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4,
        position,
        parameters: {
          method,
          url,
          headerParametersUi: {
            parameter: Object.entries(headersObj).map(([k, v]) => ({
              name: k,
              value: typeof v === "string" ? v : JSON.stringify(v),
            })),
          },
          ...(method !== "GET"
            ? {
                sendBody: true,
                bodyParametersUi: {
                  parameter: Object.entries(bodyObj).map(([k, v]) => ({
                    name: k,
                    value: typeof v === "string" ? v : JSON.stringify(v),
                  })),
                },
              }
            : {}),
          options: {},
        },
      };
    }

    case "logger": {
      // Use Set node to add logging metadata - data flows through with log info attached
      const message = safeString(cfg.message, `Log from node ${n.id}`);
      const level = safeString(cfg.level, "info");

      return {
        id: `hrflow_node_${n.id}`,
        name,
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position,
        parameters: {
          mode: "manual",
          duplicateItem: false,
          assignments: {
            assignments: [
              {
                id: `log_msg_${n.id}`,
                name: "_hrflow.log.message",
                value: message,
                type: "string",
              },
              {
                id: `log_level_${n.id}`,
                name: "_hrflow.log.level",
                value: level,
                type: "string",
              },
              {
                id: `log_ts_${n.id}`,
                name: "_hrflow.log.timestamp",
                value: "={{ $now.toISO() }}",
                type: "string",
              },
              {
                id: `log_node_${n.id}`,
                name: "_hrflow.log.nodeId",
                value: String(n.id),
                type: "string",
              },
              {
                id: `log_type_${n.id}`,
                name: "_hrflow.nodeType",
                value: "logger",
                type: "string",
              },
            ],
          },
          includeOtherFields: true,
          options: {},
        },
      };
    }

    case "database": {
  const customQuery = safeString(cfg.query, "").trim();

  const defaultQuery = [
  "WITH role_pick AS (",
  "  SELECT id",
  "  FROM \"Core\".roles",
  "  WHERE lower(name) = 'employee'",
  "  LIMIT 1",
  "),",
  "upsert_user AS (",
  "  INSERT INTO \"Core\".users (email, password_hash, full_name, role_id, is_active)",
  "  VALUES (",
  "    '={{(",
  "      ($json.employee && $json.employee.email ? $json.employee.email : $json.email)",
  `      || "${config.email.defaultRecipient}"`,
  "    )}}',",
  "    'TEMP_PASSWORD_HASH',",
  "    '={{(",
  "      ($json.employee && $json.employee.name ? $json.employee.name : ($json.name || $json.full_name || $json.fullName))",
  "      || \"Demo User\"",
  "    )}}',",
  "    COALESCE((SELECT id FROM role_pick), 1),",
  "    true",
  "  )",
  "  ON CONFLICT (email)",
  "  DO UPDATE SET",
  "    full_name = EXCLUDED.full_name,",
  "    is_active = true",
  "  RETURNING id",
  "),",
  "ins_employee AS (",
  "  INSERT INTO \"Core\".employees (user_id, hire_date, probation_end, is_active)",
  "  SELECT",
  "    upsert_user.id,",
  "    CURRENT_DATE,",
  "    NULL,",
  "    true",
  "  FROM upsert_user",
  "  WHERE NOT EXISTS (",
  "    SELECT 1 FROM \"Core\".employees e WHERE e.user_id = upsert_user.id",
  "  )",
  "  RETURNING id",
  ")",
  "SELECT",
  "  (SELECT id FROM upsert_user) AS user_id,",
  "  (SELECT id FROM ins_employee) AS employee_id,",
  "  '={{(",
  "      ($json.employee && $json.employee.email ? $json.employee.email : $json.email)",
  `      || "${config.email.defaultRecipient}"`,
  "    )}}' AS email,",
  "  '={{(",
  "      ($json.employee && $json.employee.name ? $json.employee.name : ($json.name || $json.full_name || $json.fullName))",
  "      || \"Demo User\"",
  "    )}}' AS name;",
].join("\n");

  const query = customQuery.length > 0 ? customQuery : defaultQuery;

  if (!N8N_POSTGRES_CREDENTIAL_ID.trim() || !N8N_POSTGRES_CREDENTIAL_NAME.trim()) {
    throw new Error("Missing Postgres credential env vars (ID + NAME) for n8n compiler.");
  }

  return {
    id: `hrflow_node_${n.id}`,
    name,
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6, // match your working export
    position,
    parameters: {
      operation: "executeQuery",
      query,
      options: {}, // match export shape
    },
    credentials: {
      postgres: {
        id: N8N_POSTGRES_CREDENTIAL_ID.trim(),
        name: N8N_POSTGRES_CREDENTIAL_NAME.trim(),
      },
    },
  };
}

case "email": {
  const cc = safeString(cfg.cc, "").trim();
  const bcc = safeString(cfg.bcc, "").trim();

  if (!N8N_SMTP_CREDENTIAL_ID.trim() || !N8N_SMTP_CREDENTIAL_NAME.trim()) {
    throw new Error("Missing SMTP credential env vars (ID + NAME) for n8n compiler.");
  }

  // If someone set cfg.to before to the broken value, override it.
  let toEmail = safeString(cfg.to, "").trim();
  if (!toEmail || toEmail.includes("$json.employee.email") || toEmail.includes("json.employee.email")) {
    toEmail = '={{$node["HRFlow Webhook Trigger"].json.body.employee.email}}';
  } else if (!toEmail.startsWith("=")) {
    // allow people to type {{$...}} without the "="
    toEmail = `=${toEmail}`;
  }

  const subject =
    '=Welcome to HRFlow, {{$node["HRFlow Webhook Trigger"].json.body.employee.name}}!';

  // IMPORTANT: start with "=" so n8n evaluates the {{...}} expressions
  const html =
    '=Hi {{$node["HRFlow Webhook Trigger"].json.body.employee.name}},<br/><br/>' +
    'Welcome to the <b>{{$node["HRFlow Webhook Trigger"].json.body.employee.department}}</b> department!<br/>' +
    'We’re excited to have you join as a <b>{{$node["HRFlow Webhook Trigger"].json.body.employee.role}}</b>.<br/><br/>' +
    'If you need anything before day one, just reply to this email.<br/><br/>' +
    'Best regards,<br/><b>HRFlow Team</b>';

  return {
    id: `hrflow_node_${n.id}`,
    name,
    type: "n8n-nodes-base.emailSend",
    typeVersion: 2.1,
    position,
    parameters: {
      fromEmail: config.email.defaultSender,
      toEmail,
      ...(cc ? { ccEmail: cc } : {}),
      ...(bcc ? { bccEmail: bcc } : {}),
      subject,
      emailFormat: "html",
      html,
      options: {},
    },
    credentials: {
      smtp: {
        id: N8N_SMTP_CREDENTIAL_ID.trim(),
        name: N8N_SMTP_CREDENTIAL_NAME.trim(),
      },
    },
  };
}

    case "cv_parse":
    case "cv_parser": {
      // CV parsing happens in HRFlow executionService before n8n execution.
      // This node is a pass-through that just marks cv_parser was executed.
      // The actual CV data is injected into execution_steps by executionService.
      return {
        id: `hrflow_node_${n.id}`,
        name,
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position,
        parameters: {
          mode: "manual",
          duplicateItem: false,
          assignments: {
            assignments: [
              {
                id: `cv_type_${n.id}`,
                name: "_hrflow.nodeType",
                value: "cv_parser",
                type: "string",
              },
              {
                id: `cv_parsed_${n.id}`,
                name: "_hrflow.cvParsed",
                value: "true",
                type: "string",
              },
              {
                id: `cv_ts_${n.id}`,
                name: "_hrflow.cvParsedAt",
                value: "={{ $now.toISO() }}",
                type: "string",
              },
            ],
          },
          includeOtherFields: true,
          options: {},
        },
      };
    }

    case "variable": {
      // NOTE: n8n API strips jsCode from Code nodes - use Set node instead
      const variableName = safeString(cfg.variableName, "myVariable");
      const value = safeString(cfg.value, "");

      return {
        id: `hrflow_node_${n.id}`,
        name,
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position,
        parameters: {
          mode: "manual",
          duplicateItem: false,
          assignments: {
            assignments: [
              {
                id: `assignment_${n.id}`,
                name: variableName,
                value: value,
                type: "string",
              },
            ],
          },
          includeOtherFields: true,
          options: {},
        },
      };
    }

    case "datetime": {
      // Use Set node to add datetime output
      const operation = safeString(cfg.operation, "now");
      const format = safeString(cfg.format, "YYYY-MM-DD");
      const outputField = safeString(cfg.outputField, "calculatedDate");
      const value = typeof cfg.value === "number" ? cfg.value : 0;
      const unit = safeString(cfg.unit, "days");

      // Build the expression based on operation
      let dateExpression = "={{ $now.toISO() }}";
      if (operation === "add") {
        dateExpression = `={{ $now.plus({ ${unit}: ${value} }).toISO() }}`;
      } else if (operation === "subtract") {
        dateExpression = `={{ $now.minus({ ${unit}: ${value} }).toISO() }}`;
      } else if (operation === "format") {
        dateExpression = `={{ $now.toFormat('${format}') }}`;
      }

      return {
        id: `hrflow_node_${n.id}`,
        name,
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position,
        parameters: {
          mode: "manual",
          duplicateItem: false,
          assignments: {
            assignments: [
              {
                id: `dt_result_${n.id}`,
                name: outputField,
                value: dateExpression,
                type: "string",
              },
              {
                id: `dt_op_${n.id}`,
                name: "_hrflow.datetime.operation",
                value: operation,
                type: "string",
              },
              {
                id: `dt_type_${n.id}`,
                name: "_hrflow.nodeType",
                value: "datetime",
                type: "string",
              },
            ],
          },
          includeOtherFields: true,
          options: {},
        },
      };
    }







    default: {
      // Use NoOp for unknown node types to avoid Code node issues
      return makeNoOpNode(`hrflow_node_${n.id}`, name, position);
    }
  }
}

export async function compileToN8n(input: CompileInput): Promise<N8nCompiled> {
  // Validate URLs against allow-list before compilation
  const urlErrors = await validateWorkflowUrls(
    input.nodes,
    input.hrflowWorkflowId,
    input.userId
  );

  if (urlErrors.length > 0) {
    const errorMessages = urlErrors.map(
      (e) => `Node "${e.nodeName}" (ID: ${e.nodeId}): URL "${e.url}" blocked - ${e.reason}`
    );
    throw new Error(
      `Workflow compilation blocked due to non-whitelisted domains:\n${errorMessages.join("\n")}`
    );
  }

  const ordered = buildReachableOrder(input.nodes, input.edges);
  const byId = new Map(input.nodes.map((n) => [n.id, n] as const));
  const outgoing = groupOutgoing(input.edges);

  const webhookNodeName = normalizeName("HRFlow Webhook Trigger");

  // Normalize internalPath and keep it slash-free (webhook stability)
  const internalPath = input.webhookPath
    .replace(/^\/webhook\//, "")
    .replace(/^\//, "")
    .replace(/\//g, "-");

  const compiledNodes: any[] = [
    {
      id: "hrflow_webhook",
      name: webhookNodeName,
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      position: [200, 200],

      // IMPORTANT: without webhookId, some n8n versions fail to register the production webhook after API upserts.
      webhookId: internalPath,

      parameters: {
        httpMethod: "POST",
        path: internalPath,
        responseMode: "lastNode",
        options: {},
      },
    },
  ];

  for (let i = 0; i < ordered.length; i++) {
    const n = ordered[i];
    const pos: [number, number] = [450 + i * 260, 200 + (i % 2) * 140];
    compiledNodes.push(mapHrflowNodeToN8n(n, pos));
  }

  // Webhook -> roots
  const incoming = new Set<number>();
  for (const e of input.edges) incoming.add(e.toNodeId);

  const roots = input.nodes.filter((n) => !incoming.has(n.id));
  const rootsToConnect = roots.length ? roots : ordered.slice(0, 1);

  const connections: Record<string, any> = {};

  for (const r of rootsToConnect) {
    connect(webhookNodeName, stableNodeName(r), connections, 0);
  }

  // Graph edges
  for (const n of input.nodes) {
    const outs = outgoing.get(n.id) ?? [];
    if (outs.length === 0) continue;

    const k = safeString(n.kind).toLowerCase();

    if (k === "condition") {
      connectConditionNode(n, outs, byId, connections);
      continue;
    }

    const fromName = stableNodeName(n);
    for (const e of outs) {
      const to = byId.get(e.toNodeId);
      if (!to) continue;
      connect(fromName, stableNodeName(to), connections, 0);
    }
  }

  return { nodes: compiledNodes, connections };
}

