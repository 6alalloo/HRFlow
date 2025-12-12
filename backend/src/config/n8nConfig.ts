export const N8N_BASE_URL =
  process.env.N8N_BASE_URL ?? "http://localhost:5678";

export const N8N_HRFLOW_EXECUTE_PATH =
  process.env.N8N_HRFLOW_EXECUTE_PATH ?? "/webhook/hrflow/execute";

export const N8N_EXECUTE_URL = `${N8N_BASE_URL}${N8N_HRFLOW_EXECUTE_PATH}`;
