// backend/src/services/allowListService.ts
// Simplified version without database dependency
// TODO: Add url_allow_list table to schema if strict URL validation is needed

export interface DomainValidationResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: string;
}

/**
 * Check if a URL is allowed based on the allowlist
 * Currently in OPEN mode - allows all valid URLs
 * To enable strict validation, add url_allow_list table to Prisma schema
 */
export async function isUrlAllowed(url: string): Promise<DomainValidationResult> {
  try {
    // Parse URL to validate format
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // In open mode - allow all valid URLs
    return {
      allowed: true,
      reason: "Open mode - no allowlist configured",
      matchedRule: hostname,
    };
  } catch (error) {
    // Invalid URL
    return {
      allowed: false,
      reason: `Invalid URL format: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Add a domain to the allowlist
 * NOTE: Requires url_allow_list table in database
 */
export async function addDomainToAllowList(
  domain: string,
  description?: string,
  addedByUserId?: number
) {
  console.warn("addDomainToAllowList called but url_allow_list table not implemented");
  return null;
}

/**
 * Remove a domain from the allowlist
 * NOTE: Requires url_allow_list table in database
 */
export async function removeDomainFromAllowList(domain: string) {
  console.warn("removeDomainFromAllowList called but url_allow_list table not implemented");
  return false;
}

/**
 * Deactivate a domain in the allowlist (soft delete)
 * NOTE: Requires url_allow_list table in database
 */
export async function deactivateDomain(domain: string) {
  console.warn("deactivateDomain called but url_allow_list table not implemented");
  return false;
}

/**
 * Activate a domain in the allowlist
 * NOTE: Requires url_allow_list table in database
 */
export async function activateDomain(domain: string) {
  console.warn("activateDomain called but url_allow_list table not implemented");
  return false;
}

/**
 * Get all domains in the allowlist
 * NOTE: Requires url_allow_list table in database
 */
export async function getAllowList(includeInactive = false) {
  console.warn("getAllowList called but url_allow_list table not implemented");
  return [];
}

/**
 * Validate multiple URLs at once
 */
export async function validateUrls(urls: string[]): Promise<Map<string, DomainValidationResult>> {
  const results = new Map<string, DomainValidationResult>();

  for (const url of urls) {
    const result = await isUrlAllowed(url);
    results.set(url, result);
  }

  return results;
}

/**
 * Extract all URLs from workflow configuration
 */
export function extractUrlsFromWorkflow(nodes: any[]): string[] {
  const urls: string[] = [];

  for (const node of nodes) {
    const config = node.config || {};

    // HTTP node URLs
    if (node.kind === "http" && config.url) {
      urls.push(config.url);
    }

    // CV parse node URLs
    if (node.kind === "cv_parse" && config.inputType === "url" && config.cvUrl) {
      urls.push(config.cvUrl);
    }

    // Check for URLs in any string config values
    for (const value of Object.values(config)) {
      if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) {
        urls.push(value);
      }
    }
  }

  return [...new Set(urls)]; // Remove duplicates
}
