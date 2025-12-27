/**
 * Universal HRFlow Google Form Webhook Script
 *
 * This script handles form submissions and sends data to the HRFlow backend.
 * It extracts the Workflow ID from a form field, allowing one Master Form to
 * trigger multiple different workflows.
 *
 * ONE-TIME SETUP (Admin Only):
 * 1. Open your Master Form in Google Forms
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code in the editor
 * 4. Paste this entire script
 * 5. Save the script (Ctrl+S / Cmd+S)
 * 6. Click the Triggers icon (clock/alarm icon on left sidebar)
 * 7. Click "+ Add Trigger" button
 * 8. Configure trigger:
 *    - Choose which function to run: onFormSubmit
 *    - Select event source: From form
 *    - Select event type: On form submit
 * 9. Click Save and authorize when prompted
 *
 * IMPORTANT: Your Master Form must have a "Workflow ID" field.
 * This field should be hidden/pre-filled via URL parameter when sharing the form.
 *
 * Example form URL with pre-filled Workflow ID:
 * https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url&entry.XXXXX=42
 * (where entry.XXXXX is the entry ID for the Workflow ID field)
 */

// ==================== CONFIGURATION ====================
// Update these values for your environment

/**
 * Your HRFlow backend URL
 * - Local development: "http://localhost:4000"
 * - Serveo tunnel (for Google Forms): "https://hrflowautomation.serveousercontent.com"
 * - Production: "https://your-hrflow-domain.com"
 */
const BACKEND_URL = "https://hrflowautomation.serveousercontent.com";

/**
 * Webhook security token
 * This MUST match the WEBHOOK_SECRET_KEY value in your backend .env file
 * Default development token is shown below - change this in production!
 */
const WEBHOOK_TOKEN = "e042b7a3afd480f7966c985ea71e9d254ec5f0a258596b0ddee424d91b9c3e6e";

/**
 * The exact title of the Workflow ID field in your form
 * This field should contain the numeric workflow ID to trigger
 */
const WORKFLOW_ID_FIELD = "Workflow ID";

// ==================== END CONFIGURATION ====================


/**
 * Main form submission handler
 * Triggered automatically when someone submits the form
 *
 * @param {Object} e - Form submit event object
 */
function onFormSubmit(e) {
  try {
    // Build payload from form responses
    var payload = {};
    var workflowId = null;

    // Get all item responses from the submission
    var itemResponses = e.response.getItemResponses();

    for (var i = 0; i < itemResponses.length; i++) {
      var itemResponse = itemResponses[i];
      var title = itemResponse.getItem().getTitle();
      var response = itemResponse.getResponse();

      // Extract workflow ID from the designated field
      if (title === WORKFLOW_ID_FIELD) {
        workflowId = response;
        // Don't include workflow ID in payload - it goes in the URL
        continue;
      }

      // Handle file uploads
      // Google Forms returns file IDs as an array for file upload questions
      if (Array.isArray(response)) {
        // For file uploads, response is array of file IDs
        // Join multiple file IDs with comma if multiple files uploaded
        payload[title] = response.join(',');
      } else {
        // Regular text/choice responses
        payload[title] = response;
      }
    }

    // Add respondent email if form is configured to collect it
    var respondentEmail = e.response.getRespondentEmail();
    if (respondentEmail) {
      payload["Email"] = respondentEmail;
    }

    // Add timestamp of submission
    payload["_submitted_at"] = new Date().toISOString();

    // Validate that we have a workflow ID
    if (!workflowId) {
      Logger.log("ERROR: Workflow ID field not found or empty in form submission");
      Logger.log("Expected field name: " + WORKFLOW_ID_FIELD);
      Logger.log("Available fields: " + itemResponses.map(function(r) { return r.getItem().getTitle(); }).join(", "));
      return;
    }

    // Validate workflow ID is a number
    var workflowIdNum = parseInt(workflowId, 10);
    if (isNaN(workflowIdNum)) {
      Logger.log("ERROR: Workflow ID must be a number. Received: " + workflowId);
      return;
    }

    // Construct the webhook URL
    // FIXED: Webhooks are mounted at root /webhooks, not /api/webhooks
    var webhookUrl = BACKEND_URL + "/webhooks/google-form/" + workflowIdNum + "?token=" + WEBHOOK_TOKEN;

    // Log what we're about to send (for debugging)
    Logger.log("Sending to workflow " + workflowIdNum);
    Logger.log("Webhook URL: " + webhookUrl);
    Logger.log("Payload: " + JSON.stringify(payload));

    // Send POST request to HRFlow backend
    var options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true  // Don't throw on HTTP errors, let us handle them
    };

    var response = UrlFetchApp.fetch(webhookUrl, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    // Log the result
    if (statusCode >= 200 && statusCode < 300) {
      Logger.log("SUCCESS: Workflow " + workflowIdNum + " triggered successfully");
      Logger.log("Response: " + responseText);
    } else {
      Logger.log("ERROR: Workflow trigger failed");
      Logger.log("Status Code: " + statusCode);
      Logger.log("Response: " + responseText);
    }

  } catch (error) {
    Logger.log("EXCEPTION: " + error.toString());
    Logger.log("Stack: " + error.stack);
  }
}


/**
 * Test function - run this manually to verify configuration
 * Go to Apps Script Editor > Run > testConfiguration
 */
function testConfiguration() {
  Logger.log("=== HRFlow Configuration Test ===");
  Logger.log("Backend URL: " + BACKEND_URL);
  Logger.log("Token configured: " + (WEBHOOK_TOKEN ? "Yes" : "No"));
  Logger.log("Workflow ID Field: " + WORKFLOW_ID_FIELD);

  // Test connectivity to backend
  try {
    var testUrl = BACKEND_URL + "/health";
    var response = UrlFetchApp.fetch(testUrl, { "muteHttpExceptions": true });
    Logger.log("Backend connectivity: " + (response.getResponseCode() === 200 ? "OK" : "Failed - " + response.getResponseCode()));
  } catch (e) {
    Logger.log("Backend connectivity: Failed - " + e.toString());
  }

  Logger.log("=== Test Complete ===");
}
