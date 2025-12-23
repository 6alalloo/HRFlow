# Google Form Admin Setup Guide

This guide walks administrators through the one-time setup required to enable Google Form integration with HRFlow.

## Overview

The Master Form architecture uses a single, standardized Google Form that serves all workflows. Each workflow is triggered by including a unique Workflow ID in the form URL. This approach provides:

- **Consistent Branding**: Candidates always see the same professional form
- **Zero Operator Effort**: Workflow builders just copy a pre-configured link
- **Reliable Data**: Standardized field names ensure consistent variable access

---

## Prerequisites

Before starting, ensure you have:

1. **Google Account** with access to Google Forms
2. **Admin Access** to the HRFlow backend server
3. **WEBHOOK_SECRET_KEY** configured in your backend `.env` file

---

## Step 1: Create the Master Form

1. Go to [Google Forms](https://forms.google.com)
2. Create a new blank form
3. Name it something like "HRFlow Application Form" or your company's preferred name

### Required Fields

Add these fields to your form (exact names matter for normalization):

| Field Name | Field Type | Notes |
|------------|------------|-------|
| **Full Name** | Short answer | Maps to `{{trigger.name}}` |
| **Email** | Short answer | Maps to `{{trigger.email}}` |
| **Phone Number** | Short answer | Maps to `{{trigger.phone}}` |
| **Department** | Dropdown/Multiple choice | Maps to `{{trigger.department}}` |
| **Position** | Short answer | Maps to `{{trigger.role}}` |
| **Resume** | File upload | Maps to `{{trigger.resume_url}}` |
| **Start Date** | Date | Maps to `{{trigger.start_date}}` |
| **Workflow ID** | Short answer | **CRITICAL** - Used to route to correct workflow |

### Field Naming Tips

The backend uses fuzzy matching, so these variations also work:
- "Your Name", "Candidate Name" → `name`
- "Email Address", "Your Email" → `email`
- "Mobile", "Contact Number" → `phone`
- "Team", "Division" → `department`
- "Job Title", "Job Position" → `role`
- "CV", "Upload Resume" → `resume_url`
- "Join Date", "Joining Date" → `start_date`

### Workflow ID Field Setup

The "Workflow ID" field is special:
1. Add it as a **Short answer** field
2. Mark it as **Required**
3. Consider placing it at the end of the form
4. It will be pre-filled via URL parameter when operators share the form

---

## Step 2: Get the Form Entry ID for Workflow ID

To pre-fill the Workflow ID via URL, you need the entry ID:

1. Click the **Preview** button (eye icon) to open your form
2. Right-click on the Workflow ID input field
3. Select **Inspect** (opens Developer Tools)
4. Look for the `name` attribute on the input element
5. It will look like: `entry.1234567890`
6. Copy the entire value including "entry."

**Example**: If the name is `entry.1892746352`, your pre-fill URL parameter will be `&entry.1892746352=WORKFLOW_ID`

---

## Step 3: Install the Universal Script

1. Open your Master Form in edit mode
2. Click the **three dots menu** (⋮) → **Script editor**
   - Or: Extensions → Apps Script
3. Delete any existing code in the editor
4. Copy the entire contents of `docs/universal_google_form_script.js`
5. Paste into the script editor
6. **Update the configuration section** at the top:

```javascript
// ==================== CONFIGURATION ====================
const BACKEND_URL = "https://your-production-url.com";  // Change this!
const WEBHOOK_TOKEN = "your-webhook-secret-key-here";   // Change this!
const WORKFLOW_ID_FIELD = "Workflow ID";                // Must match your form
// ==================== END CONFIGURATION ====================
```

7. Save the script (Ctrl+S / Cmd+S)

---

## Step 4: Set Up the Trigger

1. In the Apps Script editor, click the **Triggers** icon (clock/alarm icon in left sidebar)
2. Click **+ Add Trigger**
3. Configure as follows:
   - **Choose which function to run**: `onFormSubmit`
   - **Choose which deployment should run**: Head
   - **Select event source**: From form
   - **Select event type**: On form submit
4. Click **Save**
5. Grant the required permissions when prompted
   - The script needs permission to send HTTP requests

---

## Step 5: Configure Backend Environment

Ensure your backend `.env` file has:

```bash
# Webhook security token - must match WEBHOOK_TOKEN in Apps Script
WEBHOOK_SECRET_KEY=your-secure-random-token-here

# Google Form configuration
GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform
GOOGLE_FORM_WORKFLOW_ENTRY_ID=entry.1892746352
```

### Generating a Secure Token

```bash
# Generate a secure random token
openssl rand -hex 32
```

Copy this value to both:
1. Your `.env` file as `WEBHOOK_SECRET_KEY`
2. The Apps Script as `WEBHOOK_TOKEN`

---

## Step 6: Test the Integration

### Test the Script Configuration

1. In Apps Script, run the `testConfiguration` function
2. Check the Logs (View → Logs) for results
3. Verify backend connectivity shows "OK"

### Test a Form Submission

1. Create a test workflow in HRFlow
2. Note the workflow ID (visible in URL when editing)
3. Construct a test URL:
   ```
   https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.XXXXX=WORKFLOW_ID
   ```
4. Open the URL and submit the form
5. Check HRFlow Executions page - you should see a new execution

### Check Apps Script Logs

1. Go to Apps Script → Executions (left sidebar)
2. Find your recent execution
3. Click to view logs
4. Look for "SUCCESS" or "ERROR" messages

---

## Troubleshooting

### "Workflow ID not found in form submission"
- Ensure the form has a field exactly named as configured in `WORKFLOW_ID_FIELD`
- Check that the field is being pre-filled via URL parameter
- Verify the entry ID in your URL matches the actual form field

### "Unauthorized: Invalid or missing token"
- Verify `WEBHOOK_TOKEN` in script matches `WEBHOOK_SECRET_KEY` in backend
- Check for typos or extra whitespace
- Regenerate both tokens if uncertain

### "Workflow not found" (404)
- Verify the workflow ID exists in HRFlow
- Check the workflow is saved and has a trigger node
- Ensure the workflow ID is a valid number

### "Workflow is not active" (400)
- Activate the workflow in HRFlow before testing
- Toggle the workflow status to "Active"

### Script doesn't run on submit
- Verify the trigger is configured correctly
- Check that authorization was granted
- Look for errors in Apps Script → Executions

### No execution appears in HRFlow
- Check Apps Script logs for errors
- Verify backend is running and accessible
- Check backend logs for incoming requests
- Ensure CORS/firewall allows requests from Google

---

## Operator Instructions

Once setup is complete, operators only need to:

1. Create/edit a workflow in HRFlow
2. Select "Google Form" as the trigger source
3. Copy the pre-generated form link
4. Share the link with candidates

The form link automatically includes the workflow ID, so candidates' submissions route to the correct workflow.

---

## Security Notes

- The `WEBHOOK_SECRET_KEY` prevents unauthorized workflow triggers
- Only share the token with admins who need Apps Script access
- Rotate the token periodically by updating both backend and script
- The token is visible in the script, so limit Apps Script editor access

---

## Updating the Script

If you need to update the script later:

1. Open the form → Script editor
2. Make your changes
3. Save the script
4. No need to reconfigure the trigger - it persists

---

## Support

For issues with:
- **HRFlow Backend**: Check backend logs at `/api/health`
- **Apps Script**: Check Executions tab for error logs
- **Form Configuration**: Verify field names match expected patterns
