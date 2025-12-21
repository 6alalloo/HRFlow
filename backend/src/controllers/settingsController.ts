// backend/src/controllers/settingsController.ts
import { Request, Response } from "express";
import * as allowListService from "../services/allowListService";
import * as auditService from "../services/auditService";

/**
 * GET /api/settings/allow-list
 * Get all allowed domains
 */
export async function getAllowedDomains(_req: Request, res: Response) {
  try {
    const domains = await allowListService.getAllowList();
    res.json({ data: domains });
  } catch (error) {
    console.error("Error fetching allow-list:", error);
    res.status(500).json({ error: "Failed to fetch allow-list" });
  }
}

/**
 * Validate domain format
 * Accepts: example.com, sub.example.com, api.v2.example.co.uk
 * Rejects: spaces, special chars, incomplete domains
 */
function isValidDomain(domain: string): boolean {
  // Domain regex: alphanumeric, hyphens, dots, 2-63 chars per label, valid TLD
  const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/;
  return domainRegex.test(domain);
}

/**
 * POST /api/settings/allow-list
 * Add a new domain to the allow-list
 */
export async function addAllowedDomain(req: Request, res: Response) {
  try {
    const { domain } = req.body;

    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ error: "Domain is required" });
    }

    // Trim whitespace and convert to lowercase
    const normalizedDomain = domain.trim().toLowerCase();

    // Validate domain format
    if (!isValidDomain(normalizedDomain)) {
      return res.status(400).json({
        error: "Invalid domain format. Please enter a valid domain (e.g., api.example.com)"
      });
    }

    // Check if domain already exists
    const exists = await allowListService.domainExists(normalizedDomain);
    if (exists) {
      return res.status(409).json({ error: "Domain already exists in allow-list" });
    }

    // Get user id from request (set by auth middleware)
    const userId = (req as any).user?.userId;
    const newDomain = await allowListService.addDomainToAllowList(normalizedDomain, userId);

    // Log the action
    if (userId) {
      await auditService.logAuditEvent({
        eventType: "domain_added",
        userId: userId,
        targetType: "security",
        targetId: newDomain.id,
        details: { domain: newDomain.domain },
      });
    }

    res.status(201).json(newDomain);
  } catch (error) {
    console.error("Error adding domain:", error);
    res.status(500).json({ error: "Failed to add domain" });
  }
}

/**
 * DELETE /api/settings/allow-list/:id
 * Remove a domain from the allow-list
 */
export async function removeAllowedDomain(req: Request, res: Response) {
  try {
    const domainId = parseInt(req.params.id, 10);

    if (isNaN(domainId)) {
      return res.status(400).json({ error: "Invalid domain ID" });
    }

    const removed = await allowListService.removeDomainFromAllowList(domainId);

    if (!removed) {
      return res.status(404).json({ error: "Domain not found" });
    }

    // Get user id from request (set by auth middleware)
    const userId = (req as any).user?.userId;

    // Log the action
    if (userId) {
      await auditService.logAuditEvent({
        eventType: "domain_removed",
        userId: userId,
        targetType: "security",
        targetId: domainId,
        details: { domainId },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error removing domain:", error);
    res.status(500).json({ error: "Failed to remove domain" });
  }
}
