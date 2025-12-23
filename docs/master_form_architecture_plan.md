# Master Google Form Architecture & Implementation Plan

## 1. Executive Summary

We are shifting from a "Per-Workflow Form" model to a **"Master Form" Architecture**.
Instead of creating a new Google Form for every workflow, the organization will use **one single, standardized Google Form** as the entry point for all workflows.

HRFlow will differentiate between workflows using a unique **Workflow ID** hidden in the link, which the Master Form forwards to the system.

### Core Philosophy

- **One Front Door:** Candidates always see the same branded, standardized form.
- **Zero-Code for Operators:** Workflow builders never touch Google Apps Script. They just copy a link.
- **Semantic Consistency:** "Full Name" always maps to `{{trigger.name}}`, ensuring reliable data downstream.

---

## 2. Architecture & Flow

### A. The Components

1.  **The Master Form (Google)**

    - Exists permanently on the user's Google Drive.
    - Contains the "Super Set" of all necessary fields (Name, Email, Resume, Role, etc.).
    - Has **ONE** Google Apps Script attached that pushes data to HRFlow.

2.  **The Trigger Node (HRFlow)**

    - Configured to "Google Form".
    - No longer asks for script setup.
    - **Action:** Generates a unique **Pre-filled URL** (`.../viewform?entry.123=WORKFLOW_CUSTOM_ID`).

3.  **The Normalizer (Backend)**
    - Receives the raw webhook from Google.
    - Looks up the Workflow by ID.
    - **Maps** loose form labels ("Your Full Name") to strict internal keys (`name`).

### B. User Journey

#### 1. Integration Setup (One-Time Admin Task)

- Admin creates the "HRFlow Master Form".
- Admin adds the inputs: Name, Email, Phone, Dept, Role, Resume (file upload), Start Date.
- Admin adds a **"Workflow ID"** field (Short Answer).
- Admin adds the **Universal Webhook Script** to the form.
- Admin gets the "Get pre-filled link" URL for the "Workflow ID" field.
- Admin saves this `FORM_BASE_URL` and `WORKFLOW_ID_ENTRY_ID` in the HRFlow `.env`.

#### 2. Building a Workflow (Daily Operator Task)

- Operator creates "Marketing Internship Workflow".
- Adds Trigger: "Google Form".
- **UI Shows:** "Share this link with candidates: `https://forms.gle/abc...?entry.999=55`"
- Operator builds the rest of the flow using `{{trigger.name}}` (which they know exists).

#### 3. Execution (Candidate Experience)

- Candidate clicks the link.
- Google Form opens.
- _Crucial:_ The "Workflow ID" field is pre-filled with `55`. (Ideally hidden or visually ignored).
- Candidate fills Name: "Alice", Email: "alice@ex.com".
- Submits.
- HRFlow executes Workflow #55 with variables `{ name: "Alice", email: "alice@ex.com" }`.

---

## 3. Semantics & Data Mapping

To ensure the "flow makes sense" in the builder, we must guarantee that the Google Form data always matches the expected HRFlow variables.

### The Standard Schema

We will enforce a **"Soft Schema"** in the backend Normalizer. The backend will fuzzy-match common Google Form labels to strict internal variable names.

| Google Form Label (Variations)    | Internal Variable (`trigger.xyz`) | Type                |
| :-------------------------------- | :-------------------------------- | :------------------ |
| `Full Name`, `Name`, `Your Name`  | `name`                            | String              |
| `Email`, `Email Address`          | `email`                           | String              |
| `Phone`, `Phone Number`, `Mobile` | `phone`                           | String              |
| `Department`, `Team`              | `department`                      | String              |
| `Role`, `Job Title`, `Position`   | `role`                            | String              |
| `Resume`, `CV`, `Upload Resume`   | `resume_url`                      | String (Drive Link) |
| `Start Date`                      | `start_date`                      | Date                |

**Why this matters:**
This allows the variable picker in the frontend to safely show `{{trigger.name}}` even before a single form is submitted, because we _know_ the Master Form provides it.

---

## 4. Implementation Plan

### Step 1: Backend Normalization Logic

**File:** `backend/src/controllers/googleFormController.ts`

- Update `normalizeGoogleFormData` to be more aggressive / intelligent.
- It should take the raw keys (e.g. "What is your name?") and normalize to `name`.
- Support nested/complex keys if necessary.

### Step 2: Environment Configuration

**File:** `backend/.env`

- Add `GOOGLE_FORM_BASE_URL`: The long URL of the Master Form.
- Add `GOOGLE_FORM_WORKFLOW_ID_ENTRY`: The specific "Entry ID" for the Workflow ID field (e.g. `entry.116395526`).
- HRFlow uses these to generate the unique links.

### Step 3: Frontend Trigger UX

**File:** `frontend/src/components/builder/ConfigPanel.tsx`

- **Remove:** The "Step 1, Step 2" script copy-paste instructions.
- **Add:** A "Link Generator" section.
  - Reads `env.GOOGLE_FORM_BASE_URL`.
  - Appends `?entry.XXX={workflowId}`.
  - Shows a "Copy Link" button.
- **Add:** A "Schema Preview" section showing the user: _"This workflow expects Name, Email, Role from the master form."_

### Step 4: Variable Picker Update

**File:** `frontend/src/components/builder/VariablePicker.tsx`

- Update the `trigger` section to explicitly list the Standard Schema variables (`name`, `email`, etc.) instead of generic "Body".

### Step 5: The Universal Sidecar Script

**Deliverable:** A single JavaScript block for the user to put in the Master Form.

- It must gracefully handle the "Workflow ID" extraction.
- It must POST to the `webhooks/google-form` endpoint.
- It must handle File Uploads (Google Forms returns Drive IDs, we might need to convert to links or handle auth). _For V1, we will just pass the Drive Link string._

---

## 5. Deployment Guide (for you)

Once implemented, you (the user) will do this **exact sequence** to migrate:

1.  **Create your Master Form** in Google Forms.
2.  Add the standard questions.
3.  **Get the Pre-fill ID:**
    - In Google Forms: Click 3 dots -> "Get pre-filled link".
    - Fill in "123" for Workflow ID. Click "Get Link".
    - Copy the link. Find the part that says `entry.XXXXX=123`.
    - That `XXXXX` number is your `GOOGLE_FORM_WORKFLOW_ID_ENTRY`.
4.  **Update .env**:
    - Set `GOOGLE_FORM_BASE_URL` to your form link (e.g. `https://docs.google.com/forms/d/e/.../viewform`).
    - Set `GOOGLE_FORM_WORKFLOW_ID_ENTRY` to the number found above.
5.  **Install Script**: Paste the Universal Script into the Form's Script Editor.

**Result:** A permanent, robust integration that requires zero maintenance for future workflows.
