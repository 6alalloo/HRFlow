# Implementation Plan - HRFlow Completion

## Goal Description

Complete the HRFlow project by implementing critical missing components: a Python FastAPI CV Parser, full JWT Authentication & RBAC, Workflow Templates, and Audit Logging. The work is divided into 4 sequential phases to manage complexity.

## Phase 1: Foundation & CV Parser

_Focus: Getting the new microservice running and integrated._

### 1. CV Parser Service (FastAPI)

- **[NEW] `cv-parser/`**: Initialize Python FastAPI project (poetry or pip).
- **[NEW] `cv-parser/main.py`**:
  - Endpoint: `POST /parse`
  - Logic: Accept PDF/DOCX, extract text (pypdf/python-docx), regex/NLP to find Name, Email, Skills.
  - Response: JSON `{ name, email, skills, experience, ... }`.
- **[NEW] `cv-parser/requirements.txt`**: `fastapi`, `uvicorn`, `python-multipart`, `pypdf`, `python-docx`.
- **[MODIFY] `backend/src/services/n8nCompiler.ts`**:
  - Add compilation logic for `cv_parse` node.
  - It should compile to an n8n HTTP Request node calling the internal `cv-parser` service.

### 2. Infrastructure

- **[NEW] `docker-compose.yml`**:
  - Orchestrate all services: `backend`, `frontend`, `cv-parser`, `n8n`, `postgres`, `mailpit`.

## Phase 2: Core Backend Features

_Focus: Security, Governance, and Data Integrity._

### 1. Authentication & RBAC (JWT)

- **[NEW] `backend/src/controllers/authController.ts`**:
  - `POST /login`: Validate credentials, return JWT.
  - `POST /me`: Return current user context.
- **[NEW] `backend/src/middleware/authMiddleware.ts`**:
  - Verify `Authorization: Bearer <token>`.
  - Decode JWT, attach `user` to request object.
  - Block 401 if invalid.
- **[MODIFY] `backend/src/routes/authRoutes.ts`**: New router for auth endpoints.
- **[MODIFY] `backend/src/services/userService.ts`**:
  - Ensure password hashing (`bcryptjs`) on user creation/updates.
- **[MODIFY] `backend/src/server.ts`**: Register auth routes and middleware.
- **[MODIFY] `frontend/src/api/auth.ts`**: Client-side auth handling (login, logout, token storage).

### 2. Audit & Governance

- **[NEW] `backend/src/services/auditService.ts`**:
  - Function `logEvent(userId, action, resource, details)`.
  - Writes to `audit_logs` table.
- **[MODIFY] `backend/src/services/executionService.ts`**:
  - Log execution start/complete/fail events.
- **[MODIFY] `backend/src/controllers/workflowController.ts`**:
  - Log workflow creation/modification events.
- **[NEW] `backend/src/services/allowListService.ts`**:
  - Manage allowed domains for HTTP nodes.
  - Block usage of non-allowed domains in `n8nCompiler`.

## Phase 3: Frontend Feature Completion

_Focus: Closing gaps in the UI and Builder._

### 1. Workflow Builder (`frontend/src/pages/Workflows/workflowBuilderPage.tsx`)

- [ ] **Refactor Config Panel**: Extract the giant config form logic into a separate `NodeConfigPanel.tsx` component.
- [ ] **Implement Missing Node Forms**:
  - **CV Parse**: File upload/URL input config.
  - **Condition**: Logic builder (simple Left/Op/Right form).
  - **Variable**: Key/Value setter form.
  - **Datetime**: Format/Operation selector.
- [ ] **Update Compiler**: Ensure `backend/src/services/n8nCompiler.ts` handles the config output from these new forms.
- [ ] **Duplicate Workflow**: Add "Duplicate" action to the workflow list.

### 2. Execution Dashboard (`frontend/src/pages/Executions/executionListPage.tsx`)

- [ ] **Stats Widget**: Add a summary row showing Total Executions, Success Rate (7-day), and Avg Duration.
- [ ] **Rerun Confirmation**: Add confirmation modal on the Execution Detail page.
- [ ] **Audit Viewer**: Create a simple frontend viewer at `/audit` for Admins.

## Phase 4: Templates & Verification

_Focus: User Experience and End-to-End Testing._

### 1. Workflow Templates & Seeding

- **[NEW] `backend/prisma/seed.ts`**: Robust seed script to generate:
  - **Roles**: Admin, Operator.
  - **Users**: `admin@hrflow.com` / `operator@hrflow.com`.
  - **Templates**:
    1.  **HR Onboarding**: Trigger -> HTTP (CV Parse) -> Email -> Database.
    2.  **IT Access Provisioning**: Trigger -> Approval (Simulated) -> Email.

### 2. Verification Plan

- **Automated Tests**:
  - Backend: `npm test` (Auth, Audit, CV Parser integration).
  - CV Parser: `pytest` in `cv-parser/`.
- **Manual Verification**:
  1.  **Full Flow**: Login -> Create Workflow (Template) -> Add CV Parse Node -> Configure -> Save -> Run -> Verify Output.
  2.  **Auth**: Try accessing `/api/workflows` without a token (should fail). Login and retry (should succeed).
  3.  **RBAC**: Login as 'Operator' and delete workflow (fail).
  4.  **Audit**: Check `audit_logs` table after actions.
  5.  **Dashboard**: Verify Stats Widget updates.
