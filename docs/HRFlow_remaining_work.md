# HRFlow — Remaining Work Checklist (Everything Left)

This is a  list of what’s still left to do for HRFlow, based on our plan and everything we’ve discussed building. It’s written to be used as a working checklist.

---



### 0.2 Fix n8n “undefined” user inserts
- **Symptom:** inserted user shows `full_name = 'undefined'`, `email = 'undefined'`.
- **Cause:** n8n expressions reading `$json.employee.*` while frontend sends `{ name, email }`.
- **Work to do:**
  - Standardize the execution input contract:
    - Either always send `{ employee: { name, email, ... } }`
    - Or update n8n query to support both nested + flat shapes (recommended).
  - Add basic validation in workflow execution:
    - if required values are missing, fail execution with a clear message (no DB write).


---

## 1) MVP / demo-ready checklist (must-have)

### 1.1 Backend: Workflows module (CRUD + graph)
- **Create workflow endpoint**
  - `POST /api/workflows`
  - Save: name, description, owner_user_id (optional for now), default_trigger, is_active, version.
  - Return created workflow in the same shape as list/detail expects.
- **List workflows**
  - `GET /api/workflows` with optional filters already planned:
    - `?active=true|false`
    - `?ownerId=...`
    - `?q=...`
  - Ensure response shape matches frontend normalization (ideally `{ data: [...] }`).
- **Get workflow by id**
  - `GET /api/workflows/:id`
- **Graph endpoints**
  - `GET /api/workflows/:id/graph` returns `{ workflow, nodes, edges }`
  - Confirm node/edge JSON parsing and consistent key naming (`pos_x/pos_y` vs `posX/posY`).
- **Archive/Unarchive workflows**
  - Decide MVP behavior:
    - Archive sets `archived_at = now()` and maybe `is_active=false`
    - Unarchive clears `archived_at`
  - Add endpoints if needed:
    - `PATCH /api/workflows/:id/archive`
    - `PATCH /api/workflows/:id/unarchive`

### 1.2 Backend: Nodes and edges (builder support)
- **Node CRUD**
  - `POST /api/workflows/:id/nodes`
  - `PUT /api/workflows/:id/nodes/:nodeId`
  - `PATCH /api/workflows/:id/nodes/:nodeId/position`
  - `DELETE /api/workflows/:id/nodes/:nodeId`
- **Edge CRUD**
  - `POST /api/workflows/:id/edges`
  - `PUT /api/workflows/:id/edges/:edgeId`
  - `DELETE /api/workflows/:id/edges/:edgeId`
- **Validation rules (MVP minimum)**
  - Ensure nodes used in edges belong to the same workflow.
  - Prevent self-loop if you don’t want it (optional).
  - Keep edge `priority` default consistent.

### 1.3 Backend: Executions module (end-to-end run)
- **Create execution from workflow run**
  - `POST /api/workflows/:id/execute`
  - Create `executions` row with:
    - workflow_id, trigger_type, status=running, started_at
    - run_context (JSON string), optional error_message
  - Create `execution_steps` rows:
    - one per node, with per-step status + logs
- **Update execution status reliably**
  - Ensure an execution always ends as one of:
    - `completed`, `failed`, `engine_error`
  - Always set `finished_at` + `duration_ms` when leaving running.
- **Execution query endpoints**
  - `GET /api/executions` (list, filters + pagination if needed)
  - `GET /api/executions/:id`
  - `GET /api/executions/:id/steps`
  - `GET /api/workflows/:id/executions`
- **Stability + idempotency**
  - Prevent double-creating executions from rapid double-click:
    - UI disable + backend safeguard (optional).
  - Make sure errors from n8n or DB fail cleanly.

### 1.4 n8n integration (MVP “real” execution)
- **Compile HRFlow graph to n8n workflow**
  - Implement/finish compiler rules for the MVP node set.
  - Store mapping in DB:
    - `workflows.n8n_workflow_id`
    - `workflows.n8n_webhook_path`
- **Upsert workflow to n8n**
  - Create/update n8n workflow definition
  - Activate workflow if needed
- **Execute workflow**
  - Trigger n8n webhook with run_context input
  - Store response body (or summary) into:
    - `execution_steps.output_json` for relevant step(s)
    - optional `executions.run_context` enrichment
- **Error propagation**
  - If n8n fails:
    - set `executions.status = engine_error` (or failed)
    - store a human-readable `error_message`
    - store raw n8n error in step logs (keep it short)


**Work to do:**
- Define the canonical config shape for each node kind (frontend + backend + compiler).
- Confirm compile and execution behavior for each node kind.
- Provide 2–3 seed workflows that showcase the nodes clearly.

### 1.6 Frontend: Workflows list (polish + create workflow)
- **Create workflow UI**
  - Add “Create workflow” button (already visible).
  - Implement create modal or inline form:
    - name (required), description (optional)
  - On success:
    - navigate to `/workflows/:id/builder`
- **Error handling**
  - Show backend error message when possible (not only “try again”).
- **Refresh workflows list**
  - After creating, refresh list or optimistic add.

### 1.7 Frontend: Builder (React Flow canvas)
- **Core canvas**
  - Load graph from `/workflows/:id/graph`
  - Render nodes + edges
  - Drag nodes and persist position
- **Create/edit/delete nodes**
  - Node palette (add node)
  - Node config panel
  - Save changes to backend
- **Connect edges**
  - Create edge on connect
  - Remove edge on delete
  - Optional: edit edge label/condition
- **Validation UX**
  - Show “missing trigger”, “disconnected nodes”, etc. (minimal warnings are fine for demo)

### 1.8 Frontend: Executions pages
- **Executions list**
  - Filters: status, workflowId
  - Pagination (include “type page number” UX)
- **Execution detail**
  - Show execution meta: status, duration, timestamps, error
  - Show steps table with per-step status + logs + input/output JSON
- **Deep link reliability**
  - `navigate(`/executions/${id}`)` should always load.

### 1.9 Demo data + seeding (must exist before demo)
- **Seed workflows**
  - 5–10 workflows with realistic HR names/descriptions
  - 3–7 nodes each, with edges
- **Seed users + roles**
  - Ensure a demo user exists and is clean
  - Ensure roles exist (Admin/Employee/etc.) even if auth is postponed
- **Demo database reset script**
  - One command/script to reset DB to demo-ready state.

### 1.10 Observability + debugging (demo-friendly)
- **Structured logs**
  - Log request id, workflow id, execution id
- **Expose a simple health endpoint**
  - `/api/health`
- **Make errors visible**
  - Backend returns `{ message }` consistently
  - Frontend shows meaningful message in UI for demo

---

## 2) Post-MVP but already in our plan (next after demo)

### 2.1 Auth and permissions (explicitly postponed but planned)
- JWT or session auth
- Protect routes (frontend + backend)
- Attach `owner_user_id` from authenticated user
- Role-based access (RBAC)
- Audit auth events (login/logout/token refresh)

### 2.2 Real workflow runtime engine (beyond “n8n webhook trigger”)
- Execution orchestration rules:
  - partial success, skip logic
- Step-level retries with capped attempts
- Better step status model:
  - queued, running, completed, failed, skipped
- Concurrency controls
- Idempotency keys for webhooks

### 2.3 CV Parser microservice integration (planned)
- FastAPI CV parser endpoint integration
- Node kind `cv_parse` with:
  - file upload or URL
  - structured output (name, skills, experience)
- Store parsed results in DB (employees/candidates tables)
- Error handling for invalid files / unsupported formats

### 2.4 Workflow builder upgrades (product-level)
- Node templates and presets
- Config schema validation per node type
- Copy/paste nodes, multi-select, alignment tools
- Versioning:
  - bump workflow version on publish
  - draft vs published states
- Workflow diff and rollback
- “Publish” workflow action (only published versions can run)

### 2.5 Triggers and webhooks (beyond manual)
- Scheduled triggers (cron)
- Incoming webhook triggers with signature validation
- Email-based triggers (inbound mailbox)
- Event triggers (DB change streams, etc.)

### 2.6 Data stores / variables / state
- Data store nodes (KV store per workflow/execution)
- Variable node execution semantics
- Context propagation across nodes
- Secrets management for credentials (API keys, SMTP creds)

### 2.7 Notifications and audit trail
- Central audit log:
  - workflow created/updated/published
  - execution started/finished
  - user created/updated
- Notifications:
  - execution failed alerts (email/in-app)
  - scheduled run outcomes

### 2.8 Production readiness
- Docker Compose for backend + frontend + Postgres + n8n
- Environment configuration management
- CI checks (lint, typecheck, test)
- Basic automated tests (services + API integration tests)
- Security hardening:
  - input validation
  - rate limiting
  - CORS locked down
  - sensitive logging redaction
- Monitoring (metrics + error tracking)

---

## 3) UX polish and quality items (nice-to-have)

### 3.1 UI polish
- Better empty states (“no workflows”, “no executions”, “no steps”)
- Toast notifications for success/failure
- Loading skeletons
- Table improvements (truncate long descriptions, tooltip)

### 3.2 Better developer tooling
- Seed command: `npm run db:seed`
- Reset command: `npm run db:reset`
- One command for full local stack (compose up)

### 3.3 Demo script and walkthrough assets
- A short “demo story”:
  1) show workflow list
  2) create workflow → builder
  3) run workflow with input JSON
  4) show executions list
  5) open execution details + steps
  6) show DB row added (user/employee inserted)
- Screenshots / short video backup if live demo fails

---
```

---

## 5) Definition of “demo ready”
You’re demo ready when you can reliably do this end-to-end:
- Create a workflow from the UI (no 500s)
- Open it in the builder and edit nodes/edges
- Run it with input JSON
- See a completed execution with steps + logs
- Prove a DB write happened (user/employee row inserted)
- Show n8n was involved (workflow id stored + webhook call succeeded)
