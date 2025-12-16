// backend/src/controllers/auditController.ts
import { Request, Response } from "express";
import * as auditService from "../services/auditService";

/**
 * GET /api/audit
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(req: Request, res: Response) {
  try {
    const {
      limit,
      offset,
      eventType,
      userId,
      targetType,
      targetId,
      startDate,
      endDate,
    } = req.query;

    const params: any = {};

    if (limit) params.limit = parseInt(limit as string, 10);
    if (offset) params.offset = parseInt(offset as string, 10);
    if (eventType) params.eventType = eventType as string;
    if (userId) params.userId = parseInt(userId as string, 10);
    if (targetType) params.targetType = targetType as string;
    if (targetId) params.targetId = parseInt(targetId as string, 10);
    if (startDate) params.startDate = new Date(startDate as string);
    if (endDate) params.endDate = new Date(endDate as string);

    const result = await auditService.getAuditLogs(params);

    return res.status(200).json({
      data: result.logs,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (error) {
    console.error("[AuditController] Error getting audit logs:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/audit/workflow/:workflowId
 * Get audit logs for a specific workflow
 */
export async function getWorkflowAuditLogs(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;
    const numericWorkflowId = parseInt(workflowId, 10);

    if (isNaN(numericWorkflowId)) {
      return res.status(400).json({
        message: "Invalid workflow ID",
      });
    }

    const result = await auditService.getWorkflowAuditLogs(numericWorkflowId);

    return res.status(200).json({
      data: result.logs,
      total: result.total,
    });
  } catch (error) {
    console.error("[AuditController] Error getting workflow audit logs:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/audit/execution/:executionId
 * Get audit logs for a specific execution
 */
export async function getExecutionAuditLogs(req: Request, res: Response) {
  try {
    const { executionId } = req.params;
    const numericExecutionId = parseInt(executionId, 10);

    if (isNaN(numericExecutionId)) {
      return res.status(400).json({
        message: "Invalid execution ID",
      });
    }

    const result = await auditService.getExecutionAuditLogs(numericExecutionId);

    return res.status(200).json({
      data: result.logs,
      total: result.total,
    });
  } catch (error) {
    console.error("[AuditController] Error getting execution audit logs:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/audit/user/:userId
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const numericUserId = parseInt(userId, 10);

    if (isNaN(numericUserId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const result = await auditService.getUserAuditLogs(numericUserId);

    return res.status(200).json({
      data: result.logs,
      total: result.total,
    });
  } catch (error) {
    console.error("[AuditController] Error getting user audit logs:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
