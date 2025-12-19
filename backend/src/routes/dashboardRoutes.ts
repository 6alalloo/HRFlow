// backend/src/routes/dashboardRoutes.ts
import { Router, Request, Response } from "express";
import * as dashboardService from "../services/dashboardService";

const router = Router();

// Helper to get user from request (assumes auth middleware sets req.user)
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role?: { name: string };
  };
}

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics based on user role
 */
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const isAdmin = user?.role?.name === "Admin";

    let stats;
    if (isAdmin) {
      stats = await dashboardService.getAdminDashboardStats();
    } else if (user?.id) {
      stats = await dashboardService.getOperatorDashboardStats(user.id);
    } else {
      // Fallback to admin stats if no user context
      stats = await dashboardService.getAdminDashboardStats();
    }

    res.json(stats);
  } catch (error) {
    console.error("[Dashboard] Failed to get stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

/**
 * GET /api/dashboard/charts
 * Returns chart data for dashboards
 */
router.get("/charts", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const isAdmin = user?.role?.name === "Admin";

    // Admin sees all data, operators see only their workflows
    const chartData = await dashboardService.getDashboardChartData(
      isAdmin ? undefined : user?.id
    );

    res.json(chartData);
  } catch (error) {
    console.error("[Dashboard] Failed to get chart data:", error);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

export default router;
