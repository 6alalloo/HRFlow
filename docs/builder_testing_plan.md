# HRFlow Builder Testing Plan

## Purpose

Validate the workflow builder end-to-end: UX, API persistence, compilation to n8n, execution results, and operational quality. This plan is builder-only and maps to requirements in `docs/202201761_Plan.md` (builder CRUD, 8+ nodes, compile to n8n JSON, execution within SLA, usability time-to-complete).

## References

- `docs/202201761_Plan.md` (core builder scope, compile/runtime, UX/time targets)
- `docs/testing_plan.md` (existing builder test coverage gaps)
- `docs/builder-ui-overhaul.md` (ghost nodes, node picker, auto-layout intent)
- `docs/completion_plan.md` and `docs/implementation_plan.md` (node config + workflow ops)
- Code: `frontend/src/pages/Workflows/workflowBuilderPage.tsx`, `frontend/src/components/builder/*`, `backend/src/services/n8nCompiler.ts`, `backend/src/services/executionService.ts`

## Scope

In scope:
- Builder canvas, ghost nodes, node picker, config panel, selection, layout, drag, connect, delete.
- Node config UX and validation for all node kinds.
- Persistence: workflow graph, nodes, edges, positions, rename, template apply.
- Compilation to n8n and execution from builder.
- Execution results (status, steps, logs) relevant to builder.

Out of scope:
- Dashboard metrics outside builder.
- Admin audit log UI (only verify events emitted).
- Non-builder template cards outside builder.

## Environment & Prerequisites

Services (local Docker or equivalent):
- Postgres, Backend, Frontend, n8n, CV Parser

Required backend env:
- `N8N_API_KEY`
- `N8N_POSTGRES_CREDENTIAL_ID` / `N8N_POSTGRES_CREDENTIAL_NAME`
- `N8N_SMTP_CREDENTIAL_ID` / `N8N_SMTP_CREDENTIAL_NAME`
- `N8N_WEBHOOK_BASE_URL`

Seed data:
- Admin user and operator user (per `docs/testing_plan.md`).
- At least one workflow to open, plus ability to create new workflows.

Allow-list:
- Ensure at least one allowed domain for HTTP node tests (e.g., `httpbin.org`).

## Test Data

Suggested payloads:
- Trigger (employee):
  - Name: Sara Ali
  - Email: sara@company.com
  - Department: Engineering
  - Role: Developer
  - Start Date: 2025-12-21
  - Manager Email: manager@company.com

HTTP endpoints:
- Allowed: `https://httpbin.org/anything`
- Blocked: `https://blocked-domain.example`

CV files:
- One PDF CV (small, <5MB)
- One DOCX CV (small, <5MB)

## Builder Test Phases

### Phase 1: Entry, Load, and Basic UX

- Open workflow builder from list page.
- Verify loading and empty-state behaviors:
  - Empty workflow shows a Ghost Node at start.
  - Existing workflow renders nodes and edges with correct positions.
- Verify header elements:
  - Workflow name editable (rename persists).
  - Webhook URL visible and copyable.
  - Save state indicator reflects background saves.

Pass criteria:
- No JS errors; initial fit view runs once; UI remains responsive.

### Phase 2: Canvas Operations & Flow Building

- Add node via Ghost Node (picker opens, node appears).
- Add several nodes in sequence (Trigger → Email → Logger).
- Create edges by dragging handles between nodes.
- Delete node via ConfigPanel and ensure edges removed.
- Move nodes and verify positions persist after refresh.
- Validate ghost nodes appear only on leaf nodes.

Pass criteria:
- Nodes/edges are persisted; graph reloads without loss.

### Phase 3: Config Panel Coverage (All Node Kinds)

Test every node kind: Trigger, HTTP, Email, Database, Condition, Variable, Logger, DateTime, CV Parser, Wait.

For each:
- Fill all fields with valid data.
- Save and reopen to confirm persistence.
- Validate help text and dynamic hints (variables, tips).
- Verify keyboard shortcuts (Esc, Ctrl+S, Ctrl+Enter).

Node-specific expectations:
- Trigger: fields stored in config and used for run input.
- HTTP: headers, URL, body are stored; non-allowlisted URL triggers compile error.
- Database: operation and fields recorded; verify compiler behavior for default query.
- Condition: operator-driven input visibility; branching labels expected.
- Variable: key/value list stored and shown in "available variables".
- DateTime: operation + outputField stored; output hint uses node name.
- CV Parser: selected fields list stored.
- Wait: duration/unit stored.
- Logger: message/level stored.

Pass criteria:
- Config values survive reload, and are reflected in `GET /api/workflows/:id/graph`.

### Phase 4: Backend API Persistence

Validate builder API calls:
- `GET /api/workflows/:id/graph`
- `POST /api/workflows/:id/nodes`
- `PUT /api/workflows/:id/nodes/:nodeId`
- `PATCH /api/workflows/:id/nodes/:nodeId/position`
- `POST /api/workflows/:id/edges`
- `DELETE /api/workflows/:id/nodes/:nodeId`
- `DELETE /api/workflows/:id/edges/:edgeId`
- `PATCH /api/workflows/:id` (rename)

Pass criteria:
- All calls succeed with correct response shapes; failures surface in UI.

### Phase 5: Compiler & n8n Integration

Validate compile and n8n activation:
- Run workflow from builder (requires active workflow).
- Confirm compile output includes webhook node and correct connections.
- Confirm n8n workflow is created/updated and activated.
- Validate allow-list enforcement on HTTP and CV URL inputs.

Pass criteria:
- Compilation errors show clear UI alert; successful compile triggers n8n execution.
- Compile time target: ≤5s (per `docs/202201761_Plan.md`).

### Phase 6: Execution Results & Logs

- Run with populated Trigger config.
- Verify execution status transitions to completed or failed.
- Confirm execution steps created for each node.
- Validate `run_context` includes webhook details and n8n result.
- Confirm audit logs include workflow updates and execution events.

Pass criteria:
- Execution detail page shows expected nodes and logs.

### Phase 7: Error Handling & Recovery

- n8n down/unreachable: run should return engine_error with clear message.
- Missing N8N credentials: compile should fail with actionable error.
- CV parser down: cv_parse node execution should fail; check execution status.
- Invalid URL: allow-list blocks and error logs include node ID.

Pass criteria:
- Errors are surfaced without leaving UI in a broken state; retry works after recovery.

### Phase 8: Usability & Performance

- Non-technical flow test: build 4-node workflow in ≤10 minutes.
- Load time: builder initial load <1s (target).
- Large workflow (20 nodes): canvas remains responsive; pan/zoom smooth.
- Save feedback is timely (no prolonged “Saving...”).

Pass criteria:
- Meets time-to-build and responsiveness targets in `docs/202201761_Plan.md`.

## Node Config ↔ Compiler Mapping Risks (Verify)

The current UI config keys do not perfectly align with the compiler expectations. Validate and document:
- HTTP: UI stores `headers` as key/value array and `body`, compiler expects object/string `headers` and `bodyTemplate`.
- Database: UI stores `operation/table/fields`, compiler expects `query`.
- Variable: UI stores `variables[]`, compiler expects `variableName` + `value`.
- DateTime: UI stores `value`, compiler expects `amount`.
- CV Parser: UI uses `cv_parser` kind, compiler expects `cv_parse`.

These are likely sources of execution mismatch. Capture evidence and decide whether to fix or adapt the compiler/UI.

## Reporting

For each run:
- Note environment, commit SHA, and seed data used.
- Record pass/fail per phase and per node type.
- File issues in the refinement plan with exact steps, expected vs actual, and logs.

## Potential Improvements to Evaluate During Testing

- Edge label UI for condition true/false branches.
- Config validation errors surfaced inline before save/run.
- Better “Saved” indicator for rename and config changes.
- Align UI config keys with compiler expectations (especially HTTP/Database/Variable/DateTime/CV Parser).
- CV parser config should reflect `inputType` (file vs URL) in UI if needed by compiler.
- HTTP headers should serialize to the format expected by compiler.

