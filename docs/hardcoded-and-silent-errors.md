# Hardcoded Values and Silent Errors Report
Scope: backend, frontend, cv-parser

## Hardcoded Values
- `backend/src/services/authService.ts:5` Hardcoded JWT secret fallback (`hrflow-jwt-secret-change-in-production`) is used if `JWT_SECRET` is not set; tokens become predictable.
- `backend/src/services/authService.ts:6` `JWT_EXPIRES_IN` is defined but not used, so configuration is ignored.
- `backend/src/services/authService.ts:49` Token expiry is hardcoded to `24h` even if `JWT_EXPIRES_IN` is set.
- `backend/src/config/n8nConfig.ts:9` Default `N8N_BASE_URL` points to `http://localhost:5678`.
- `backend/src/services/executionService.ts:128` `getWebhookBaseUrl()` falls back to `http://localhost:5678` when env is missing.
- `backend/src/services/cvParserService.ts:9` Default CV parser base URL is `http://localhost:8000`.
- `frontend/src/api/apiClient.ts:3` Default API base URL is `http://localhost:4000/api` when env is missing.
- `frontend/src/api/workflows.ts:3` Default API base URL is `http://localhost:4000/api` when env is missing.
- `frontend/src/contexts/AuthContext.tsx:4` Default API base URL is `http://localhost:4000/api` when env is missing.
- `frontend/src/api/executions.ts:2` Default API base URL is `http://localhost:4000` when env is missing.
- `frontend/src/pages/Workflows/components/RecentExecutions.tsx:29` Hardcoded `http://localhost:4000` request bypasses `VITE_API_BASE_URL`, so prod env is ignored.
- `backend/src/services/n8nCompiler.ts:435` HTTP node defaults to `https://httpbin.org/anything` if no URL is configured (risk of unintended external calls).
- `backend/src/services/n8nCompiler.ts:541` SQL template falls back to `demo.user@example.com` for email.
- `backend/src/services/n8nCompiler.ts:543` SQL template uses `TEMP_PASSWORD_HASH` placeholder (can create invalid credentials if not replaced).
- `backend/src/services/n8nCompiler.ts:575` SQL template again falls back to `demo.user@example.com` for email.
- `backend/src/services/n8nCompiler.ts:644` Hardcoded sender address `talal.hawaj@gmail.com`.
- `backend/src/controllers/workflowController.ts:118` Audit logging defaults to user id `1` if not authenticated (mis-attribution risk).
- `backend/src/controllers/workflowController.ts:274` Same audit fallback to user id `1`.
- `backend/src/controllers/workflowController.ts:322` Same audit fallback to user id `1`.
- `backend/src/controllers/workflowController.ts:631` Same audit fallback, even if owner is missing.
- `backend/src/controllers/workflowController.ts:679` Same audit fallback to user id `1`.
- `backend/src/controllers/executionController.ts:237` Audit logging defaults to user id `1`.
- `backend/src/services/executionService.ts:287` Audit logging defaults to user id `1`.
- `backend/src/services/executionService.ts:402` Audit logging defaults to user id `1`.
- `backend/src/services/fileUploadService.ts:66` File upload limit hardcoded to 10MB.
- `backend/src/services/fileUploadService.ts:80` File metadata expiry hardcoded to 24 hours.
- `backend/src/services/fileUploadService.ts:116` Filesystem fallback expiry hardcoded to 24 hours.

## Silent Errors
- `backend/src/middleware/authMiddleware.ts:70` `optionalAuth` ignores invalid tokens with no log or response.
- `backend/src/middleware/authMiddleware.ts:75` `optionalAuth` swallows unexpected errors and just calls `next()`, hiding failures.
- `backend/src/services/allowListService.ts:110` `removeDomainFromAllowList` returns false on delete errors without logging.
- `backend/src/services/fileUploadService.ts:167` `getFileBuffer` returns null on read failure without logging (read errors are indistinguishable from missing files).
- `backend/src/services/fileUploadService.ts:183` `deleteFile` returns false on delete errors without logging.
- `backend/src/services/cvParserService.ts:142` `isCVParserHealthy` returns false on any error without logging the cause.
- `backend/src/services/workflowService.ts:11` `safeParseJson` swallows JSON parse errors, so corrupted config or conditions can go unnoticed.
- `backend/src/services/executionService.ts:40` `safeParseJson` swallows JSON parse errors for node or edge config in execution flow.
- `frontend/src/contexts/AuthContext.tsx:40` Stored user JSON parse errors are ignored, silently clearing user state.
- `frontend/src/contexts/AuthContext.tsx:92` Token verification network errors are ignored; UI keeps current auth state with no warning.
- `frontend/src/api/executions.ts:140` run_context JSON parse errors are ignored; UI loses n8n output silently.
- `frontend/src/pages/Executions/executionDetailPage.tsx:225` Step input JSON parse errors are ignored; UI shows empty input silently.
- `frontend/src/pages/Executions/executionDetailPage.tsx:228` Step output JSON parse errors are ignored; UI shows empty output silently.
