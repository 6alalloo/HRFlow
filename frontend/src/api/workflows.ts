// src/api/workflows.ts

const API_BASE_URL = "http://localhost:4000/api";

/* ---------- Core API types ---------- */

// Shape of workflow as returned by the backend (camelCase from Prisma)
export type WorkflowApi = {
  id: number;
  owner_user_id: number | null;
  name: string;
  description: string | null;
  is_active: boolean;
  version: number;
  default_trigger: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

// Shape of the execution payload your backend sends back
export type ExecutionApi = {
  id: number;
  workflow_id: number | null;
  trigger_type: string;
  status: string;
  run_context: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
};

// Shape of step payload
export type ExecutionStepApi = {
  id: number;
  execution_id: number;
  node_id: number | null;
  status: string;
  input_json: string;
  output_json: string;
  logs: string | null;
  started_at: string;
  finished_at: string | null;
  workflow_nodes?: {
    id: number;
    name: string | null;
    kind: string;
  };
};

// type ExecutionWithStepsResponse =
//   | { execution: ExecutionApi; steps: ExecutionStepApi[] }
//   | { data: { execution: ExecutionApi; steps: ExecutionStepApi[] } };

  type ExecutionResponse = ExecutionApi | { data: ExecutionApi };

  
type ExecutionStepsResponse =
  | ExecutionStepApi[]
  | { data: ExecutionStepApi[] };

/* ---------- List workflows ---------- */

type WorkflowsListResponse =
  | WorkflowApi[]
  | { data: WorkflowApi[] }
  | { workflows: WorkflowApi[] };

// GET /api/workflows
export async function fetchWorkflows(): Promise<WorkflowApi[]> {
  const res = await fetch(`${API_BASE_URL}/workflows`);

  if (!res.ok) {
    console.error(
      "[fetchWorkflows] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch workflows (status ${res.status})`);
  }

  const data = (await res.json()) as WorkflowsListResponse;
  console.log("[fetchWorkflows] raw response:", data);

  if (Array.isArray(data)) {
    return data;
  }

  if ("data" in data) {
    return data.data;
  }

  if ("workflows" in data) {
    return data.workflows;
  }

  throw new Error("Unexpected workflows response shape");
}

/* ---------- Execute workflow ---------- */

// POST /api/workflows/:id/execute
export async function executeWorkflow(
  workflowId: number,
  note?: string
): Promise<{
  execution: ExecutionApi;
  steps: ExecutionStepApi[];
}> {
  const res = await fetch(`${API_BASE_URL}/workflows/${workflowId}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note }),
  });

  if (!res.ok) {
    console.error(
      "[executeWorkflow] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to execute workflow ${workflowId} (status ${res.status})`
    );
  }

  const json = await res.json() as
    | { data: { execution: ExecutionApi; steps: ExecutionStepApi[] } }
    | { execution: ExecutionApi; steps: ExecutionStepApi[] };

  console.log("[executeWorkflow] raw response:", json);

  if ("data" in json) {
    return json.data;
  }

  return json;
}

/* ---------- Single workflow + graph ---------- */

// Response type for GET /api/workflows/:id
type WorkflowByIdResponse = WorkflowApi | { data: WorkflowApi };

// GET /api/workflows/:id
export async function fetchWorkflowById(
  id: number
): Promise<WorkflowApi> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}`);

  if (!res.ok) {
    console.error(
      "[fetchWorkflowById] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch workflow ${id} (status ${res.status})`);
  }

  const data = (await res.json()) as WorkflowByIdResponse;
  console.log("[fetchWorkflowById] raw response:", data);

  if ("data" in data) {
    return data.data;
  }

  return data;
}

/* ---------- Graph types ---------- */

export type WorkflowGraphNode = {
  id: number;
  workflow_id: number;
  kind: string;
  name: string | null;
  pos_x: number;
  pos_y: number;
};

export type WorkflowGraphEdge = {
  id: number;
  workflow_id: number;
  from_node_id: number;
  to_node_id: number;
  label: string | null;
  priority: number | null;
};

type WorkflowGraphResponse =
  | { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[] }
  | { data: { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[] } };

// GET /api/workflows/:id/graph
export async function fetchWorkflowGraph(
  id: number
): Promise<{
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}/graph`);

  if (!res.ok) {
    console.error(
      "[fetchWorkflowGraph] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(
      `Failed to fetch workflow graph for ${id} (status ${res.status})`
    );
  }

  const data = (await res.json()) as WorkflowGraphResponse;
  console.log("[fetchWorkflowGraph] raw response:", data);

  if ("data" in data) {
    return data.data;
  }

  return data;
}



export async function fetchExecution(
  id: number
): Promise<ExecutionApi> {
  const res = await fetch(`${API_BASE_URL}/executions/${id}`);

  if (!res.ok) {
    console.error(
      "[fetchExecution] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch execution ${id} (status ${res.status})`);
  }

  const data = (await res.json()) as ExecutionResponse;
  console.log("[fetchExecution] raw response:", data);

  if ("data" in data) {
    return data.data;
  }

  return data;
}

export async function fetchExecutionSteps(
  id: number
): Promise<ExecutionStepApi[]> {
  const res = await fetch(`${API_BASE_URL}/executions/${id}/steps`);

  if (!res.ok) {
    console.error(
      "[fetchExecutionSteps] HTTP error:",
      res.status,
      res.statusText
    );
    throw new Error(`Failed to fetch steps for execution ${id}`);
  }

  const data = (await res.json()) as ExecutionStepsResponse;
  console.log("[fetchExecutionSteps] raw response:", data);

  if (Array.isArray(data)) {
    return data;
  }

  if ("data" in data) {
    return data.data;
  }

  throw new Error("Unexpected execution steps response shape");
}