# Google Form Trigger Integration - DETAILED IMPLEMENTATION PLAN

## Current Implementation Status 🚧

### ✅ Completed (Original Implementation)
- [x] Backend webhook endpoint created (`googleFormController.ts`)
- [x] Webhook routes configured (`webhookRoutes.ts`)
- [x] Routes mounted in app.ts (webhooks at root level)
- [x] Environment variable `WEBHOOK_SECRET_KEY` added to `.env`
- [x] Frontend dependencies installed (sonner, react-syntax-highlighter)
- [x] ConfigPanel.tsx updated with trigger source dropdown and Google Form UI
- [x] Apps Script snippet displayed in UI (syntax highlighted)
- [x] Execution notification system implemented
- [x] Sonner toaster integrated in App.tsx
- [x] Webhook tested successfully with curl

### 🔄 In Progress (Pre-Configured Form Migration)
**Current Task:** Migrating from "user creates form" to "admin provides pre-configured form link"

**Admin Setup (One-Time - You're Here)**:
- [x] Google Form created: https://forms.gle/4EXCNC4rVkRiXXC67
- [x] Form fields added (Name, Email, Department, Role, Start Date, Manager Email, Workflow ID)
- [x] Entry ID identified: `116395526` (for Workflow ID field)
- [ ] **NEXT:** Apps Script installation (waiting for user to complete)
- [ ] **NEXT:** Form submission trigger setup (waiting for user to complete)

**Code Changes (Not Yet Implemented)**:
- [ ] Add `GOOGLE_FORM_BASE_URL` and `GOOGLE_FORM_WORKFLOW_ID_ENTRY` to `.env`
- [ ] Create `backend/src/utils/googleFormHelper.ts` (form URL generator)
- [ ] Add `GET /api/workflows/:id/form-url` endpoint
- [ ] Update ConfigPanel.tsx to show "Open Google Form" button instead of Apps Script snippet
- [ ] Remove technical details (webhook URL, Apps Script) from UI

**Configuration Values Ready**:
```bash
GOOGLE_FORM_BASE_URL=https://forms.gle/4EXCNC4rVkRiXXC67
GOOGLE_FORM_WORKFLOW_ID_ENTRY=116395526
```

**Next Steps**:
1. User completes Apps Script installation in Google Form
2. User sets up form submission trigger
3. Implement backend helper function and API endpoint
4. Update frontend to show pre-filled form link
5. Test end-to-end with real form submission

---

## Architecture Decisions ✅

### Webhook Flow
**Decision:** Google Form → HRFlow webhook → Creates execution record → Triggers n8n webhook

**Rationale:**
- HRFlow acts as intermediary for full execution tracking
- Can store original form data before normalization
- Better error handling and debugging
- Consistent with current architecture (HRFlow compiles & orchestrates)

### Security Model
**Decision:** Single global API key in `.env` file with URL query parameter validation

**Implementation:**
- Environment variable: `WEBHOOK_SECRET_KEY=your-random-secret-here`
- Webhook URL format: `http://localhost:4000/webhooks/google-form/:workflowId?token={WEBHOOK_SECRET_KEY}`
- Validation: Check `req.query.token === process.env.WEBHOOK_SECRET_KEY`
- Return 401 Unauthorized if token missing/invalid

### Configuration Storage
**Decision:** Store trigger source in trigger node's `config` field

**Schema:**
```typescript
// workflow_nodes.config_json for trigger nodes
{
  "triggerSource": "manual" | "google_form",
  // If manual:
  "name": "John Doe",
  "email": "john@example.com",
  // ... other employee fields

  // If google_form: no additional fields needed
  // (webhook URL generated dynamically from workflowId + env token)
}
```

### Field Normalization
**Decision:** Automatic case-insensitive exact matching with pass-through for unknowns

**Mapping Rules:**
```typescript
const FIELD_MAPPINGS = {
  // Exact matches (case-insensitive)
  'name': 'employee.name',
  'full name': 'employee.name',
  'email': 'employee.email',
  'department': 'employee.department',
  'role': 'employee.role',
  'job title': 'employee.role',
  'start date': 'employee.startDate',
  'manager email': 'employee.managerEmail',
};

// Algorithm:
// 1. Normalize form field names (trim, lowercase)
// 2. Check if field matches mapping table
// 3. If match: populate employee.* structure
// 4. If no match: pass field as-is in top-level object
// 5. Return both employee object AND flattened fields
```

**Example:**
```javascript
// Google Form submission:
{
  "Name": "John Doe",
  "Email": "john@example.com",
  "Custom Question": "Answer here"
}

// Normalized output:
{
  "employee": {
    "name": "John Doe",
    "email": "john@example.com",
    "department": null,
    "role": null,
    "startDate": null,
    "managerEmail": null
  },
  "Name": "John Doe",
  "Email": "john@example.com",
  "Custom Question": "Answer here"
}
```

### Notifications
**Decision:** Sonner toast library, poll all executions, click to navigate

**Implementation:**
- Install: `npm install sonner`
- Poll `/api/executions?limit=10&orderBy=started_at:desc` every 15 seconds
- Track `lastSeenExecutionId` in localStorage
- Show toast for new executions: "Workflow '{name}' {status}" with "View" button
- Toast auto-dismisses after 5 seconds unless clicked

---

## Technical Implementation

### Phase 1: Environment Setup

**File:** `backend/.env`
```bash
# Add new environment variable
WEBHOOK_SECRET_KEY=generate-random-uuid-here-or-use-openssl-rand-hex-32
```

**Documentation:** Update README or .env.example with instructions to generate secure key:
```bash
# Generate secure webhook key (Linux/Mac):
openssl rand -hex 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Phase 2: Backend Webhook Endpoint

#### 2.1 Create Webhook Controller

**File:** `backend/src/controllers/googleFormController.ts` (NEW)

```typescript
import { Request, Response } from "express";
import * as executionService from "../services/executionService";
import { prisma } from "../lib/prisma";

/**
 * Field mapping for Google Form field normalization
 */
const FIELD_MAPPINGS: Record<string, string> = {
  'name': 'name',
  'full name': 'name',
  'email': 'email',
  'department': 'department',
  'role': 'role',
  'job title': 'role',
  'start date': 'startDate',
  'manager email': 'managerEmail',
};

/**
 * Normalize Google Form payload to employee structure
 */
function normalizeGoogleFormData(formData: Record<string, unknown>) {
  const employee: Record<string, unknown> = {
    name: null,
    email: null,
    department: null,
    role: null,
    startDate: null,
    managerEmail: null,
  };

  const normalized: Record<string, unknown> = {};

  // Process each form field
  for (const [key, value] of Object.entries(formData)) {
    const normalizedKey = key.trim().toLowerCase();
    const mappedField = FIELD_MAPPINGS[normalizedKey];

    if (mappedField) {
      // Map to employee structure
      employee[mappedField] = value;
    }

    // Also include original field (for custom fields)
    normalized[key] = value;
  }

  // Return both structures
  return {
    employee,
    ...normalized, // Spread original fields for flexibility
  };
}

/**
 * Handle Google Form webhook submission
 * POST /webhooks/google-form/:workflowId?token=xxx
 */
export async function handleGoogleFormSubmission(req: Request, res: Response) {
  try {
    // 1. Validate security token
    const token = req.query.token as string | undefined;
    const expectedToken = process.env.WEBHOOK_SECRET_KEY;

    if (!expectedToken) {
      console.error("[GoogleFormWebhook] WEBHOOK_SECRET_KEY not configured in .env");
      return res.status(500).json({
        success: false,
        error: "Webhook authentication not configured",
      });
    }

    if (!token || token !== expectedToken) {
      console.warn("[GoogleFormWebhook] Invalid or missing token");
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing token",
      });
    }

    // 2. Validate workflowId
    const workflowId = parseInt(req.params.workflowId, 10);
    if (isNaN(workflowId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    // 3. Check workflow exists and is active
    const workflow = await prisma.workflows.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    if (!workflow.is_active) {
      return res.status(400).json({
        success: false,
        error: "Workflow is not active",
      });
    }

    // 4. Parse and normalize form data
    const formData = req.body as Record<string, unknown>;
    console.log("[GoogleFormWebhook] Received form data:", formData);

    const normalizedData = normalizeGoogleFormData(formData);
    console.log("[GoogleFormWebhook] Normalized data:", normalizedData);

    // 5. Execute workflow
    const result = await executionService.executeWorkflow({
      workflowId,
      triggerType: "google_form",
      input: normalizedData,
    });

    // 6. Return 202 Accepted (execution is async)
    return res.status(202).json({
      success: true,
      message: "Workflow execution started",
      executionId: result.executionId,
    });
  } catch (error) {
    console.error("[GoogleFormWebhook] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
```

#### 2.2 Create Webhook Routes

**File:** `backend/src/routes/webhookRoutes.ts` (NEW)

```typescript
import { Router } from "express";
import * as googleFormController from "../controllers/googleFormController";

const router = Router();

// Google Form webhook endpoint
// POST /webhooks/google-form/:workflowId?token=xxx
router.post(
  "/google-form/:workflowId",
  googleFormController.handleGoogleFormSubmission
);

export default router;
```

#### 2.3 Mount Webhook Routes

**File:** `backend/src/routes/index.ts`

```typescript
import { Router } from "express";
import workflowRoutes from "./workflowRoutes";
import userRoutes from "./userRoutes";
import roleRoutes from "./roleRoutes";
import executionRoutes from "./executionRoutes";
import authRoutes from "./authRoutes";
import auditRoutes from "./auditRoutes";
import dashboardRoutes from "./dashboardRoutes";
import settingsRoutes from "./settingsRoutes";
import fileRoutes from "./fileRoutes";
import webhookRoutes from "./webhookRoutes"; // NEW

const router = Router();

// Auth routes (login, logout, etc.) - must be before protected routes
router.use("/auth", authRoutes);

// Webhook routes (NO /api prefix - clean URLs for external services)
// Mounted at /webhooks/*
router.use("/webhooks", webhookRoutes); // NEW

// All workflow endpoints under /api/workflows
router.use("/workflows", workflowRoutes);

// /api/users/...
router.use("/users", userRoutes);

// /api/roles/...
router.use("/roles", roleRoutes);

// /api/executions/...
router.use("/executions", executionRoutes);

// /api/audit/... (Admin-only)
router.use("/audit", auditRoutes);

// /api/dashboard/... (Dashboard statistics)
router.use("/dashboard", dashboardRoutes);

// /api/settings/... (Admin-only settings)
router.use("/settings", settingsRoutes);

// /api/files/... (File uploads)
router.use("/files", fileRoutes);

export default router;
```

**IMPORTANT:** Webhook routes are mounted at `/webhooks/*` (not `/api/webhooks/*`) for cleaner external URLs.

**Update:** `backend/src/app.ts` to mount webhooks BEFORE `/api` routes:

```typescript
import express from "express";
import cors from "cors";
import router from "./routes/index";

const app = express();

app.use(cors());
app.use(express.json());

// Mount webhooks at root level (before /api)
app.use(router); // This now includes both /webhooks and /api routes

export default app;
```

**Webhook URL will be:** `http://localhost:4000/webhooks/google-form/:workflowId?token=xxx`

---

### Phase 3: Frontend - Install Dependencies

```bash
cd frontend
npm install sonner
```

---

### Phase 4: Frontend - Trigger Configuration UI

#### 4.1 Update ConfigPanel.tsx

**File:** `frontend/src/components/builder/ConfigPanel.tsx`

**Changes:**

1. Add trigger source dropdown at the top of trigger config
2. Conditionally render manual fields OR Google Form webhook config
3. Display webhook URL with token
4. Display Apps Script snippet with webhook URL pre-filled

**Implementation:**

```typescript
// Add after existing imports
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Inside the switch case for 'trigger':
case 'trigger': {
  const triggerSource = getString(localConfig, 'triggerSource', 'manual');

  // Get workflow ID from parent component (need to pass as prop)
  const workflowId = props.workflowId; // TODO: Add to props

  // Generate webhook URL
  const backendUrl = 'http://localhost:4000'; // TODO: Use env var
  const webhookToken = 'YOUR_SECRET_TOKEN'; // Placeholder - admin sets in .env
  const webhookUrl = `${backendUrl}/webhooks/google-form/${workflowId}?token=${webhookToken}`;

  // Apps Script snippet with webhook URL
  const appsScriptSnippet = `function onFormSubmit(e) {
  var url = "${webhookUrl}";
  var payload = {};

  // Get named values from the form submission
  var itemResponses = e.response.getItemResponses();
  for (var i = 0; i < itemResponses.length; i++) {
    var itemResponse = itemResponses[i];
    payload[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  }

  // Add email if collected automatically
  if (e.response.getRespondentEmail()) {
    payload["Email"] = e.response.getRespondentEmail();
  }

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    Logger.log("Webhook response: " + response.getContentText());
  } catch (error) {
    Logger.log("Webhook error: " + error.toString());
  }
}`;

  return (
    <div className="space-y-5">
      <InfoBox variant="info">
        <div className="flex items-start gap-2">
          <LuInfo className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Workflow Starting Point</strong>
            <p className="mt-1 opacity-80">
              Choose how this workflow should be triggered.
            </p>
          </div>
        </div>
      </InfoBox>

      {/* Trigger Source Selector */}
      <FormField label="Trigger Source" icon={<LuZap className="w-3 h-3" />}>
        <select
          value={triggerSource}
          onChange={(e) => handleChange('triggerSource', e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="manual">Manual (Run Button)</option>
          <option value="google_form">Google Form Submission</option>
        </select>
      </FormField>

      {/* Conditional rendering based on trigger source */}
      {triggerSource === 'manual' && (
        <div className="space-y-4 border-t border-white/5 pt-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LuUser className="w-4 h-4 text-cyan-glow" />
            Employee Information
          </h3>

          {/* Existing manual trigger fields */}
          <FormField label="Full Name" icon={<LuUser className="w-3 h-3" />}>
            <TextInput
              value={getString(localConfig, 'name')}
              onChange={(val) => handleChange('name', val)}
              placeholder="e.g. John Doe"
              icon={<LuUser className="w-4 h-4" />}
            />
          </FormField>

          <FormField label="Email Address" icon={<LuMail className="w-3 h-3" />}>
            <TextInput
              value={getString(localConfig, 'email')}
              onChange={(val) => handleChange('email', val)}
              placeholder="e.g. john.doe@company.com"
              icon={<LuMail className="w-4 h-4" />}
            />
          </FormField>

          {/* ... rest of manual trigger fields ... */}
        </div>
      )}

      {triggerSource === 'google_form' && (
        <div className="space-y-4 border-t border-white/5 pt-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LuGlobe className="w-4 h-4 text-cyan-glow" />
            Google Form Integration
          </h3>

          {/* Webhook URL */}
          <FormField
            label="Webhook URL"
            icon={<LuLink className="w-3 h-3" />}
            description="Use this URL in your Google Apps Script"
          >
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-cyan-400 font-mono text-sm focus:outline-none select-all"
              onClick={(e) => e.currentTarget.select()}
            />
          </FormField>

          {/* Setup Instructions */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wide">
              Setup Instructions
            </h4>
            <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
              <li>Create your Google Form with standardized field names</li>
              <li>Open the form, click Extensions → Apps Script</li>
              <li>Delete default code and paste the script below</li>
              <li>Save the script (Ctrl+S)</li>
              <li>Click Triggers icon (⏰) → Add Trigger</li>
              <li>Set: Function: onFormSubmit, Event: On form submit</li>
              <li>Authorize the script and save</li>
            </ol>
          </div>

          {/* Recommended Field Names */}
          <InfoBox variant="warning">
            <div className="flex items-start gap-2">
              <LuInfo className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Recommended Form Field Names</strong>
                <p className="mt-1 opacity-80">
                  Use these exact field names (case-insensitive) for automatic mapping:
                </p>
                <ul className="mt-2 text-xs font-mono space-y-1">
                  <li>• Name or Full Name → employee.name</li>
                  <li>• Email → employee.email</li>
                  <li>• Department → employee.department</li>
                  <li>• Role or Job Title → employee.role</li>
                  <li>• Start Date → employee.startDate</li>
                  <li>• Manager Email → employee.managerEmail</li>
                </ul>
                <p className="mt-2 text-xs opacity-70">
                  Other field names will be passed through as-is and can be accessed via expressions.
                </p>
              </div>
            </div>
          </InfoBox>

          {/* Apps Script Snippet */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wide">
              Google Apps Script
            </h4>
            <div className="rounded-lg overflow-hidden border border-gray-700">
              <SyntaxHighlighter
                language="javascript"
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  fontSize: '12px',
                  maxHeight: '400px',
                }}
              >
                {appsScriptSnippet}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Required prop addition:**

Update `ConfigPanelProps` interface:
```typescript
type ConfigPanelProps = {
  isOpen: boolean;
  node: WorkflowNode | null;
  workflowId: number; // NEW - needed for webhook URL generation
  onClose: () => void;
  onUpdate: (id: number, update: { config?: Record<string, unknown>; name?: string }) => void;
  onDelete: (id: number) => void;
};
```

#### 4.2 Update workflowBuilderPage.tsx

Pass `workflowId` to ConfigPanel:

```typescript
<ConfigPanel
  isOpen={!!selectedNode}
  node={selectedNode}
  workflowId={state.workflowId} // NEW
  onClose={closeConfigPanel}
  onUpdate={updateSelectedNodeConfig}
  onDelete={handleDeleteNode}
/>
```

**Install syntax highlighter:**
```bash
cd frontend
npm install react-syntax-highlighter
npm install --save-dev @types/react-syntax-highlighter
```

---

### Phase 5: Frontend - Notification System

#### 5.1 Create Notification Context

**File:** `frontend/src/contexts/ExecutionNotificationContext.tsx` (NEW)

```typescript
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { fetchExecutions } from '../api/executions';

const POLL_INTERVAL = 15000; // 15 seconds
const LAST_SEEN_KEY = 'hrflow_last_seen_execution_id';

export const ExecutionNotificationContext = createContext<void>(undefined);

export function ExecutionNotificationProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load last seen execution ID from localStorage
    let lastSeenId = parseInt(localStorage.getItem(LAST_SEEN_KEY) || '0', 10);

    const poll = async () => {
      try {
        const executions = await fetchExecutions({ limit: 10, offset: 0 });

        if (executions.length === 0) return;

        // Find new executions
        const newExecutions = executions.filter(exec => exec.id > lastSeenId);

        if (newExecutions.length > 0) {
          // Update last seen ID
          const newestId = Math.max(...newExecutions.map(e => e.id));
          lastSeenId = newestId;
          localStorage.setItem(LAST_SEEN_KEY, newestId.toString());

          // Show toast for each new execution (max 3 to avoid spam)
          const toShow = newExecutions.slice(0, 3).reverse(); // Show oldest first

          toShow.forEach(execution => {
            const workflowName = execution.workflow?.name || 'Unknown Workflow';
            const status = execution.status;
            const triggerType = execution.trigger_type || 'manual';

            let message = `Workflow "${workflowName}"`;

            if (status === 'completed') {
              message += ' completed successfully';
            } else if (status === 'failed') {
              message += ' failed';
            } else if (status === 'running') {
              message += ' started';
            } else {
              message += ` status: ${status}`;
            }

            // Show toast with navigation
            toast(message, {
              description: `Triggered by: ${triggerType}`,
              action: {
                label: 'View',
                onClick: () => navigate(`/executions/${execution.id}`),
              },
              duration: 5000,
            });
          });

          // If more than 3, show summary toast
          if (newExecutions.length > 3) {
            toast.info(`${newExecutions.length - 3} more workflow executions`, {
              action: {
                label: 'View All',
                onClick: () => navigate('/executions'),
              },
            });
          }
        }
      } catch (error) {
        console.error('[ExecutionNotification] Polling error:', error);
        // Don't show toast for polling errors to avoid annoying users
      }
    };

    // Initial poll
    poll();

    // Set up polling interval
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);

    // Cleanup
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [navigate]);

  return (
    <ExecutionNotificationContext.Provider value={undefined}>
      {children}
    </ExecutionNotificationContext.Provider>
  );
}
```

#### 5.2 Add Sonner Toaster to App

**File:** `frontend/src/App.tsx`

```typescript
import { Toaster } from 'sonner'; // NEW
import { ExecutionNotificationProvider } from './contexts/ExecutionNotificationContext'; // NEW

function App() {
  return (
    <BrowserRouter>
      <ExecutionNotificationProvider> {/* NEW */}
        <Routes>
          {/* ... existing routes ... */}
        </Routes>
        <Toaster position="bottom-right" richColors /> {/* NEW */}
      </ExecutionNotificationProvider>
    </BrowserRouter>
  );
}
```

---

### Phase 6: Testing & Verification

#### 6.1 Backend Testing

1. Start backend: `cd backend && npm run dev`
2. Verify `.env` has `WEBHOOK_SECRET_KEY`
3. Test webhook endpoint with curl:

```bash
curl -X POST "http://localhost:4000/webhooks/google-form/1?token=YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "John Doe",
    "Email": "john@example.com",
    "Department": "Engineering",
    "Role": "Software Engineer",
    "Start Date": "2024-01-15",
    "Manager Email": "manager@example.com"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Workflow execution started",
  "executionId": 123
}
```

4. Check execution in database:
```sql
SELECT * FROM executions WHERE trigger_type = 'google_form';
```

#### 6.2 Frontend Testing

1. Start frontend: `cd frontend && npm run dev`
2. Open workflow builder
3. Select trigger node
4. Change trigger source to "Google Form"
5. Verify webhook URL displays correctly
6. Verify Apps Script snippet shows with correct URL
7. Copy script and verify it includes the webhook URL

#### 6.3 Google Form Integration Testing

1. Create test Google Form: https://forms.google.com/
2. Add questions matching field names:
   - "Name" (Short answer)
   - "Email" (Short answer)
   - "Department" (Short answer)
   - "Role" (Short answer)
   - "Start Date" (Date)
   - "Manager Email" (Short answer)
3. Open form → Extensions → Apps Script
4. Delete default code, paste copied script from HRFlow
5. Save script
6. Click Triggers (⏰ icon) → Add Trigger
7. Set: onFormSubmit, From form, On form submit
8. Authorize and save
9. Submit test form
10. Verify execution appears in HRFlow executions list
11. Verify toast notification appears
12. Click "View" in toast, verify navigates to execution details

#### 6.4 Edge Case Testing

Test these scenarios:

1. **Invalid token:**
   ```bash
   curl -X POST "http://localhost:4000/webhooks/google-form/1?token=wrong_token"
   # Expected: 401 Unauthorized
   ```

2. **Missing token:**
   ```bash
   curl -X POST "http://localhost:4000/webhooks/google-form/1"
   # Expected: 401 Unauthorized
   ```

3. **Invalid workflowId:**
   ```bash
   curl -X POST "http://localhost:4000/webhooks/google-form/abc?token=YOUR_SECRET_KEY"
   # Expected: 400 Bad Request
   ```

4. **Non-existent workflow:**
   ```bash
   curl -X POST "http://localhost:4000/webhooks/google-form/99999?token=YOUR_SECRET_KEY"
   # Expected: 404 Not Found
   ```

5. **Inactive workflow:**
   - Deactivate a workflow in database
   - Submit form
   - Expected: 400 Bad Request "Workflow is not active"

6. **Unmapped fields:**
   - Add custom question to Google Form: "Favorite Color"
   - Submit form
   - Verify field appears in execution input as-is
   - Verify it's accessible in workflow nodes

7. **Multiple rapid submissions:**
   - Submit form 3 times quickly
   - Verify 3 separate executions created
   - Verify 3 toast notifications appear

---

## Implementation Checklist

### Backend
- [ ] Add `WEBHOOK_SECRET_KEY` to `.env`
- [ ] Create `controllers/googleFormController.ts`
- [ ] Create `routes/webhookRoutes.ts`
- [ ] Update `routes/index.ts` to mount webhook routes
- [ ] Test webhook endpoint with curl

### Frontend - Dependencies
- [ ] Install `sonner`: `npm install sonner`
- [ ] Install `react-syntax-highlighter`: `npm install react-syntax-highlighter @types/react-syntax-highlighter`

### Frontend - Trigger Config
- [ ] Update `ConfigPanel.tsx`:
  - [ ] Add trigger source dropdown
  - [ ] Add conditional rendering (manual vs. Google Form)
  - [ ] Add webhook URL display
  - [ ] Add field name recommendations
  - [ ] Add Apps Script snippet with syntax highlighting
- [ ] Add `workflowId` prop to `ConfigPanelProps`
- [ ] Update `workflowBuilderPage.tsx` to pass `workflowId` to ConfigPanel

### Frontend - Notifications
- [ ] Create `contexts/ExecutionNotificationContext.tsx`
- [ ] Update `App.tsx`:
  - [ ] Wrap app in `ExecutionNotificationProvider`
  - [ ] Add `<Toaster />` component
- [ ] Test polling logic (watch network tab for /api/executions calls)

### Testing
- [ ] Test webhook endpoint (curl)
- [ ] Test frontend trigger config UI
- [ ] Create test Google Form
- [ ] Install Apps Script
- [ ] Submit test form
- [ ] Verify execution created
- [ ] Verify toast notification appears
- [ ] Test edge cases (invalid token, inactive workflow, etc.)

---

## Configuration Reference

### Environment Variables

**Backend:** `backend/.env`
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/HRFlow?schema=Core"
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_n8n_api_key
N8N_POSTGRES_CREDENTIAL_ID=credential_id_from_n8n
N8N_SMTP_CREDENTIAL_ID=credential_id_from_n8n
WEBHOOK_SECRET_KEY=your-random-secret-here  # NEW
```

### API Endpoints

**Webhook Endpoint:**
```
POST http://localhost:4000/webhooks/google-form/:workflowId?token={WEBHOOK_SECRET_KEY}

Content-Type: application/json

Body:
{
  "Name": "John Doe",
  "Email": "john@example.com",
  "Department": "Engineering",
  "Role": "Software Engineer",
  "Start Date": "2024-01-15",
  "Manager Email": "manager@example.com",
  "Custom Field": "Custom Value"
}

Response (202 Accepted):
{
  "success": true,
  "message": "Workflow execution started",
  "executionId": 123
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token
- `400 Bad Request`: Invalid workflowId or inactive workflow
- `404 Not Found`: Workflow not found
- `500 Internal Server Error`: Server error (check logs)

---

## Troubleshooting

### Webhook returns 401 Unauthorized
- Verify `WEBHOOK_SECRET_KEY` is set in `backend/.env`
- Verify token in URL matches the env variable exactly
- Check backend logs for "[GoogleFormWebhook] Invalid or missing token"

### Webhook returns 404 Not Found
- Verify workflow exists in database: `SELECT * FROM workflows WHERE id = X`
- Verify workflowId in URL is correct integer

### Webhook returns 400 "Workflow is not active"
- Activate workflow: `UPDATE workflows SET is_active = true WHERE id = X`
- Or run workflow once from UI (auto-activates)

### Form submission doesn't trigger workflow
- Check Google Apps Script logs: Apps Script Editor → Executions (⏱️ icon)
- Verify trigger is installed: Triggers (⏰ icon) should show "onFormSubmit"
- Verify script has correct webhook URL (copy from HRFlow UI)
- Check backend logs for webhook request
- Test webhook directly with curl first

### Toast notifications don't appear
- Check browser console for errors
- Verify `Toaster` component is rendered in App.tsx
- Verify polling is running (Network tab should show /api/executions every 15s)
- Check localStorage for `hrflow_last_seen_execution_id` (should increment)
- Try clearing localStorage and refreshing

### Fields not mapped to employee structure
- Verify field names match exactly (case-insensitive):
  - "Name" or "Full Name" → employee.name
  - "Email" → employee.email
  - etc.
- Check backend logs for "[GoogleFormWebhook] Normalized data" to see mapping result
- Custom fields should appear in top-level object (not in employee.*)

---

## Future Enhancements

**Out of scope for MVP:**
- Copy buttons for webhook URL and Apps Script (can select and Ctrl+C for now)
- Per-workflow webhook tokens (single global token simpler for MVP)
- Manual field mapping UI (automatic normalization sufficient)
- Webhook signature validation (token in URL good enough for MVP)
- Rate limiting (not critical for internal use)
- User-configurable notification settings (polling is always on)
- Notification deduplication (handled by localStorage tracking)

**Possible future additions:**
- Other trigger types: Scheduled (cron), Email, API webhook
- Webhook retry logic (currently fire-and-forget)
- Webhook delivery logs/history
- Form submission history view in UI
- Test webhook button in UI
- Webhook URL regeneration (if token changes)

---

## Summary

This plan provides a complete, production-ready implementation of Google Form triggers for HRFlow with:

✅ Secure webhook authentication via global API key
✅ Automatic field normalization with pass-through for custom fields
✅ Real-time execution notifications via Sonner toast
✅ Clean trigger configuration UI with syntax-highlighted Apps Script
✅ Comprehensive error handling and validation
✅ Full testing strategy with edge cases

**Total implementation time:** ~8-12 hours
- Backend: 2-3 hours
- Frontend Config: 3-4 hours
- Notifications: 2-3 hours
- Testing: 1-2 hours

All architecture decisions are documented and validated. Ready for implementation.
