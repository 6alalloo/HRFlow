import { N8N_EXECUTE_URL } from "../config/n8nConfig";

export type N8nExecutePayload = {
  hrflowWorkflowId: number;
  executionId: number;
  nodes: Array<{
    id: number;
    name: string | null;
    kind: string;
    config?: Record<string, unknown> | null;
  }>;
  edges: Array<{
    id: number;
    from: number;
    to: number;
  }>;
  input: Record<string, unknown> | null;
};


export type N8nExecuteResult = {
  status: string;
  nodeCount: number;
  edgeCount: number;
  inputEcho: unknown;
  finishedAt: string;
  raw?: unknown;
}[];

export async function callN8nExecute(
  payload: N8nExecutePayload
): Promise<N8nExecuteResult> {
  let res: Response;

  try {
    res = await fetch(N8N_EXECUTE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // "X-API-Key": process.env.N8N_API_KEY ?? ""  // future
      },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    const error: any = new Error(
      `Failed to reach automation engine (n8n): ${
        err?.message ?? String(err)
      }`
    );
    error.code = "N8N_UNREACHABLE";
    throw error;
  }

  if (!res.ok) {
    const text = await res.text();
    const error: any = new Error(
      `n8n call failed (${res.status} ${res.statusText}): ${text}`
    );
    error.code = "N8N_HTTP_ERROR";
    throw error;
  }

  const data = (await res.json()) as N8nExecuteResult;
  return data;
}
