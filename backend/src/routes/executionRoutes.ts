
import { Router } from "express";
import * as executionController from "../controllers/executionController";

const router = Router();

// GET /api/executions
router.get("/", executionController.getAllExecutions);

// GET /api/executions/:id
router.get("/:id", executionController.getExecutionById);

// GET /api/executions/:id/steps
router.get("/:id/steps", executionController.getExecutionSteps);

export default router;
