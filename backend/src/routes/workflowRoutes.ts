import { Router } from "express";
import * as workflowController from "../controllers/workflowController";
import * as executionController from "../controllers/executionController";

const router = Router();

// List all workflows
router.get("/", workflowController.getAllWorkflows);

// Get one workflow by id
router.get("/:id", workflowController.getWorkflowById);

// Get workflow nodes
router.get("/:id/nodes", workflowController.getWorkflowNodes);

// Get workflow edges
router.get("/:id/edges", workflowController.getWorkflowEdges);

// Get workflow graph
router.get("/:id/graph", workflowController.getWorkflowGraph);

// NEW: Get executions for a workflow
router.get("/:id/executions", executionController.getExecutionsForWorkflow);

// Run or execute a workflow
router.post("/:id/execute", executionController.executeWorkflow);

export default router;
