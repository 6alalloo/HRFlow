# HRFlow Comprehensive Testing Plan

## Overview

This document outlines the testing procedures to verify the "Day 1-6" implementation of HRFlow. It covers infrastructure, authentication, workflow building, CV parsing, and audit logging.

## Prerequisites

1.  **Environment**: Docker and Docker Compose installed.
2.  **State**: Application started via `docker-compose up -d`.
3.  **Data**: Database seeded (Admin/Operator users exist).

---

## Part 1: Infrastructure Verification

**Goal**: Ensure all 5 services are running and communicating.

| ID     | Test Case        | Steps                                                                                                                                                                                 | Expected Result                                                                                              | Status |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| INF-01 | Container Health | Run `docker-compose ps`                                                                                                                                                               | All 5 services (`backend`, `frontend`, `n8n`, `postgres`, `cv-parser`) are "Up" or "Running".                |        |
| INF-02 | Service Access   | Visit `http://localhost:80` (Frontend)<br>Visit `http://localhost:4000/api/health` (Backend)<br>Visit `http://localhost:5678` (n8n)<br>Visit `http://localhost:8000/docs` (CV Parser) | Frontend loads Login page.<br>Backend returns `OK`.<br>n8n setup/login loads.<br>CV Parser Swagger UI loads. |        |

---

## Part 2: Authentication & RBAC

**Goal**: Verify JWT implementation and Role-Based Access Control.

| ID      | Test Case        | Steps                                                                | Expected Result                                                                               | Status |
| ------- | ---------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| AUTH-01 | Admin Login      | Login with `admin@hrflow.local` / `admin123`.                        | Success. Redirect to Dashboard. Sidebar shows "Admin" badge (Red). "Audit Logs" link visible. |        |
| AUTH-02 | Operator Login   | Login with `operator@hrflow.local` / `operator123`.                  | Success. Sidebar shows "Operator" badge (Green). "Audit Logs" link **NOT** visible.           |        |
| AUTH-03 | Invalid Login    | Try random credentials.                                              | Error message "Invalid email or password".                                                    |        |
| AUTH-04 | Protected Route  | Log out. Try to visit `http://localhost/workflows` directly.         | Redirects to Login page.                                                                      |        |
| AUTH-05 | RBAC Enforcement | (As Operator) Try to access `http://localhost/admin/audit` manually. | Redirects to Dashboard or shows 403 Forbidden/Access Denied.                                  |        |

---

## Part 3: Workflow Builder & New Nodes

**Goal**: Verify the 4 new node types (CV Parse, Variable, Datetime, Logger) and compilation.

| ID     | Test Case       | Steps                                          | Expected Result                                                                     | Status |
| ------ | --------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| BLD-01 | Create Workflow | Click "Create Workflow".                       | New workflow created. Redirects to Builder. Canvas empty.                           |        |
| BLD-02 | CV Parse Node   | Drag "CV Parse" node to canvas. Open config.   | Form has "Input Type" (File/URL) and "Field Name". Saves correctly.                 |        |
| BLD-03 | Variable Node   | Drag "Variable" node. Open config.             | Form has "Variable Name" and "Value". Saves correctly.                              |        |
| BLD-04 | Datetime Node   | Drag "Datetime" node. Open config.             | Form has "Operation" (Format/Add/Subtract) and "Format". Saves correctly.           |        |
| BLD-05 | Logger Node     | Drag "Logger" node. Open config.               | Form has "Message", "Level", "Include Input". Saves correctly.                      |        |
| BLD-06 | Compilation     | Connect nodes: Trigger -> Logger. Click "Run". | "Saving..." -> "Running...". Workflow compiles without errors. Execution completes. |        |

---

## Part 4: CV Parser Service

**Goal**: Verify the Microservice is extracting text.

| ID    | Test Case        | Steps                                                                   | Expected Result                                               | Status |
| ----- | ---------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| CV-01 | Direct API Test  | Go to `http://localhost:8000/docs`. POST `/parse` with a sample PDF CV. | Returns JSON with `name`, `email`, `skills` populated.        |        |
| CV-02 | Integration Test | In Builder: Trigger -> CV Parse -> Logger. Run. Upload valid PDF.       | Logger output (in Execution Details) contains extracted data. |        |

---

## Part 5: Audit Logging

**Goal**: Verify security events are recorded.

| ID     | Test Case      | Steps                                          | Expected Result                                                                              | Status |
| ------ | -------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| AUD-01 | Log Generation | Perform: Login, Create Workflow, Run Workflow. | Events happen successfully.                                                                  |        |
| AUD-02 | Log Viewing    | Login as Admin. Go to "Audit Logs".            | Table lists recent events (User Login, Workflow Created, Workflow Executed) with timestamps. |        |
| AUD-03 | Log Details    | Click on a log row.                            | Expanded view shows `details` JSON (e.g., workflow ID, IP address).                          |        |

---

## Bug Report Format (Template)

If you encounter any issues, please use the following format for your report:

```markdown
### 🐛 Bug Report: [Short Description]

**ID**: [e.g., BUG-01]
**Affected Area**: [e.g., Frontend - Builder, Backend - Auth]
**Severity**: [Critical / High / Medium / Low]

**Description**:
What went wrong?

**Steps to Reproduce**:

1. Login as Admin...
2. Click on...
3. See error...

**Expected Behavior**:
[What should have happened]

**Actual Behavior**:
[What actually happened]

**Screenshots/Logs**:

- [Paste screenshot or docker logs here]
- API Response: `{"error": "..."}`
```
