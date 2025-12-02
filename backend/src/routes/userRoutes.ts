import { Router } from "express";
import * as userController from "../controllers/userController";

const router = Router();

// GET /api/users
router.get("/", userController.getAllUsers);

// GET /api/users/:id
router.get("/:id", userController.getUserById);

export default router;