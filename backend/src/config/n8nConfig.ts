// backend/src/config/n8nConfig.ts

/**
 * Base URL where n8n is reachable.
 * Examples:
 * - Local Docker: http://localhost:5678
 * - VM/host:      http://10.0.2.15:5678
 */
export const N8N_BASE_URL = (process.env.N8N_BASE_URL ?? "http://localhost:5678").replace(/\/$/, "");

/**
 * n8n REST API base (v1).
 * Docs: /api/v1/docs
 */
export const N8N_API_BASE_URL = `${N8N_BASE_URL}/api/v1`;

/**
 * API key for n8n v1 REST API.
 */
export const N8N_API_KEY = process.env.N8N_API_KEY ?? "";

/**
 * Base URL for calling webhooks.
 * Usually identical to N8N_BASE_URL, but split out for clarity/future proxying.
 */
export const N8N_WEBHOOK_BASE_URL = (process.env.N8N_WEBHOOK_BASE_URL ?? N8N_BASE_URL).replace(
  /\/$/,
  ""
);

/**
 * ✅ NEW (MVP demo path): unique webhook path per HRFlow workflow.
 * This avoids n8n "Conflicting Webhook Path" errors.
 */
export function buildHrflowWebhookPath(workflowId: number): string {
  return `/webhook/hrflow/${workflowId}/execute`;
}

export function buildHrflowWebhookUrl(workflowId: number): string {
  return `${N8N_WEBHOOK_BASE_URL}${buildHrflowWebhookPath(workflowId)}`;
}

/**
 * ⚠️ LEGACY (old design): single shared webhook path.
 * Keep it only if you still want the old "hrflow-execute" workflow around.
 */
export const N8N_HRFLOW_EXECUTE_PATH =
  process.env.N8N_HRFLOW_EXECUTE_PATH ?? "/webhook/hrflow/execute";

/**
 * ⚠️ LEGACY (old design): single shared webhook URL.
 */
export const N8N_EXECUTE_URL = `${N8N_WEBHOOK_BASE_URL}${N8N_HRFLOW_EXECUTE_PATH}`;
export const N8N_POSTGRES_CREDENTIAL_ID =
  process.env.N8N_POSTGRES_CREDENTIAL_ID ?? "";
export const N8N_POSTGRES_CREDENTIAL_NAME =
  process.env.N8N_POSTGRES_CREDENTIAL_NAME ?? "";

export const N8N_SMTP_CREDENTIAL_ID =
  process.env.N8N_SMTP_CREDENTIAL_ID ?? "";
export const N8N_SMTP_CREDENTIAL_NAME =
  process.env.N8N_SMTP_CREDENTIAL_NAME ?? "";
