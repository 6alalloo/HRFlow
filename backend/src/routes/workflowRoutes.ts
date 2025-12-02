
import { Router } from "express";
import { getAllWorkflows,
            getWorkflowById,
 } from "../controllers/workflowController";

const router = Router();

// GET /api/workflows
router.get("/", getAllWorkflows);

// GET /api/workflows/:id
router.get("/:id", getWorkflowById);


export default router;
