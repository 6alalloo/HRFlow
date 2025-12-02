import { Request, Response } from "express";
import * as userService from "../services/userService";

/**
 * GET /api/users
 * Optional query params:
 * - ?active=true|false  → filter by is_active
 * - ?role=Admin         → filter by role name
 * - ?q=ali              → search in email OR full_name (case-insensitive)
 */
export async function getAllUsers(req: Request, res: Response) {
  try {
    const { active, role, q } = req.query;

    // Parse "active" query param into boolean | undefined.
    let isActiveFilter: boolean | undefined = undefined;
    if (active === "true") {
      isActiveFilter = true;
    } else if (active === "false") {
      isActiveFilter = false;
    }

    // Normalize role name.
    const roleName =
      typeof role === "string" && role.trim().length > 0 ? role.trim() : undefined;

    // Normalize query text (q).
    const query =
      typeof q === "string" && q.trim().length > 0 ? q.trim() : undefined;

    const users = await userService.getAllUsers({
      isActive: isActiveFilter,
      roleName,
      query,
    });

    return res.status(200).json({
      data: users,
    });
  } catch (error) {
    console.error("[UserController] Error getting all users:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/users/:id
 * Returns a single user by ID.
 */
export async function getUserById(req: Request, res: Response) {
  const { id } = req.params;

  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({
      message: "Invalid user ID",
    });
  }

  try {
    const user = await userService.getUserById(numericId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      data: user,
    });
  } catch (error) {
    console.error("[UserController] Error getting user by id:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
