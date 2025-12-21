# Project Completion Plan & Implementation Strategy

**Version:** 2.0
**Date:** December 20, 2025
**Reference:** Project Plan v7.0 (`docs/202201761_Plan.md`)

## 1. Executive Summary

This document outlines the remaining work required to bring the HRFlow platform to 100% compliance with the "Business Centric Workflow Automation Platform" Project Plan. Based on a comprehensive gap analysis, the core infrastructure is sound, but several "functional" and "governance" features required for the MVP are functionally incomplete or missing from the UI.

The primary focus of this completion phase is **Interactive Configuration** (making nodes actually configurable), **Templates** (demonstrating use cases), **Governance** (Admin tools), and **Integration Verification** (end-to-end testing).

---

## 2. Gap Analysis & Requirements

### 2.1 Primary Gaps (Identified)

| Priority   | Feature Area           | Missing / Incomplete Item                                                                       | Requirement Ref |
| :--------- | :--------------------- | :---------------------------------------------------------------------------------------------- | :-------------- |
| **High**   | **Node Configuration** | Missing config forms for: HTTP, Database, Condition, CV Parser, Wait, Script, Logger, DateTime. | F2, N11         |
| **High**   | **Templates**          | Logic to instantiate "HR Onboarding" & "IT Access" workflows.                                   | F11, F12        |
| **High**   | **Missing Nodes**      | "Variable" node missing from picker. "Attach Parsed Data" logic.                                | F2, F15         |
| **Medium** | **Governance UI**      | Admin UI to manage HTTP Allow-list.                                                             | F18, N15        |
| **Medium** | **Audit Tools**        | Export Logs (CSV/JSON) and Purge Logs (>90 days) actions.                                       | F19, N8         |

### 2.2 Secondary Gaps (Previously Unidentified)

| Priority   | Feature Area            | Missing / Incomplete Item                              | Requirement Ref |
| :--------- | :---------------------- | :----------------------------------------------------- | :-------------- |
| **Medium** | **Workflow Operations** | Duplicate workflow functionality                       | F4              |
| **Medium** | **Execution UX**        | Rerun confirmation modal before re-executing workflows | F7              |
| **Medium** | **Webhook Display**     | Show unique webhook URL per workflow in builder UI     | F6              |
| **Low**    | **Dashboard Refresh**   | KPIs should refresh every ≤5 minutes during active use | N14             |
| **High**   | **Security**            | Password rate-limiting (≤5 attempts/min)               | N7              |
| **Medium** | **Error Handling**      | User-friendly error messages for failed executions     | N13             |
| **Medium** | **Form Validation**     | Inline validation on all configuration forms           | N11             |

---

## 3. Implementation Plans

### Feature A: Comprehensive Node Configuration (The "Builder" Fix)

**Objective:** Replace "Coming Soon" placeholders in `ConfigPanel.tsx` with actual forms that write to the node's `config` JSON.

**Current State:** Only `trigger` and `email` nodes have configuration forms. All others show "Coming Soon".

#### Implementation Steps:

1.  **Define Config Types:** Create TypeScript interfaces in `frontend/src/types/nodeConfigs.ts`:

    ```typescript
    interface HttpNodeConfig {
      method: "GET" | "POST" | "PUT" | "DELETE";
      url: string;
      headers: Record<string, string>;
      body?: string;
    }

    interface DatabaseNodeConfig {
      operation: "create" | "update" | "query";
      table: string;
      data: Record<string, any>;
      whereClause?: string;
    }

    interface ConditionNodeConfig {
      field: string;
      operator:
        | "equals"
        | "not_equals"
        | "contains"
        | "greater_than"
        | "less_than";
      value: string;
    }

    interface CvParserNodeConfig {
      fileSource: string; // Variable reference like {{trigger.cvFile}}
      extractFields: ("name" | "email" | "phone" | "skills" | "experience")[];
    }

    interface WaitNodeConfig {
      duration: number;
      unit: "seconds" | "minutes" | "hours";
    }

    interface ScriptNodeConfig {
      code: string;
      language: "javascript";
    }

    interface LoggerNodeConfig {
      message: string;
      level: "info" | "warn" | "error";
    }

    interface DateTimeNodeConfig {
      operation: "add" | "subtract" | "format" | "now";
      value?: number;
      unit?: "days" | "hours" | "minutes";
      format?: string;
    }

    interface VariableNodeConfig {
      variables: { key: string; value: string }[];
    }
    ```

2.  **Update ConfigPanel.tsx with Forms:**

    | Node Type     | Form Fields                                                                                     |
    | ------------- | ----------------------------------------------------------------------------------------------- |
    | **HTTP**      | Method selector (GET/POST/PUT/DELETE), URL input, Headers editor (key-value pairs), Body editor |
    | **Condition** | Field input, Operator dropdown (equals/contains/greater_than/etc.), Value input                 |
    | **Database**  | Operation selector (Create/Update/Query), Table input, Data JSON editor, Where clause           |
    | **CV Parser** | File Source variable picker, Field checkboxes (name/email/phone/skills/experience)              |
    | **Wait**      | Duration number input, Unit selector (seconds/minutes/hours)                                    |
    | **Script**    | Code editor (textarea with monospace font), Language indicator                                  |
    | **Logger**    | Message input with variable support, Level selector (info/warn/error)                           |
    | **DateTime**  | Operation selector (add/subtract/format/now), Value input, Unit selector, Format string         |
    | **Variable**  | Key-value pair array editor with add/remove buttons                                             |

3.  **Add Inline Validation:**

    - URL fields: Validate URL format, check against allow-list (show warning if not whitelisted)
    - Email fields: Validate email format
    - JSON fields: Validate JSON syntax with error highlighting
    - Required fields: Show red border and helper text when empty
    - Use `react-hook-form` for consistent validation across all forms

4.  **Add Variable Picker Component:**

    - Create `frontend/src/components/builder/VariablePicker.tsx`
    - Dropdown showing available outputs from upstream nodes
    - Format: `{{steps.nodeName.fieldName}}` or `{{trigger.fieldName}}`
    - Integrate into Email body, HTTP URL/body, Logger message, Condition value fields

5.  **UI Polish:**
    - Ensure forms use the same "glassmorphism" style as existing Email/Trigger forms
    - Add aria-labels for accessibility (N11)
    - Support keyboard navigation (Tab between fields, Enter to save)

---

### Feature B: Support for "Variable" & "Attach Data" Nodes

**Objective:** Add the missing nodes from the project plan to enable data manipulation and show data flow.

#### Implementation Steps:

1.  **Update NodePicker.tsx:**

    - Add entry for `variable` node:
      ```typescript
      { type: 'variable', label: 'Set Variable', description: 'Store and manipulate data for use in later nodes.' }
      ```

2.  **Update ConfigPanel.tsx for Variable Node:**

    - Form with dynamic key-value pair array
    - "Add Variable" button to add new pairs
    - "Remove" button (trash icon) per row
    - Value field should support variable picker for referencing upstream data

3.  **Data Flow Panel:**

    - Add collapsible "Available Data" section at top of ConfigPanel
    - Show variables available at the selected node based on upstream connections:
      ```
      Available Variables:
      - {{trigger.name}} - Employee name
      - {{trigger.email}} - Employee email
      - {{steps.cv_parser.skills}} - Extracted skills
      ```
    - Update dynamically when edges change

4.  **CV Parser Output Mapping:**
    - In CV Parser config, show "Output Fields" section (read-only):
      ```
      This node outputs:
      - steps.cv_parser.name
      - steps.cv_parser.email
      - steps.cv_parser.phone
      - steps.cv_parser.skills
      - steps.cv_parser.experience
      ```

---

### Feature C: Workflow Templates System

**Objective:** Allow users (Admin/Operator) to start with a pre-built structure instead of a blank canvas.

#### Implementation Steps:

1.  **Template Definitions:** Create `frontend/src/data/templates.ts`:

    ```typescript
    export interface WorkflowTemplate {
      id: string;
      name: string;
      description: string;
      useCase: string;
      nodes: TemplateNode[];
      edges: TemplateEdge[];
    }

    export const templates: WorkflowTemplate[] = [
      {
        id: "hr-onboarding",
        name: "HR Onboarding",
        description:
          "Automate new employee onboarding with CV parsing and welcome emails.",
        useCase:
          "Use when a new employee joins and you need to extract their CV data, validate information, and send a personalized welcome email.",
        nodes: [
          {
            id: "trigger-1",
            kind: "trigger",
            name: "New Employee",
            pos_x: 100,
            pos_y: 200,
            config: {
              /* ... */
            },
          },
          {
            id: "cv-parser-1",
            kind: "cv_parser",
            name: "Parse CV",
            pos_x: 350,
            pos_y: 200,
            config: {
              /* ... */
            },
          },
          {
            id: "condition-1",
            kind: "condition",
            name: "Valid Data?",
            pos_x: 600,
            pos_y: 200,
            config: {
              /* ... */
            },
          },
          {
            id: "email-success",
            kind: "email",
            name: "Welcome Email",
            pos_x: 850,
            pos_y: 100,
            config: {
              /* ... */
            },
          },
          {
            id: "email-failure",
            kind: "email",
            name: "Review Required",
            pos_x: 850,
            pos_y: 300,
            config: {
              /* ... */
            },
          },
        ],
        edges: [
          { from: "trigger-1", to: "cv-parser-1" },
          { from: "cv-parser-1", to: "condition-1" },
          {
            from: "condition-1",
            to: "email-success",
            condition: { branch: "true" },
          },
          {
            from: "condition-1",
            to: "email-failure",
            condition: { branch: "false" },
          },
        ],
      },
      {
        id: "it-access",
        name: "IT Access Provisioning",
        description:
          "Automate IT system access requests with approval workflow.",
        useCase:
          "Use when an employee needs access to IT systems. Sends request, waits for processing, and notifies with credentials.",
        nodes: [
          {
            id: "trigger-1",
            kind: "trigger",
            name: "Access Request",
            pos_x: 100,
            pos_y: 200,
            config: {
              /* ... */
            },
          },
          {
            id: "http-1",
            kind: "http",
            name: "Create Account",
            pos_x: 350,
            pos_y: 200,
            config: {
              /* ... */
            },
          },
          {
            id: "wait-1",
            kind: "wait",
            name: "Wait 30s",
            pos_x: 600,
            pos_y: 200,
            config: { duration: 30, unit: "seconds" },
          },
          {
            id: "email-1",
            kind: "email",
            name: "Send Credentials",
            pos_x: 850,
            pos_y: 200,
            config: {
              /* ... */
            },
          },
          {
            id: "logger-1",
            kind: "logger",
            name: "Log Completion",
            pos_x: 1100,
            pos_y: 200,
            config: {
              /* ... */
            },
          },
        ],
        edges: [
          { from: "trigger-1", to: "http-1" },
          { from: "http-1", to: "wait-1" },
          { from: "wait-1", to: "email-1" },
          { from: "email-1", to: "logger-1" },
        ],
      },
    ];
    ```

2.  **Template Preview Modal:** Create `frontend/src/components/TemplatePreviewModal.tsx`:

    - Read-only mini canvas showing template structure
    - Template name, description, and use-case text
    - "Required Configuration" section listing what user needs to fill in
    - "Use Template" and "Cancel" buttons

3.  **Dashboard Integration:**

    - Modify `DashboardPage.tsx` to add "Start from Template" section:
      ```tsx
      <section className="templates-section">
        <h2>Quick Start Templates</h2>
        <div className="template-cards">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onPreview={() => openPreviewModal(t)}
              onUse={() => createFromTemplate(t)}
            />
          ))}
        </div>
      </section>
      ```
    - **Action Flow:** When "Use Template" clicked:
      1. Call `POST /api/workflows` to create new workflow
      2. Call `PUT /api/workflows/:id` with template nodes/edges
      3. Navigate to `/workflows/:id/builder`

4.  **New Workflow Modal Update:**
    - Add template selection as first step when creating new workflow
    - Options: "Blank Workflow" or template cards
    - Blank workflow goes directly to empty builder
    - Template creates pre-populated builder

---

### Feature D: Governance & Security UI

**Objective:** Give Admins the required control over security features.

#### Implementation Steps:

1.  **Backend Routes:** Create `backend/src/routes/settingsRoutes.ts`:

    ```typescript
    // GET /api/settings/allow-list - Get all allowed domains
    // POST /api/settings/allow-list - Add domain { domain: string }
    // DELETE /api/settings/allow-list/:id - Remove domain
    ```

2.  **Database Schema:** Add to `backend/prisma/schema.prisma`:

    ```prisma
    model allowed_domains {
      id         Int      @id @default(autoincrement())
      domain     String   @unique @db.VarChar(255)
      created_by Int
      created_at DateTime @default(now())
      user       users    @relation(fields: [created_by], references: [id])
    }
    ```

3.  **HTTP Allow-List UI:** Create `frontend/src/pages/Admin/SecurityPage.tsx`:

    - Admin role check (redirect if not admin)
    - "Allowed Domains" section:
      - List current domains in a table (Domain, Added By, Date, Remove button)
      - "Add Domain" input with validation (valid domain format)
      - Confirmation modal before removing domains
    - Visual indicators:
      - Green checkmark for active domains
      - Warning banner explaining allow-list enforcement

4.  **Compiler Integration:** Update `backend/src/services/n8nCompiler.ts`:

    - Before compiling HTTP node, check URL domain against allow-list
    - If domain not allowed, throw compilation error with clear message
    - Log blocked attempts to audit_logs

5.  **Audit Integration:**

    - Log all domain add/remove actions:
      ```typescript
      await auditService.log({
        event_type: "DOMAIN_ADDED" | "DOMAIN_REMOVED",
        user_id: currentUser.id,
        target_type: "SECURITY",
        details: { domain: "api.example.com" },
      });
      ```

6.  **Audit Log Controls:** Modify `frontend/src/pages/Admin/AuditLogPage.tsx`:

    - **Add "Export" button:**
      - Dropdown: "Export as CSV" / "Export as JSON"
      - Client-side generation from current filtered data
      - Filename: `audit-logs-{date}.csv` or `.json`
    - **Add "Purge Old Logs" button:**
      - Confirmation modal: "This will permanently delete logs older than 90 days. This action cannot be undone."
      - Calls `DELETE /api/audit/purge?days=90`
      - Logs the purge action itself before deleting

7.  **Backend Purge Endpoint:** Add to `backend/src/routes/auditRoutes.ts`:
    ```typescript
    // DELETE /api/audit/purge?days=90
    // - Admin only
    // - Records purge action with admin ID and timestamp before deleting
    // - Returns count of deleted records
    ```

---

### Feature E: CV Parser Integration

**Objective:** Ensure the CV parser connects to FastAPI service and provides useful configuration UI.

#### Implementation Steps:

1.  **Backend Health Check:** Add to `backend/src/services/cvService.ts`:

    ```typescript
    async function checkHealth(): Promise<boolean> {
      const response = await fetch(`${CV_PARSER_URL}/health`);
      return response.ok;
    }
    ```

    - Expose via `GET /api/cv-parser/health`

2.  **ConfigPanel for CV Parser:**

    - File Source field with variable picker (for referencing trigger file upload)
    - Checkboxes for fields to extract:
      - [ ] Name
      - [ ] Email
      - [ ] Phone
      - [ ] Skills
      - [ ] Experience
    - "Test Parse" button (optional, for development):
      - Upload a sample CV
      - Show parsed output in read-only JSON panel

3.  **Output Preview:**

    - Show which fields will be available downstream:
      ```
      Selected fields will be available as:
      - {{steps.cv_parser.name}}
      - {{steps.cv_parser.email}}
      - {{steps.cv_parser.skills}}
      ```

4.  **Test Dataset:** Create test data for validation:

    - Create `test-data/cvs/` directory with 10 sample CVs
    - Include variety: PDF and DOCX formats
    - Include edge cases: missing fields, unusual formatting
    - Target: ≥90% field detection accuracy per F14

5.  **Error Handling:**
    - If CV parser service unavailable, show clear error in UI
    - If parsing fails, capture error in execution_steps with helpful message

---

### Feature F: Secondary Improvements

**Objective:** Address remaining gaps from project requirements.

#### Implementation Steps:

1.  **Duplicate Workflow (F4):**

    - Add "Duplicate" button to workflow list and detail pages
    - Backend: `POST /api/workflows/:id/duplicate`
    - Creates new workflow with " (Copy)" suffix
    - Duplicates all nodes, edges, and configurations
    - Generates new unique IDs for duplicated elements

2.  **Rerun Confirmation Modal (F7):**

    - Before re-executing a workflow, show confirmation modal:
      ```
      "Re-run Workflow?"
      This will execute the workflow again with the same configuration.
      [Cancel] [Confirm Re-run]
      ```
    - Log `rerun_confirmed: true` in execution context

3.  **Webhook URL Display (F6):**

    - In workflow builder header, show webhook URL:
      ```
      Webhook: https://your-domain/webhook/hrflow/{workflowId}/execute [Copy]
      ```
    - Copy button copies URL to clipboard with toast notification

4.  **Dashboard KPI Refresh (N14):**

    - Add auto-refresh to dashboard stats
    - Use `setInterval` with 5-minute (300000ms) interval
    - Show "Last updated: X minutes ago" indicator
    - Manual refresh button available

5.  **Password Rate Limiting (N7):**

    - Backend: Implement rate limiting on `/api/auth/login`
    - Max 5 attempts per minute per IP/email
    - Return 429 Too Many Requests after limit
    - Add to auth middleware

6.  **Error Messages (N13):**
    - Create standardized error message component
    - Map common errors to user-friendly messages:
      - `ECONNREFUSED` → "Unable to connect to service. Please try again."
      - `VALIDATION_ERROR` → Show specific field errors
      - `UNAUTHORIZED` → "Session expired. Please log in again."
    - Never expose stack traces or internal details to users

---

## 4. Execution Roadmap

### Phase 1: Core Builder Completion (Features A + B + E)

**Deliverables:**

- All 9 node types have working configuration forms
- Inline validation on all form fields
- Variable node added to NodePicker
- Variable picker component for referencing upstream data
- CV Parser config with field selection
- Data flow panel showing available variables

**Files Modified:**

- `frontend/src/components/builder/ConfigPanel.tsx`
- `frontend/src/components/builder/NodePicker.tsx`
- `frontend/src/components/builder/VariablePicker.tsx` (new)
- `frontend/src/types/nodeConfigs.ts` (new)

### Phase 2: Templates & Workflow Operations (Features C + F.1-3)

**Deliverables:**

- Template definitions for HR Onboarding and IT Access
- Template preview modal with use-case descriptions
- Dashboard "Quick Start Templates" section
- Duplicate workflow functionality
- Rerun confirmation modal
- Webhook URL display in builder

**Files Modified:**

- `frontend/src/data/templates.ts` (new)
- `frontend/src/components/TemplatePreviewModal.tsx` (new)
- `frontend/src/pages/Dashboard/DashboardPage.tsx`
- `frontend/src/pages/Workflows/workflowListPage.tsx`
- `frontend/src/pages/Workflows/workflowBuilderPage.tsx`
- `backend/src/routes/workflowRoutes.ts`
- `backend/src/services/workflowService.ts`

### Phase 3: Governance & Security (Feature D + F.5)

**Deliverables:**

- SecurityPage with HTTP allow-list management
- Backend routes for allow-list CRUD
- Compiler integration checking allow-list
- Audit log export (CSV/JSON)
- Audit log purge (>90 days)
- Password rate limiting

**Files Modified:**

- `frontend/src/pages/Admin/SecurityPage.tsx` (new)
- `frontend/src/pages/Admin/AuditLogPage.tsx`
- `backend/src/routes/settingsRoutes.ts` (new)
- `backend/src/routes/auditRoutes.ts`
- `backend/src/services/n8nCompiler.ts`
- `backend/src/middleware/rateLimiter.ts` (new)
- `backend/prisma/schema.prisma`

### Phase 4: Polish & Secondary Features (Features F.4, F.6)

**Deliverables:**

- Dashboard auto-refresh (5-minute interval)
- Standardized error message handling
- Accessibility improvements (aria-labels, keyboard nav)
- Toast notifications for actions

**Files Modified:**

- `frontend/src/pages/Dashboard/DashboardPage.tsx`
- `frontend/src/components/ErrorMessage.tsx` (new)
- `frontend/src/components/Toast.tsx` (new or update existing)

### Phase 5: Integration Testing & Verification

**Deliverables:**

- End-to-end test of HR Onboarding template
- End-to-end test of IT Access template
- CV parser accuracy validation (10 CVs, ≥90%)
- RBAC enforcement verification
- Allow-list blocking verification
- Audit log capture verification

**Test Scenarios:**

1. Create workflow from HR Onboarding template → Configure → Execute → Verify email sent + logged
2. Create workflow from IT Access template → Configure → Execute → Verify HTTP call + wait + email
3. Upload 10 test CVs → Verify ≥9 parse correctly with all fields
4. Operator tries admin actions → Verify blocked
5. HTTP node with non-whitelisted domain → Verify compilation fails
6. Login, edit workflow, execute → Verify all actions in audit log

---

## 5. Technical Notes

### Development Standards

- **Icons:** Continue using `react-icons/lu` or `fi` as currently established
- **State Management:** Keep local state in `ConfigPanel` and push to parent on save to avoid complexity
- **Form Validation:** Use `react-hook-form` for consistent validation patterns
- **Styling:** Maintain glassmorphism design system with existing CSS variables

### Backend Considerations

- **Mocking:** If backend endpoints for allow-list are missing, implementation will include basic backend route creation
- **Database Migrations:** Run `npx prisma migrate dev` after schema changes
- **Rate Limiting:** Use `express-rate-limit` package for login throttling

### Accessibility Requirements (N11)

- All form inputs must have associated labels
- All interactive elements must be keyboard accessible
- Focus indicators must be visible
- Inline validation messages must be announced to screen readers

### Testing Requirements

- Unit tests for new config type interfaces
- Integration tests for allow-list enforcement
- E2E tests for template instantiation flow
- CV parser accuracy test suite

---

## 6. Acceptance Criteria Checklist

### Builder (F1, F2, N11)

- [x] All 9 node types have working configuration forms ✅ (ConfigPanel.tsx rewritten)
- [x] Forms have inline validation with error messages ✅ (FormField component with validation)
- [x] Variable picker available in text fields ✅ (VariablePicker.tsx component created)
- [x] Keyboard navigation works on all forms ✅ (Esc/Ctrl+S/Tab + hints in footer)

### Templates (F11, F12)

- [x] HR Onboarding template creates valid workflow ✅ (templates.ts)
- [x] IT Access template creates valid workflow ✅ (templates.ts)
- [x] Template preview shows structure and requirements ✅ (TemplatePreviewModal.tsx)
- [ ] Templates execute successfully end-to-end

### CV Parser (F13, F14, F15)

- [ ] CV upload accepts PDF/DOCX ≤5MB
- [ ] Parser extracts ≥90% of fields from test set
- [ ] Parsed data available as variables in downstream nodes

### Security (F16, F17, F18, N7, N15)

- [x] Admin can manage HTTP allow-list ✅ (SecurityPage.tsx + settingsRoutes.ts)
- [x] Non-whitelisted domains blocked at compilation ✅ (n8nCompiler.ts validateWorkflowUrls)
- [x] Blocked requests logged ✅ (audit event logged in n8nCompiler.ts)
- [x] Login rate limited to 5 attempts/minute ✅ (rateLimiter.ts + authController.ts)

### Audit (F19, F20, N8)

- [x] All security events logged ✅ (domain blocks, purge, login failures)
- [x] Admin can export logs as CSV/JSON ✅ (AuditLogPage.tsx updated)
- [x] Admin can purge logs >90 days ✅ (auditRoutes.ts + auditController.ts)
- [x] Purge action itself is logged ✅ (logged before purge in auditController)

### Dashboard (F8, F9, N14)

- [x] Shows runs, status, timestamps, duration ✅ (Live Feed with status icons, timestamps, duration)
- [x] KPIs refresh every ≤5 minutes ✅ (DashboardPage.tsx auto-refresh added)
- [x] Webhook URL displayed and copyable ✅ (workflowBuilderPage.tsx)

### Workflow Operations (F4, F6, F7)

- [x] Duplicate workflow functionality ✅ (backend + frontend)
- [x] Rerun confirmation modal ✅ (workflowBuilderPage.tsx)
- [x] Templates section on Dashboard ✅ (DashboardPage.tsx)
