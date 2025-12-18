# UI Overhaul: Workflows & Details

## 1. Goal

Create a premium, split-screen "Master-Detail" interface for managing workflows. This replaces the current tabular list with a modern dashboard inspired by the provided "Dark Mode" mockups.

## 2. Page Structure (`/workflows`)

We will use a **Master-Detail Layout** (Split View) on Desktop, which collapses to a Stacked Navigation on Mobile.

### **A. Left Pane: Workflow List (The "Master")**

- **Header**: "Workflows" Title + "Create New" Button (Icon only or small button).
- **Search & Filter**:
  - Search bar (Text input with glass style).
  - Filter Tabs/Pills: `All`, `Active`, `Paused` (Inactive), `Draft`.
- **List Items**:
  - Cards representing each workflow.
  - **Content**: Name, Status Dot (Green/Yellow/Grey), Arrow/Chevron.
  - **Interaction**: Clicking a card sets it as "Active" in the Right Pane.

### **B. Right Pane: Workflow Details (The "Detail")**

- **Empty State**: "Select a workflow to view details" (with a "Create New" CTA).
- **Detail View** (when a workflow is curated):
  1.  **Header**:
      - **Title**: Large distinct workflow name.
      - **Actions**:
        - `Open Builder` (Primary CTA): Navigates to `/workflows/:id/builder`.
        - `Run` (Secondary/Accent CTA): Opens the "Run Manual" modal.
        - `Menu (...)`: Rename, Delete, Duplicate.
  2.  **Stats Row** (Quick Health Check):
      - _Calculated from recent executions (frontend) or new API endpoint_.
      - 📅 **Last Run**: Relative time (e.g., "2 hours ago").
      - 📈 **Success Rate**: % of successful runs (Green/Red text).
      - ⏱️ **Avg Duration**: e.g., "1m 30s".
  3.  **Recent Activity (Executions)**:
      - A list of the last 5-10 executions.
      - **Content**: Status Icon, Trigger Type (Manual/Webhook), Date, Duration.
      - **Action**: Clicking an item navigates to `/executions/:id` (The Execution Details Page).
      - _Note: The mock showed "Steps" of a single execution. We will show a list of Executions here instead, as this is the Workflow overview._

## 3. Component Architecture

```
src/pages/Workflows/
├── components/
│   ├── WorkflowListSidebar.tsx   // The Left Pane
│   ├── WorkflowCard.tsx          // Individual List Item
│   ├── WorkflowDetailPanel.tsx   // The Right Pane
│   ├── StatsMetrics.tsx          // The 3 cards (Last Run, Success %, Time)
│   └── ExecutionsList.tsx        // Recent runs list
├── WorkflowLayout.tsx            // The Split-Screen Shell
└── index.tsx                     // Route container
```

## 4. Technical gaps & Questions

> [!IMPORTANT] > **Data Fetching**: The current `fetchWorkflows` API returns basic metadata. To populate the **Stats** and **Recent Activity**, we will need to:
>
> 1.  Fetch `executions` for the selected workflow when it is clicked.
> 2.  Calculate stats client-side (MVP) or request a backend aggregation endpoint.

> [!NOTE] > **Mobile Responsiveness**: On small screens, the "Right Pane" will overlay the list, or we use standard router navigation (`/workflows` -> `/workflows/:id`).

## 5. Visual Style

- **Colors**: `bg-navy-950` background, `slate-800/50` for cards.
- **Typography**: Inter/Manrope. Large headers for the selected workflow.
- **Accents**: `cyan-500` for active elements, `emerald-500` for success, `rose-500` for failure.
