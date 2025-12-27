# Execution System Implementation Plan

## Executive Summary

The workflow execution system has several gaps that prevent proper data visibility:

1. **n8n nodes are NoOp** - Data passes through but isn't transformed
2. **Execution steps lack data** - `input_json` and `output_json` are always empty
3. **n8n result isn't parsed** - The response from n8n isn't mapped to individual steps
4. **No per-node timing** - All steps show the same start/finish time

---

## Current Issues Analysis

### Issue 1: All Nodes Compile to NoOp

**Location**: `backend/src/services/n8nCompiler.ts`

**Problem**: We changed Logger, DateTime, and default nodes to NoOp to avoid the n8n API `jsCode` parameter stripping issue. While this fixes execution errors, nodes don't do meaningful work.

**Root Cause**: n8n API v1.x strips `jsCode` parameter from Code nodes during upsert.

---

### Issue 2: Execution Steps Have Empty Data

**Location**: `backend/src/services/executionService.ts` (lines 367-379)

```typescript
const stepsData = nodesRaw.map((node, index) => ({
  execution_id: updatedExecution.id,
  node_id: node.id,
  status: stepsStatus,
  input_json: "{}", // ← Always empty!
  output_json: "{}", // ← Always empty!
  logs: "...",
  started_at: startTime,
  finished_at: finishedTime,
}));
```

**Problem**: Steps are created with hardcoded empty JSON regardless of what n8n returns.

---

### Issue 3: n8n Result Not Parsed Into Steps

**Location**: `backend/src/services/executionService.ts` (line 317)

The n8n webhook returns an array of execution results, but we only store it in `run_context.engine.n8n` without mapping it to individual steps.

---

## Proposed Changes

### Phase 1: Fix Data Flow in Execution Service

#### [MODIFY] [executionService.ts](file:///c:/Users/6alal/OneDrive/Desktop/HRFlow/backend/src/services/executionService.ts)

Parse the n8n result and populate step input/output:

```typescript
// After line 318: n8nResult = await callN8nExecute(webhookUrl, body);

// Parse n8n result to extract per-node data
const nodeOutputMap = new Map<string, unknown>();
if (Array.isArray(n8nResult)) {
  // n8n returns array where each item has node execution data
  for (const item of n8nResult) {
    if (item && typeof item === "object" && "json" in item) {
      // Store the output for mapping to steps
      nodeOutputMap.set("result", item.json);
    }
  }
}

// Update stepsData creation to include actual data
const stepsData = nodesRaw.map((node, index) => ({
  execution_id: updatedExecution.id,
  node_id: node.id,
  status: stepsStatus,
  input_json: index === 0 ? JSON.stringify(body) : "{}",
  output_json: JSON.stringify(nodeOutputMap.get("result") ?? {}),
  logs:
    finalStatus === "completed"
      ? `Executed node ${node.name ?? node.kind} (order ${index + 1}) via n8n`
      : `Skipped node ${node.name ?? node.kind}`,
  started_at: startTime,
  finished_at: finishedTime,
}));
```

---

### Phase 2: Improve n8n Compiler to Use Real Nodes

#### [MODIFY] [n8nCompiler.ts](file:///c:/Users/6alal/OneDrive/Desktop/HRFlow/backend/src/services/n8nCompiler.ts)

Replace NoOp nodes with functional n8n nodes that work via API:

| HRFlow Node | Current | Proposed n8n Node               |
| ----------- | ------- | ------------------------------- |
| Logger      | NoOp    | Set node (adds `_logged: true`) |
| Variable    | Set     | Keep as Set (working)           |
| DateTime    | NoOp    | Date & Time node (native n8n)   |
| Default     | NoOp    | NoOp (acceptable)               |

**Logger Fix**:

```typescript
case "logger": {
  const message = safeString(cfg.message, `Logger node ${n.id}`);
  return {
    id: `hrflow_node_${n.id}`,
    name,
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position,
    parameters: {
      mode: "manual",
      assignments: {
        assignments: [
          { id: `log_${n.id}`, name: "_hrflow_log", value: message, type: "string" },
          { id: `log_ts_${n.id}`, name: "_hrflow_log_ts", value: "={{ $now.toISO() }}", type: "string" },
        ],
      },
      includeOtherFields: true,
      options: {},
    },
  };
}
```

---

### Phase 3: Enhance Execution Detail Page

#### [MODIFY] [executionDetailPage.tsx](file:///c:/Users/6alal/OneDrive/Desktop/HRFlow/frontend/src/pages/Executions/executionDetailPage.tsx)

1. Show n8n raw response in a collapsible section
2. Parse and display `run_context.engine.n8n` visually
3. Add better empty state messages

---

### Phase 4: Store n8n Execution ID

n8n webhooks don't return execution IDs directly, but we can:

1. Query n8n's execution API after webhook call
2. Store the `n8n_execution_id` in our executions table
3. Provide a "View in n8n" link

#### [MODIFY] [executionService.ts](file:///c:/Users/6alal/OneDrive/Desktop/HRFlow/backend/src/services/executionService.ts)

After successful execution, query n8n for the most recent execution:

```typescript
// After n8nResult = await callN8nExecute(...)
const n8nExecutionId = await getLatestN8nExecutionId(upsert.id);
// Store in execution record
```

---

## Verification Plan

### Manual Testing

1. Create Trigger → Logger workflow
2. Execute from builder
3. Verify in Execution Detail:
   - Steps show actual input/output data
   - Logs are meaningful
   - Status pills work correctly

### n8n Verification

1. Check n8n Executions tab shows successful runs
2. Verify data flows through nodes
3. Confirm webhook receives proper payload

---

## Priority Order

1. **High**: Fix stepsData to include actual input/output (Phase 1)
2. **High**: Replace Logger NoOp with Set node (Phase 2)
3. **Medium**: Enhanced execution detail UI (Phase 3)
4. **Low**: n8n execution ID linking (Phase 4)

---

## Estimated Effort

| Phase   | Effort | Files Changed                      |
| ------- | ------ | ---------------------------------- |
| Phase 1 | 30 min | executionService.ts                |
| Phase 2 | 45 min | n8nCompiler.ts                     |
| Phase 3 | 30 min | executionDetailPage.tsx            |
| Phase 4 | 1 hour | executionService.ts, n8nService.ts |

**Total**: ~2.5 hours
