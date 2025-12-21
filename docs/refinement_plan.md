# HRFlow Refinement & Remediation Plan

Based on testing feedback (Dec 21, 2025), the following tasks have been identified to prepare the system for production readiness.

## 🚨 Critical Items

- [ ] **Investigate "Templates Not Working"**

  - **Context**: User reported templates are broken.
  - **Action**: Verify template instantiation API payload and frontend state handling. (Note: Auth fix might have resolved this, but needs re-verification).
  - **Target**: `TemplateSelectionModal.tsx`, `workflows.ts` (API)

- [ ] **Missing Audit Logs**
  - **Context**: Critical actions are not being logged.
  - **Action**: Add `auditLogService.log()` calls to backend controllers:
    - `Login` (authController)
    - `Workflow Deleted` (workflowController)
    - `Execution Started` (executionController)
    - `Execution Deleted` (executionController?)
  - **Target**: Backend Controllers

## 🛠 Feature Gaps & Data Integration

- [ ] **Real Data in Workflows List (Left Panel)**

  - **Context**: Timestamps/metadata are hardcoded.
  - **Action**: Bind `updated_at` and `status` to real data in `WorkflowListSidebar`.
  - **Target**: `WorkflowListSidebar.tsx`

- [ ] **Real Data in Workflow Details (Right Panel)**

  - **Context**: "System Configuration" and ID fields are hardcoded.
  - **Action**: Connect `selectedWorkflow` data to the details view components.
  - **Target**: `WorkflowSplitLayout.tsx`

- [ ] **Security: Delete Domain**
  - **Context**: UI missing delete option.
  - **Action**: Verify API supports DELETE. Add "Trash" icon/button to domain list items.
  - **Target**: `SecurityPage.tsx`

## 🎨 UI/UX Polish

- [ ] **Visual Improvement: Templates**

  - **Action**: Enhance `TemplateSelectionModal` cards (better spacing, icons, hover states).
  - **Target**: `TemplateSelectionModal.tsx`

- [ ] **Visual Improvement: Execution Filter Buttons**

  - **Action**: Style filter chips to be "pills" or properly active/inactive states instead of "small caps boxes".
  - **Target**: `ExecutionListPage.tsx`

- [ ] **Visual Improvement: Execution Details**

  - **Action**: Refine layout, spacing, and JSON viewer presentation.
  - **Target**: `ExecutionDetailPage.tsx`

- [ ] **Navigation "Underline" (Active State)**

  - **Context**: Library, Executions, Admin Logs active tabs need better indication.
  - **Action**: Add `border-b-2` or distinctive color to active sidebar/nav items.
  - **Target**: `Sidebar.tsx`

- [ ] **Execute Button UX (Workflows Page)**
  - **Context**: Current "big box" config is "janky".
  - **Action**: Replace with a specialized "Run Workflow" modal that parses the trigger type and offers appropriate input fields (JSON editor for HTTP/Manual).
  - **Target**: `WorkflowSplitLayout.tsx`

## 🧹 Cleanup

- [ ] **Remove Deprecated Detail Page**
  - **Action**: Delete `WorkflowDetailPage.tsx` and remove its route since `WorkflowSplitLayout` handles this now.
  - **Target**: `frontend/src/pages/Workflows/`
