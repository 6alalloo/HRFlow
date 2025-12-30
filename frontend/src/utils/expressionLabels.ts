/**
 * Expression Labels Utility
 *
 * Converts HRFlow template expressions to user-friendly labels
 * for display on node cards in the workflow builder.
 */

// Map of HRFlow expressions to friendly labels
export const expressionLabels: Record<string, string> = {
  // Trigger variables
  '{{trigger.email}}': 'Employee Email',
  '{{trigger.name}}': 'Employee Name',
  '{{trigger.department}}': 'Department',
  '{{trigger.role}}': 'Role',
  '{{trigger.startDate}}': 'Start Date',
  '{{trigger.managerEmail}}': 'Manager Email',
  '{{trigger.phone}}': 'Phone Number',
  '{{trigger.resume_url}}': 'Resume URL',
  '{{trigger.cvFile}}': 'CV File',
  '{{trigger.customDepartment}}': 'Custom Department',

  // CV Parser output variables
  '{{steps.Parse CV.email}}': 'CV Email',
  '{{steps.Parse CV.name}}': 'CV Name',
  '{{steps.Parse CV.phone}}': 'CV Phone',
  '{{steps.Parse CV.skills}}': 'CV Skills',
  '{{steps.Parse CV.education}}': 'CV Education',
  '{{steps.Parse CV.experience_years}}': 'CV Experience',

  // Database node variables
  '{{steps.Add Employee.user_id}}': 'User ID',
  '{{steps.Add Employee.employee_id}}': 'Employee ID',
};

/**
 * Convert an expression to a friendly label
 * @param expression - The raw expression (e.g., '{{trigger.email}}')
 * @returns The friendly label (e.g., 'Employee Email') or the original if not found
 */
export function getFriendlyLabel(expression: string): string {
  if (!expression || typeof expression !== 'string') {
    return expression;
  }
  return expressionLabels[expression] || expression;
}

/**
 * Replace all expressions in a string with friendly labels
 * @param text - Text containing expressions
 * @returns Text with expressions replaced by friendly labels
 */
export function replaceExpressionsWithLabels(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;
  for (const [expr, label] of Object.entries(expressionLabels)) {
    result = result.split(expr).join(label);
  }
  return result;
}

/**
 * Replace all friendly labels in a string back to expressions
 * @param text - Text containing friendly labels
 * @returns Text with labels replaced by expressions
 */
export function replaceLabelsWithExpressions(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;
  for (const [expr, label] of Object.entries(expressionLabels)) {
    result = result.split(label).join(expr);
  }
  return result;
}

/**
 * Check if a value contains an expression
 */
export function containsExpression(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.includes('{{') && value.includes('}}');
}

/**
 * Extract a clean preview string from node config
 * Shows key fields with friendly labels
 */
export function getConfigPreview(
  kind: string,
  config: Record<string, unknown> | undefined
): string {
  if (!config || Object.keys(config).length === 0) {
    return 'Click to configure';
  }

  const parts: string[] = [];

  switch (kind) {
    case 'email':
      if (!config.to || config.to === '') {
        return 'Click to configure';
      }
      const toLabel = getFriendlyLabel(String(config.to));
      parts.push(`To: ${toLabel}`);
      break;

    case 'database':
      if (config.table) {
        parts.push(`Table: ${config.table}`);
      }
      if (config.operation) {
        parts.push(`Op: ${config.operation}`);
      }
      break;

    case 'http':
      if (config.method) {
        parts.push(String(config.method));
      }
      if (config.url) {
        const url = String(config.url);
        parts.push(url.length > 30 ? url.slice(0, 30) + '...' : url);
      }
      break;

    case 'condition':
      if (config.field) {
        const fieldLabel = getFriendlyLabel(String(config.field));
        const op = config.operator || '==';
        parts.push(`If ${fieldLabel} ${op}`);
      }
      break;

    case 'cv_parser':
    case 'cv_parse':
      if (config.fileId) {
        parts.push('File uploaded');
      } else if (config.fileSource || config.fileUrl) {
        const src = String(config.fileSource || config.fileUrl);
        parts.push(getFriendlyLabel(src));
      }
      break;

    case 'logger':
      if (config.level) {
        parts.push(`Level: ${config.level}`);
      }
      break;

    case 'variable':
      if (Array.isArray(config.variables)) {
        parts.push(`${config.variables.length} variable(s)`);
      }
      break;

    case 'trigger':
      // Count configured fields
      const configuredFields = Object.entries(config).filter(
        ([_, v]) => v !== '' && v !== null && v !== undefined
      ).length;
      if (configuredFields > 0) {
        parts.push(`${configuredFields} field(s) set`);
      }
      break;

    default:
      // Generic: show first key-value
      const firstEntry = Object.entries(config).find(
        ([_, v]) => v !== '' && v !== null && v !== undefined
      );
      if (firstEntry) {
        const [key, value] = firstEntry;
        const displayValue = typeof value === 'string'
          ? getFriendlyLabel(value)
          : String(value);
        parts.push(`${key}: ${displayValue.slice(0, 20)}`);
      }
  }

  return parts.length > 0 ? parts.join(' | ') : 'Click to configure';
}
