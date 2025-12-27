# Google Form Trigger Integration Plan

## Objective

Enable workflows to be triggered by a Google Form submission. This provides a user-friendly way to collect input (e.g., candidate details) that automatically starts an HRFlow workflow.

## User Experience

1.  **Workflow Builder**:
    - User selects the **Trigger** node.
    - In the configuration panel, selects **Trigger Source**: `Manual` (default) or `Google Form`.
    - If `Google Form` is selected, the UI displays:
      - **Webhook URL**: The URL to send form data to (e.g., `https://api.hrflow.com/api/webhooks/google-form/:workflowId`).
      - **Setup Instructions**: A snippet of Google Apps Script code to copy-paste into the Google Form's script editor.
2.  **Google Form**:
    - User creates a form with fields (Name, Email, Role, etc.).
    - User adds the provided script to the form.
    - On submission, the script sends a POST request to the HRFlow Webhook.
3.  **Execution & Notification**:
    - The workflow runs automatically upon form submission.
    - **Admin Notification**: If the admin is on the HRFlow dashboard, a polling mechanism (or WebSocket if available) triggers a "New Execution Started" toast/popup.

## Technical Architecture

### 1. Backend: Webhook Endpoint

We need a dedicated/specialized webhook endpoint to handle Google Form payloads, which might need normalization.

- **Endpoint**: `POST /api/webhooks/google-form/:workflowId`
- **Controller Logic**:
  - validate `workflowId`.
  - Extract data from body (Google Forms/Apps Script usually sends JSON if we write the script that way).
  - Normalize keys (e.g., lowercase, remove spaces) to match `employee` schema if possible, or store as raw `input`.
  - Call `executionService.executeWorkflow({ triggerType: 'google_form', input: ... })`.

### 2. Frontend: Trigger Configuration

- **Component**: `ConfigPanel.tsx` (for Trigger node).
- **New State**: `triggerSource` ('manual' | 'google_form').
- **UI Elements**:
  - Dropdown for Source.
  - **Code Block**: Display the Apps Script snippet dynamically (inserting the correct Webhook URL).

#### Apps Script Snippet Template

```javascript
function onFormSubmit(e) {
  var url = "YOUR_WEBHOOK_URL_HERE";
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

  UrlFetchApp.fetch(url, options);
}
```

### 3. Frontend: Real-time Notifications

Since we don't have WebSockets set up, we will implementation **Short Polling** for the MVP.

- **Hook**: `useExecutionPoller.ts`
- **Logic**:
  - Poll `GET /api/executions?limit=1` every 10-30 seconds.
  - Keep track of the `lastKnownExecutionId`.
  - If a newer ID appears, show a Toast notification: "New Workflow Execution: [Workflow Name]".
- **Global Provider**: Wrap the app (or Dashboard layout) in a context that handles this polling so it works on any page.

### 4. Data Normalization Strategy

Google Form fields are loose (e.g. "What is your name?").

- **Approach**: We simply pass the raw keys (`{"What is your name?": "Talal"}`) to n8n as `input`.
- **Usage**: The user will map these in subsequent nodes using n8n expressions like `{{trigger["What is your name?"]}}`.
- **Enhancement**: We can suggest/recommend standard field names ("Name", "Email") in the UI instructions to make mapping easier.

## Implementation Steps

### Phase 1: Backend Webhook

1.  Create `googleFormController.ts`.
2.  Add route `POST /webhooks/google-form/:workflowId`.
3.  Implement payload parsing and `executeWorkflow` call.

### Phase 2: Frontend Config

1.  Update `ConfigPanel` for Trigger node.
2.  Add "Google Form" option.
3.  Render the Code Snippet with `Copy` button.

### Phase 3: Notification System

1.  Create `ExecutionNotificationContext.tsx`.
2.  Implement polling logic.
3.  Add Toast component (if not exists) or use `sonner`/`react-hot-toast`.

## Verification

- Create a test Google Form.
- Add the script.
- Submit form.
- Verify execution appears in HRFlow list.
- Verify popup appears (if polling is active).
