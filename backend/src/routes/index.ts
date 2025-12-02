
import { Router } from "express";
import workflowRoutes from "./workflowRoutes";
import userRoutes from "./userRoutes";
import roleRoutes from "./roleRoutes";
import executionRoutes from "./executionRoutes";

const router = Router();

// All workflow endpoints under /api/workflows
router.use("/workflows", workflowRoutes);

// /api/users/...
router.use("/users", userRoutes);

// /api/roles/...
router.use("/roles", roleRoutes);

// /api/executions/...
router.use("/executions", executionRoutes);


export default router;
