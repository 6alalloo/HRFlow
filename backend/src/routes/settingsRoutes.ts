// backend/src/routes/settingsRoutes.ts
import { Router } from "express";
import * as settingsController from "../controllers/settingsController";
import { authenticate, adminOnly } from "../middleware/authMiddleware";

const router = Router();

// All settings routes require authentication and admin role
router.use(authenticate);
router.use(adminOnly);

// GET /api/settings/allow-list - Get all allowed domains
router.get("/allow-list", settingsController.getAllowedDomains);

// POST /api/settings/allow-list - Add a domain
router.post("/allow-list", settingsController.addAllowedDomain);

// DELETE /api/settings/allow-list/:id - Remove a domain
router.delete("/allow-list/:id", settingsController.removeAllowedDomain);

export default router;
