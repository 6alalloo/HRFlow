/**
 * Workflow Templates
 *
 * Pre-built workflow templates that users can use as starting points.
 * Each template contains nodes and edges that form a complete workflow.
 */

export interface TemplateNode {
    id: string;
    kind: string;
    name: string;
    pos_x: number;
    pos_y: number;
    config: Record<string, unknown>;
}

export interface TemplateEdge {
    from: string;
    to: string;
    label?: string;
    condition?: Record<string, unknown>;
}

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    useCase: string;
    category: 'hr' | 'it' | 'general';
    nodes: TemplateNode[];
    edges: TemplateEdge[];
    requiredConfig: string[];
}

export const templates: WorkflowTemplate[] = [
    {
        id: 'hr-onboarding',
        name: 'HR Onboarding',
        description: 'Automate new employee onboarding with CV parsing and personalized welcome emails.',
        useCase: 'Use this template when a new employee joins your organization. It extracts data from their CV, validates the information, and sends a personalized welcome email based on the outcome.',
        category: 'hr',
        nodes: [
            {
                id: 'trigger-1',
                kind: 'trigger',
                name: 'New Employee',
                pos_x: 100,
                pos_y: 200,
                config: {
                    // Placeholders - user needs to fill these in
                    name: '',
                    email: '',
                    department: '',
                    role: '',
                    startDate: '',
                    managerEmail: '',
                },
            },
            {
                id: 'cv-parser-1',
                kind: 'cv_parser',
                name: 'Parse CV',
                pos_x: 350,
                pos_y: 200,
                config: {
                    fileSource: '{{trigger.cvFile}}',
                    extractFields: ['name', 'email', 'phone', 'skills', 'experience'],
                },
            },
            {
                id: 'condition-1',
                kind: 'condition',
                name: 'Valid Data?',
                pos_x: 600,
                pos_y: 200,
                config: {
                    field: '{{steps.Parse CV.email}}',
                    operator: 'is_not_empty',
                    value: '',
                },
            },
            {
                id: 'email-success',
                kind: 'email',
                name: 'Welcome Email',
                pos_x: 850,
                pos_y: 100,
                config: {
                    to: '{{trigger.email}}',
                    subject: 'Welcome to the Team, {{trigger.name}}!',
                    body: `Hello {{trigger.name}},

Welcome to the {{trigger.department}} team! We're excited to have you join us as a {{trigger.role}}.

Your start date is {{trigger.startDate}}. Your manager {{trigger.managerEmail}} will reach out with more details.

Skills we found on your CV: {{steps.Parse CV.skills}}

Best regards,
HR Team`,
                },
            },
            {
                id: 'email-failure',
                kind: 'email',
                name: 'Review Required',
                pos_x: 850,
                pos_y: 300,
                config: {
                    to: '{{trigger.managerEmail}}',
                    subject: 'Action Required: CV Review for {{trigger.name}}',
                    body: `Hello,

The CV for {{trigger.name}} ({{trigger.email}}) could not be fully parsed.

Please review the application manually and update the employee record.

Department: {{trigger.department}}
Role: {{trigger.role}}
Start Date: {{trigger.startDate}}

Best regards,
HR System`,
                },
            },
            {
                id: 'logger-1',
                kind: 'logger',
                name: 'Log Result',
                pos_x: 1100,
                pos_y: 200,
                config: {
                    message: 'Onboarding completed for {{trigger.name}} ({{trigger.email}})',
                    level: 'info',
                },
            },
        ],
        edges: [
            { from: 'trigger-1', to: 'cv-parser-1' },
            { from: 'cv-parser-1', to: 'condition-1' },
            { from: 'condition-1', to: 'email-success', label: 'true' },
            { from: 'condition-1', to: 'email-failure', label: 'false' },
            { from: 'email-success', to: 'logger-1' },
            { from: 'email-failure', to: 'logger-1' },
        ],
        requiredConfig: [
            'Employee name and email in Trigger',
            'Manager email for notifications',
            'SMTP credentials configured in n8n',
        ],
    },
    {
        id: 'it-access',
        name: 'IT Access Provisioning',
        description: 'Automate IT system access requests with account creation and credential delivery.',
        useCase: 'Use this template when an employee needs access to IT systems. It sends an API request to create the account, waits for processing, and then sends the credentials to the employee.',
        category: 'it',
        nodes: [
            {
                id: 'trigger-1',
                kind: 'trigger',
                name: 'Access Request',
                pos_x: 100,
                pos_y: 200,
                config: {
                    name: '',
                    email: '',
                    department: '',
                    role: '',
                    startDate: '',
                    managerEmail: '',
                },
            },
            {
                id: 'variable-1',
                kind: 'variable',
                name: 'Set Username',
                pos_x: 350,
                pos_y: 200,
                config: {
                    variables: [
                        { key: 'username', value: '{{trigger.email}}' },
                        { key: 'systemAccess', value: 'standard' },
                    ],
                },
            },
            {
                id: 'http-1',
                kind: 'http',
                name: 'Create Account',
                pos_x: 600,
                pos_y: 200,
                config: {
                    method: 'POST',
                    url: '', // User needs to configure
                    headers: [
                        { key: 'Content-Type', value: 'application/json' },
                    ],
                    body: JSON.stringify({
                        username: '{{steps.Set Username.username}}',
                        email: '{{trigger.email}}',
                        name: '{{trigger.name}}',
                        department: '{{trigger.department}}',
                        accessLevel: '{{steps.Set Username.systemAccess}}',
                    }, null, 2),
                },
            },
            {
                id: 'wait-1',
                kind: 'wait',
                name: 'Wait for Setup',
                pos_x: 850,
                pos_y: 200,
                config: {
                    duration: 30,
                    unit: 'seconds',
                },
            },
            {
                id: 'email-1',
                kind: 'email',
                name: 'Send Credentials',
                pos_x: 1100,
                pos_y: 200,
                config: {
                    to: '{{trigger.email}}',
                    subject: 'Your IT Access Credentials',
                    body: `Hello {{trigger.name}},

Your IT account has been created successfully.

Username: {{steps.Set Username.username}}
Department: {{trigger.department}}

Please visit the IT portal to set your password and complete the setup.

If you have any issues, contact IT support.

Best regards,
IT Team`,
                },
            },
            {
                id: 'logger-1',
                kind: 'logger',
                name: 'Log Completion',
                pos_x: 1350,
                pos_y: 200,
                config: {
                    message: 'IT access provisioned for {{trigger.name}} ({{steps.Set Username.username}})',
                    level: 'info',
                },
            },
        ],
        edges: [
            { from: 'trigger-1', to: 'variable-1' },
            { from: 'variable-1', to: 'http-1' },
            { from: 'http-1', to: 'wait-1' },
            { from: 'wait-1', to: 'email-1' },
            { from: 'email-1', to: 'logger-1' },
        ],
        requiredConfig: [
            'Employee name and email in Trigger',
            'HTTP endpoint URL for account creation',
            'API authentication headers if required',
            'SMTP credentials configured in n8n',
        ],
    },
];

// Helper function to get template by ID
export const getTemplateById = (id: string): WorkflowTemplate | undefined => {
    return templates.find((t) => t.id === id);
};

// Helper function to get templates by category
export const getTemplatesByCategory = (category: 'hr' | 'it' | 'general'): WorkflowTemplate[] => {
    return templates.filter((t) => t.category === category);
};
