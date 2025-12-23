# Proposal: Native HRFlow Public Forms

## The Problem

The current Google Form integration has significant friction:

1.  **High Setup Cost**: User must copy-paste Apps Scripts, configure triggers, and deal with authentication tokens manually.
2.  **Disconnected Workflow**: The form is separate from HRFlow. If you update the workflow to need a new field (e.g., "LinkedIn URL"), the Google Form doesn't update automatically. You have to go edit the Google Form to match.
3.  **Testing Friction**: You cannot easily test the workflow "end-to-end" without submitting a real external form.

## The Solution: Native Auto-Generated Forms

Instead of relying on Google Forms, HRFlow can **auto-generate a public form** based on your Trigger Node configuration.

### How it works

1.  **Define Inputs**: In the Trigger Node, you list the fields you need (e.g., `Full Name`, `Email`, `Resume (File)`).
2.  **Instant Public Link**: HRFlow instantly provides a public link: `https://hrflow.app/forms/workflow-123`.
3.  **Zero Setup**: No scripts, no webhooks, no manual wiring.
4.  **Always Synced**: If you add a "Phoenix Phone Number" field to the Trigger in the builder, the Public Form updates **instantly**.

### Comparison

| Feature          | Current (Google Form via Script)          | Proposed (Native HRFlow Form)          |
| :--------------- | :---------------------------------------- | :------------------------------------- |
| **Setup**        | Hard (Copy code, setup triggers)          | **Zero (Automatic)**                   |
| **Sync**         | Manual (Must edit Form to match Workflow) | **Automatic (Form reflects Workflow)** |
| **File Uploads** | Hard (Requires Drive permissions)         | **Built-in (Direct to HRFlow)**        |
| **Styling**      | Google Branding                           | **HRFlow Premium UI (Glassmorphism)**  |
| **Validation**   | Basic                                     | **Advanced (Typed inputs)**            |

## Implementation Plan

### 1. Unified Trigger Configuration

Update `ConfigPanel.tsx` for the Trigger node.
Instead of "Manual vs Google Form", we simply have **"Input Fields"**.

- User adds/removes fields.
- Types: Text, Email, Number, File, Date.

### 2. Public Form Page

Create a new route: `/public/forms/:workflowId`.

- Fetches the Workflow and its Trigger Node config.
- Renders a beautiful, standalone form page.
- Submits directly to `POST /api/executions`.

### 3. Builder Integration

In the Builder, show a **"View Public Form"** button.
This solves the user's issue: _"chances are you havent finished setting up your entire workflow yet"_.
With Native Forms, the form is _part_ of the workflow setup. As you build, the form builds itself.

### FAQ

**"Can I still use Google Forms?"**
Yes. We will keep the "Webhook" option for advanced users who strictly require Google Forms (e.g. for corporate policy). But the default recommended path will be the Native Form.
