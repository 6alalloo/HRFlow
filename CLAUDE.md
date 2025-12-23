# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HRFlow is a visual workflow automation platform for HR processes. It provides a drag-and-drop interface to build workflows that compile to and execute via n8n (an open-source workflow automation engine). Users create workflows visually (e.g., employee onboarding), and the system translates them into n8n workflows for execution.

**Key Architecture**: HRFlow acts as a meta-workflow engine - it doesn't execute workflows directly. Instead, it:
1. Maintains visual workflow graphs in its PostgreSQL database
2. Compiles graphs to n8n workflow JSON format on-demand via the n8nCompiler
3. Delegates execution to n8n via unique webhooks per workflow
4. Tracks execution state and results in its own database

## Development Commands

### Running with Docker (Recommended)

```bash
# Development mode (automatic - uses docker-compose.override.yml)
docker-compose up

# Or run in detached mode
docker-compose up -d

# Production mode (for testing prod configuration)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up

# Stop services (keeps data)
docker-compose down

# Reset database (when volumes get corrupted)
docker-compose down -v && docker-compose up -d

# View logs
docker-compose logs -f
docker logs -f hrflow-backend
docker logs -f hrflow-postgres
```

**Docker Configuration Files**:
- `docker-compose.yml` - Base configuration (shared by dev and prod)
- `docker-compose.override.yml` - Development overrides (auto-loaded)
- `docker-compose.prod.yml` - Production overrides (use explicitly)

### Running Locally (Without Docker)

```bash
# Run both frontend and backend concurrently (from root)
npm run dev

# Run backend only
cd backend && npm run dev

# Run frontend only
cd frontend && npm run dev
```

### Backend (Express + TypeScript)
- **Dev server**: `npm run dev` (uses ts-node-dev with hot reload on port 4000)
- **Test**: Not configured (shows error)

### Frontend (React + Vite)
- **Dev server**: `npm run dev` (Vite dev server with HMR)
- **Build**: `npm run build` (TypeScript check + Vite build to `dist/`)
- **Lint**: `npm run lint` (ESLint)
- **Preview**: `npm run preview` (preview production build)

### Database (Prisma)

```bash
cd backend

# Generate Prisma client (run after schema changes)
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Environment Setup

All environment variables are managed through centralized configuration modules:
- **Backend:** [backend/src/config/appConfig.ts](backend/src/config/appConfig.ts)
- **Frontend:** [frontend/src/config/appConfig.ts](frontend/src/config/appConfig.ts)

The application will fail to start with clear error messages if required environment variables are missing.

### Environment Variables Reference

#### Required Variables (Backend)
These MUST be set or the application will not start:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://hrflow:hrflow123@localhost:5432/HRFlow?schema=Core` |
| `JWT_SECRET` | Secret for JWT token signing | Generate with: `openssl rand -base64 32` |
| `N8N_API_KEY` | n8n API key from n8n UI (Settings > API) | `n8n_api_abc123...` |

#### Optional Variables (Backend)
These have sensible defaults for local development:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `N8N_BASE_URL` | `http://localhost:5678` | n8n base URL |
| `N8N_WEBHOOK_BASE_URL` | Same as `N8N_BASE_URL` | n8n webhook URL (for external access) |
| `N8N_POSTGRES_CREDENTIAL_ID` | `""` | PostgreSQL credential ID in n8n |
| `N8N_POSTGRES_CREDENTIAL_NAME` | `""` | PostgreSQL credential name in n8n |
| `N8N_SMTP_CREDENTIAL_ID` | `""` | SMTP credential ID in n8n |
| `N8N_SMTP_CREDENTIAL_NAME` | `""` | SMTP credential name in n8n |
| `CV_PARSER_URL` | `http://localhost:8000` | CV parser service URL |
| `JWT_EXPIRES_IN` | `24h` | JWT token expiration time |
| `DEFAULT_EMAIL_SENDER` | `noreply@hrflow.local` | Default sender for n8n email templates |
| `DEFAULT_EMAIL_RECIPIENT` | `demo@example.com` | Default recipient for demo workflows |

#### Frontend Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Production only | Backend API base URL (e.g., `http://localhost:4000/api`) |

**Note:** In development, `VITE_API_BASE_URL` defaults to `http://localhost:4000/api`.

### File Upload Configuration
File upload limits are configured as constants in code (not environment variables):
- **Max Size:** 10MB (see `FILE_UPLOAD_CONFIG` in [backend/src/services/fileUploadService.ts](backend/src/services/fileUploadService.ts))
- **Expiry:** 24 hours (temporary file cleanup policy)

### Setup Instructions

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Generate JWT secret:**
   ```bash
   openssl rand -base64 32
   ```
   Add to `.env` as `JWT_SECRET=<generated-value>`

3. **Start n8n and create credentials:**
   - Start n8n: `docker-compose up n8n -d`
   - Access UI: http://localhost:5678
   - Create PostgreSQL credential, copy ID to `N8N_POSTGRES_CREDENTIAL_ID`
   - Create SMTP credential, copy ID to `N8N_SMTP_CREDENTIAL_ID`
   - Generate API key in Settings > API, copy to `N8N_API_KEY`

4. **Start all services:**
   ```bash
   docker-compose up -d
   ```

**Critical**: n8n must be running with configured PostgreSQL and SMTP credentials before testing workflow execution.

## Code Architecture

### Backend Structure

```
backend/
├── src/
│   ├── server.ts                     # Entry point, starts Express on port 4000
│   ├── app.ts                        # Express app config (CORS, JSON parser, routes)
│   ├── lib/prisma.ts                 # Prisma client singleton
│   ├── routes/
│   │   ├── index.ts                  # Main router, mounts sub-routes under /api
│   │   ├── workflowRoutes.ts         # Workflow & execution endpoints
│   │   ├── executionRoutes.ts        # Execution-specific endpoints
│   │   └── userRoutes.ts, roleRoutes.ts
│   ├── controllers/
│   │   ├── workflowController.ts     # HTTP handlers for workflows
│   │   └── executionController.ts    # HTTP handlers for executions
│   ├── services/
│   │   ├── workflowService.ts        # Workflow CRUD (nodes, edges, graphs)
│   │   ├── executionService.ts       # CRITICAL: Orchestrates compile→execute flow
│   │   ├── n8nCompiler.ts            # CRITICAL: HRFlow graph → n8n JSON compiler
│   │   └── n8nService.ts             # n8n REST API client
│   └── config/
│       └── n8nConfig.ts              # n8n configuration & credential helpers
├── prisma/
│   └── schema.prisma                 # Database schema (workflows, nodes, edges, executions)
└── package.json
```

**Critical Service: n8nCompiler.ts**
This is the core innovation. The `compileToN8n()` function translates HRFlow's simplified node types into n8n's complex workflow format:
- **trigger** → n8n NoOp node
- **http** → n8n HTTP Request node (with headers, body, method)
- **email** → n8n Email Send node (with SMTP credentials from n8nConfig)
- **database** → n8n Postgres node (with SQL query + credentials)
- **logger** → n8n Code node (with console.log)
- **condition** → Handled via edge routing (true/false branches)

Each workflow gets a unique webhook trigger at `/webhook/hrflow/{workflowId}/execute` to avoid path conflicts.

**Critical Service: executionService.ts**
The `executeWorkflow()` function orchestrates the full execution lifecycle:
1. Validate workflow exists and is active
2. Create execution record (status: "running")
3. Compile workflow to n8n format via `compileToN8n()`
4. Upsert compiled workflow to n8n (by name, idempotent)
5. Activate workflow in n8n (registers webhook)
6. Call webhook to trigger execution
7. Update execution record with result (status: "completed"/"failed"/"engine_error")
8. Create execution_steps records for tracking

### Frontend Structure

```
frontend/
├── src/
│   ├── main.tsx                      # Entry point, wraps app in BrowserRouter
│   ├── App.tsx                       # Main component with routing
│   ├── pages/
│   │   ├── Workflows/
│   │   │   ├── workflowListPage.tsx      # List workflows, search, filter, run modal
│   │   │   ├── workflowBuilderPage.tsx   # CRITICAL: Visual workflow editor
│   │   │   └── workflowDetailPage.tsx    # Workflow metadata view
│   │   └── Executions/
│   │       ├── executionListPage.tsx     # List all executions
│   │       └── executionDetailPage.tsx   # Execution details + steps
│   ├── components/
│   │   └── HRFlowNode.tsx            # Custom ReactFlow node component
│   ├── layout/
│   │   ├── appLayout.tsx             # Layout wrapper (sidebar + header)
│   │   └── sidebar.tsx               # Navigation sidebar
│   └── api/
│       ├── workflows.ts              # Workflow API client
│       └── executions.ts             # Execution API client
└── package.json
```

**Critical Component: workflowBuilderPage.tsx**
The visual workflow editor built with ReactFlow:
- **3-panel layout**: Node palette (left) | Canvas (center) | Config panel (right)
- **Custom nodes**: `HRFlowNode` component shows type, ID, name, config preview
- **Custom edges**: `DeletableEdge` with delete button
- **Autosave**: All changes (node config, position, connections) immediately persisted
- **Config normalization**: Converts UI-friendly forms → compiler-friendly JSON
- **Node types**: trigger, http, email, database, condition, variable, logger, datetime, cv_parse

### Database Schema (Prisma)

**Key Models**:
- **workflows**: Workflow metadata, `n8n_workflow_id`, `n8n_webhook_path`
- **workflow_nodes**: Nodes with `kind`, `config_json`, `pos_x`, `pos_y`
- **workflow_edges**: Connections with `from_node_id`, `to_node_id`, `condition_json`
- **executions**: Execution records with `status`, `run_context` (includes n8n result)
- **execution_steps**: Per-node execution tracking

**Schema location**: `backend/prisma/schema.prisma`
**Database**: PostgreSQL with schema name "Core"

## Critical Workflows

### Workflow Execution Flow
When user clicks "Run" in the builder:
1. Frontend: `POST /api/workflows/:id/execute { triggerType: "manual", input: {...} }`
2. Backend: `executionService.executeWorkflow()`
3. Create execution record (status: "running")
4. **Compile**: `compileToN8n()` translates HRFlow graph → n8n JSON
5. **Upsert**: Create/update workflow in n8n by name
6. **Activate**: Enable webhook in n8n
7. **Execute**: POST to webhook URL with input data
8. **Track**: Update execution status, store n8n result in `run_context`
9. **Steps**: Create execution_steps for each node

**Data flow**: HRFlow DB → Compiler → n8n API → n8n Webhook → n8n Execution → HRFlow DB (result)

### Node Configuration Flow
When user edits a node in the builder:
1. User modifies config in right panel (e.g., HTTP URL field)
2. `updateSelectedNodeConfig()` normalizes config (text → JSON objects)
3. Local React state updated (nodes array)
4. ReactFlow state updated (rfNodes array)
5. `PUT /api/workflows/:id/nodes/:nodeId` persists to database
6. Autosave indicator shows "Saving..." → "All changes saved"

## Important Patterns

### Webhook-per-Workflow Pattern
Each workflow gets a unique webhook path: `/webhook/hrflow/{workflowId}/execute`
- Prevents n8n's "conflicting webhook" errors
- Enables independent workflow activation/deactivation
- Stored in `workflows.n8n_webhook_path` for stable references

### Optimistic UI Updates
The builder uses optimistic updates for instant feedback:
- Add node → shows immediately, saves in background
- Connect nodes → edge appears instantly, validates async
- Move node → position updates live, persists on drag stop

### Config Normalization
The builder separates UI, storage, and compiler formats:
- **UI**: Text areas for headers, body, field mappings (user-friendly)
- **Storage**: JSON objects in `config_json` (flexible)
- **Compiler**: Specific formats for n8n (SQL queries, parameter objects)

### Dual Database Pattern
- **HRFlow DB**: Workflow definitions, execution metadata, HR data
- **n8n DB**: Compiled workflows, active webhooks, execution logs
- **Sync**: `n8n_workflow_id` links the two systems

## Testing Workflow Execution

Before testing execution, ensure:
1. PostgreSQL running on `localhost:5432` with "HRFlow" database
2. n8n running on `localhost:5678` (start with `n8n start`)
3. n8n API key configured in `backend/.env`
4. PostgreSQL credential created in n8n (ID in `N8N_POSTGRES_CREDENTIAL_ID`)
5. SMTP credential created in n8n (ID in `N8N_SMTP_CREDENTIAL_ID`)

**To test**:
1. Create workflow in UI
2. Add nodes (trigger, database, email, logger)
3. Connect nodes with edges
4. Configure each node (database table, email recipient, etc.)
5. Click "Run" button
6. Check execution status in Executions page
7. Verify n8n execution: `GET http://localhost:5678/api/v1/executions`

## Common Gotchas

1. **n8n credentials**: If execution fails with "credential not found", ensure the credential IDs in `.env` match credentials in n8n UI
2. **Webhook conflicts**: If n8n returns "webhook path already exists", check `workflows.n8n_webhook_path` for duplicates
3. **Compilation errors**: If compiled workflow is invalid, check node `config_json` format matches expected structure in `n8nCompiler.ts`
4. **Autosave race conditions**: The builder uses a `pendingSaves` counter to track async saves - don't navigate away while "Saving..." is visible
5. **ReactFlow node positions**: `pos_x` and `pos_y` are canvas coordinates, not screen coordinates - use `project()` helper when adding nodes
6. **n8n connection strings**: Connections in n8n are complex objects with sourceNodeId, targetNodeId, and connection indices - see `compileToN8n()` for mapping logic

## File References by Task

**Add new workflow node type**:
- `backend/src/services/n8nCompiler.ts` - Add compilation logic
- `frontend/src/pages/Workflows/workflowBuilderPage.tsx` - Add to node palette, add config form

**Modify workflow execution flow**:
- `backend/src/services/executionService.ts` - Orchestration logic
- `backend/src/services/n8nService.ts` - n8n API calls

**Change database schema**:
- `backend/prisma/schema.prisma` - Update models
- Run `npx prisma migrate dev --name description`
- Run `npx prisma generate` to update client

**Update workflow builder UI**:
- `frontend/src/pages/Workflows/workflowBuilderPage.tsx` - Main editor
- `frontend/src/components/HRFlowNode.tsx` - Node appearance
- `frontend/src/api/workflows.ts` - API calls

**Debug execution issues**:
- Check `executions.run_context` in database for n8n result
- Check `executions.error_message` for failure details
- Check n8n UI for execution logs: `http://localhost:5678/executions`
- Check backend console for compilation output (n8nCompiler logs)
