# Deep Google Forms Integration Plan

To achieve a seamless "Google Forms" experience where the form feels part of the workflow (and not just a disconnected link), we must leverage the **Google Forms API**.

This approach allows HRFlow to:

1.  **Create Forms Automatically**: When you add a Trigger, HRFlow creates the Google Form for you.
2.  **Sync Fields**: When you change inputs in HRFlow, HRFlow updates the Google Form questions.
3.  **Auto-Link**: No copy-pasting scripts. HRFlow sets up the "Watch" (webhook) automatically.

## Architecture

### 1. Google Cloud Setup (One-time Admin)

- **Project**: Create a Google Cloud Project.
- **APIs**: Enable `Forms API`, `Drive API`, `Cloud Pub/Sub API`.
- **OAuth**: Create OAuth 2.0 Credentials (Client ID & Secret).
- **Pub/Sub**: Create a generic "Form Responses" topic that HRFlow listens to.

### 2. Authentication (User Flow)

We need a "Connect Google Account" button in the HRFlow Settings or Trigger Panel.

- **Flow**: OAuth2 Authorization Code flow.
- **Scopes**: `https://www.googleapis.com/auth/forms.body`, `https://www.googleapis.com/auth/forms.responses.readonly`.
- **Storage**: Store the user's `access_token` and `refresh_token` securely in `users` table.

### 3. Workflow Builder Integration

#### Creating the Trigger

- User selects "Google Form" trigger.
- **Action**: HRFlow backend calls `POST https://forms.googleapis.com/v1/forms` to create a new form titled "HRFlow: [Workflow Name]".
- **Action**: HRFlow saves the `formId` and `responderUri` (public link) to the `workflow_nodes` config.

#### Syncing Questions

- User defines fields in HRFlow Trigger (e.g. "Candidate Name", "Resume").
- **Action**: HRFlow calls `BATCH UPDATE` on the Form API to create/update Items (Questions) matching these fields.
  - _Text Input_ -> _TextQuestion_
  - _File Upload_ -> _FileUploadQuestion_ (Requires Drive folder)

#### Handling Responses (The "Trigger")

Instead of Apps Script, we use **Watches**.

- **Setup**: HRFlow calls `POST /v1/forms/{formId}/watches` to subscribe to the form.
- **Webhook**: Google publishes events to Cloud Pub/Sub.
- **Ingestion**:
  1.  HRFlow Backend has a listener (or webhook endpoint) for Pub/Sub.
  2.  Receives "New Response" notification.
  3.  Calls `GET /v1/forms/{formId}/responses/{responseId}` to fetch the actual data.
  4.  Triggers the `executionService`.

## Pros & Cons

| Feature            | Script Method (Current) | Deep API Integration (Proposed)            |
| :----------------- | :---------------------- | :----------------------------------------- |
| **Setup Friction** | High (Copy-paste code)  | **Zero (One-click login)**                 |
| **Maintenance**    | High (Field mismatch)   | **Zero (Auto-sync)**                       |
| **Dev Effort**     | Low (Done)              | **Very High** (OAuth, API Sync, Pub/Sub)   |
| **Prerequisites**  | None                    | **Google Cloud Project, App Verification** |

## Implementation Roadmap

1.  **Auth System**: Implement `passport-google-oauth20` or manual OAuth flow in `authController`.
2.  **Google Client**: Create `GoogleFormsService` wrapper for the REST API.
3.  **Sync Engine**: Logic to diff HRFlow config vs Google Form questions and issue patch updates.
4.  **Webhooks**: Setup Pub/Sub listener logic.

> [!WARNING]
> This requires your Google App to be "Verified" by Google if you want to use it with any Google account other than your own test account. For a personal tool, you can stay in "Testing" mode.
