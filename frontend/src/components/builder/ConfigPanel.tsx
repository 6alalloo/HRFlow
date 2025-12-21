import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { LuX, LuSave, LuTrash2, LuPlus, LuMinus } from 'react-icons/lu';
import { CONDITION_OPERATORS, CV_PARSER_FIELDS } from '../../types/nodeConfigs';
import type { NodeKind } from '../../types/nodeConfigs';

// Node structure from the workflow builder
interface WorkflowNode {
    id: number;
    name: string;
    kind: NodeKind;
    config: Record<string, unknown>;
}

type ConfigPanelProps = {
    isOpen: boolean;
    node: WorkflowNode | null;
    onClose: () => void;
    onUpdate: (id: number, update: { config?: Record<string, unknown>; name?: string }) => void;
    onDelete: (id: number) => void;
};

// Type-safe accessor helpers for localConfig
type KeyValuePair = { key: string; value: string };

const getString = (config: Record<string, unknown>, key: string, fallback = ''): string => {
    const val = config[key];
    return typeof val === 'string' ? val : fallback;
};

const getNumber = (config: Record<string, unknown>, key: string, fallback = 0): number => {
    const val = config[key];
    return typeof val === 'number' ? val : fallback;
};

const getKeyValueArray = (config: Record<string, unknown>, key: string): KeyValuePair[] => {
    const val = config[key];
    return Array.isArray(val) ? val as KeyValuePair[] : [];
};

const getStringArray = (config: Record<string, unknown>, key: string): string[] => {
    const val = config[key];
    return Array.isArray(val) ? val as string[] : [];
};

// Reusable form field components
const FormField: React.FC<{
    label: string;
    children: React.ReactNode;
    hint?: string;
}> = ({ label, 
    children, hint }) => (
    <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400 uppercase">{label}</label>
        {children}
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
);

const TextInput: React.FC<{
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    type?: string;
}> = ({ value, onChange, placeholder, type = 'text' }) => (
    <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
    />
);

const TextArea: React.FC<{
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    rows?: number;
}> = ({ value, onChange, placeholder, rows = 4 }) => (
    <textarea
        rows={rows}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors resize-none font-mono text-sm"
    />
);

const Select: React.FC<{
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
    <select
        value={value || options[0]?.value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
    >
        {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
                {opt.label}
            </option>
        ))}
    </select>
);

const NumberInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
}> = ({ value, onChange, min = 0, max }) => (
    <input
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={min}
        max={max}
        className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-cyan-glow focus:outline-none transition-colors"
    />
);

// Key-Value Pair Editor Component
const KeyValueEditor: React.FC<{
    pairs: { key: string; value: string }[];
    onChange: (pairs: { key: string; value: string }[]) => void;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
}> = ({ pairs = [], onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }) => {
    const addPair = () => {
        onChange([...pairs, { key: '', value: '' }]);
    };

    const removePair = (index: number) => {
        onChange(pairs.filter((_, i) => i !== index));
    };

    const updatePair = (index: number, field: 'key' | 'value', val: string) => {
        const updated = [...pairs];
        updated[index] = { ...updated[index], [field]: val };
        onChange(updated);
    };

    return (
        <div className="space-y-2">
            {pairs.map((pair, index) => (
                <div key={index} className="flex gap-2">
                    <input
                        type="text"
                        value={pair.key}
                        onChange={(e) => updatePair(index, 'key', e.target.value)}
                        placeholder={keyPlaceholder}
                        className="flex-1 bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-glow focus:outline-none"
                    />
                    <input
                        type="text"
                        value={pair.value}
                        onChange={(e) => updatePair(index, 'value', e.target.value)}
                        placeholder={valuePlaceholder}
                        className="flex-1 bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-glow focus:outline-none"
                    />
                    <button
                        onClick={() => removePair(index)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <LuMinus className="w-4 h-4" />
                    </button>
                </div>
            ))}
            <button
                onClick={addPair}
                className="flex items-center gap-2 text-sm text-cyan-glow hover:text-white transition-colors"
            >
                <LuPlus className="w-4 h-4" />
                Add {keyPlaceholder}
            </button>
        </div>
    );
};

// Checkbox Group Component
const CheckboxGroup: React.FC<{
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
}> = ({ options, selected = [], onChange }) => {
    const handleToggle = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    return (
        <div className="space-y-2">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggle(opt.value)}
                    className="flex items-center gap-3 cursor-pointer group w-full text-left"
                >
                    <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selected.includes(opt.value)
                                ? 'bg-cyan-glow border-cyan-glow'
                                : 'border-white/20 group-hover:border-white/40'
                        }`}
                    >
                        {selected.includes(opt.value) && (
                            <svg className="w-3 h-3 text-navy-950" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        )}
                    </div>
                    <span className="text-sm text-slate-300 group-hover:text-white">{opt.label}</span>
                </button>
            ))}
        </div>
    );
};

const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, node, onClose, onUpdate, onDelete }) => {
    // Use useMemo to derive initial config, avoiding setState in effect
    const initialConfig = useMemo(() => node?.config || {}, [node]);
    const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const firstInputRef = React.useRef<HTMLInputElement>(null);

    // Sync localConfig when node changes - this is intentional state synchronization
    const nodeId = node?.id;
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocalConfig(initialConfig);
    }, [nodeId, initialConfig]);

    // Focus first input when panel opens
    useEffect(() => {
        if (isOpen && firstInputRef.current) {
            // Small delay to ensure the panel is rendered
            setTimeout(() => {
                firstInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Keyboard navigation handler
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape to close (unless in delete confirm modal)
            if (e.key === 'Escape') {
                if (showDeleteConfirm) {
                    setShowDeleteConfirm(false);
                } else {
                    onClose();
                }
                e.preventDefault();
            }

            // Ctrl+S or Cmd+S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (node) {
                    onUpdate(node.id, { config: localConfig });
                }
            }

            // Ctrl+Enter to save and close
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (node) {
                    onUpdate(node.id, { config: localConfig });
                    onClose();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showDeleteConfirm, node, localConfig, onClose, onUpdate]);

    const handleChange = (key: string, val: unknown) => {
        setLocalConfig((prev) => ({ ...prev, [key]: val }));
    };

    const handleSave = () => {
        if (node) {
            onUpdate(node.id, { config: localConfig });
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        if (node) {
            onDelete(node.id);
            onClose();
        }
        setShowDeleteConfirm(false);
    };

    if (!isOpen || !node) return null;

    // Render form based on node kind
    const renderForm = () => {
        switch (node.kind) {
            case 'trigger':
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">Employee Details</h3>
                        <FormField label="Employee Name">
                            <TextInput
                                value={getString(localConfig, 'name')}
                                onChange={(val) => handleChange('name', val)}
                                placeholder="e.g. John Doe"
                            />
                        </FormField>
                        <FormField label="Employee Email">
                            <TextInput
                                value={getString(localConfig, 'email')}
                                onChange={(val) => handleChange('email', val)}
                                placeholder="e.g. john@company.com"
                            />
                        </FormField>
                        <div className="grid grid-cols-2 gap-3">
                            <FormField label="Department">
                                <TextInput
                                    value={getString(localConfig, 'department')}
                                    onChange={(val) => handleChange('department', val)}
                                    placeholder="e.g. Engineering"
                                />
                            </FormField>
                            <FormField label="Role">
                                <TextInput
                                    value={getString(localConfig, 'role')}
                                    onChange={(val) => handleChange('role', val)}
                                    placeholder="e.g. Developer"
                                />
                            </FormField>
                        </div>
                        <FormField label="Start Date">
                            <TextInput
                                type="date"
                                value={getString(localConfig, 'startDate')}
                                onChange={(val) => handleChange('startDate', val)}
                            />
                        </FormField>
                        <FormField label="Manager Email">
                            <TextInput
                                value={getString(localConfig, 'managerEmail')}
                                onChange={(val) => handleChange('managerEmail', val)}
                                placeholder="e.g. manager@company.com"
                            />
                        </FormField>
                    </div>
                );

            case 'email':
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">Email Settings</h3>
                        <FormField label="To Recipient" hint="Use {{trigger.email}} to reference trigger data">
                            <TextInput
                                value={getString(localConfig, 'to')}
                                onChange={(val) => handleChange('to', val)}
                                placeholder="e.g. {{trigger.email}}"
                            />
                        </FormField>
                        <FormField label="Subject">
                            <TextInput
                                value={getString(localConfig, 'subject')}
                                onChange={(val) => handleChange('subject', val)}
                                placeholder="e.g. Welcome to the team!"
                            />
                        </FormField>
                        <FormField label="Body" hint="Use {{trigger.name}} to include dynamic data">
                            <TextArea
                                rows={6}
                                value={getString(localConfig, 'body')}
                                onChange={(val) => handleChange('body', val)}
                                placeholder="Hello {{trigger.name}},&#10;&#10;Welcome to the team..."
                            />
                        </FormField>
                    </div>
                );

            case 'http': {
                const method = getString(localConfig, 'method');
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">HTTP Request</h3>
                        <FormField label="Method">
                            <Select
                                value={method}
                                onChange={(val) => handleChange('method', val)}
                                options={[
                                    { value: 'GET', label: 'GET' },
                                    { value: 'POST', label: 'POST' },
                                    { value: 'PUT', label: 'PUT' },
                                    { value: 'DELETE', label: 'DELETE' },
                                ]}
                            />
                        </FormField>
                        <FormField label="URL" hint="Must be on the approved domain allow-list">
                            <TextInput
                                value={getString(localConfig, 'url')}
                                onChange={(val) => handleChange('url', val)}
                                placeholder="https://api.example.com/endpoint"
                            />
                        </FormField>
                        <FormField label="Headers">
                            <KeyValueEditor
                                pairs={getKeyValueArray(localConfig, 'headers')}
                                onChange={(pairs) => handleChange('headers', pairs)}
                                keyPlaceholder="Header Name"
                                valuePlaceholder="Header Value"
                            />
                        </FormField>
                        {(method === 'POST' || method === 'PUT') && (
                            <FormField label="Request Body (JSON)">
                                <TextArea
                                    rows={6}
                                    value={getString(localConfig, 'body')}
                                    onChange={(val) => handleChange('body', val)}
                                    placeholder='{"key": "value"}'
                                />
                            </FormField>
                        )}
                    </div>
                );
            }

            case 'database': {
                const operation = getString(localConfig, 'operation');
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">Database Operation</h3>
                        <FormField label="Operation">
                            <Select
                                value={operation}
                                onChange={(val) => handleChange('operation', val)}
                                options={[
                                    { value: 'query', label: 'Query (SELECT)' },
                                    { value: 'create', label: 'Create (INSERT)' },
                                    { value: 'update', label: 'Update (UPDATE)' },
                                ]}
                            />
                        </FormField>
                        <FormField label="Table Name">
                            <TextInput
                                value={getString(localConfig, 'table')}
                                onChange={(val) => handleChange('table', val)}
                                placeholder="e.g. employees"
                            />
                        </FormField>
                        {operation !== 'query' && (
                            <FormField label="Field Mappings">
                                <KeyValueEditor
                                    pairs={getKeyValueArray(localConfig, 'fields')}
                                    onChange={(pairs) => handleChange('fields', pairs)}
                                    keyPlaceholder="Column Name"
                                    valuePlaceholder="Value or {{variable}}"
                                />
                            </FormField>
                        )}
                        {(operation === 'query' || operation === 'update') && (
                            <FormField label="Where Clause" hint="e.g. id = 1 or email = '{{trigger.email}}'">
                                <TextInput
                                    value={getString(localConfig, 'whereClause')}
                                    onChange={(val) => handleChange('whereClause', val)}
                                    placeholder="id = {{trigger.id}}"
                                />
                            </FormField>
                        )}
                    </div>
                );
            }

            case 'condition': {
                const operator = getString(localConfig, 'operator');
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">Condition Logic</h3>
                        <p className="text-xs text-slate-400">
                            Define a condition to branch the workflow. True path continues, False path is an alternative.
                        </p>
                        <FormField label="Field to Check" hint="Use {{variable}} syntax">
                            <TextInput
                                value={getString(localConfig, 'field')}
                                onChange={(val) => handleChange('field', val)}
                                placeholder="e.g. {{trigger.department}}"
                            />
                        </FormField>
                        <FormField label="Operator">
                            <Select
                                value={operator}
                                onChange={(val) => handleChange('operator', val)}
                                options={CONDITION_OPERATORS}
                            />
                        </FormField>
                        {!['is_empty', 'is_not_empty'].includes(operator) && (
                            <FormField label="Compare Value">
                                <TextInput
                                    value={getString(localConfig, 'value')}
                                    onChange={(val) => handleChange('value', val)}
                                    placeholder="e.g. Engineering"
                                />
                            </FormField>
                        )}
                        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs">
                            <strong>Tip:</strong> Connect two edges from this node - label one "true" and one "false" to create branching logic.
                        </div>
                    </div>
                );
            }

            case 'cv_parser': {
                const extractFields = getStringArray(localConfig, 'extractFields');
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">CV Parser Settings</h3>
                        <FormField label="File Source" hint="Reference to uploaded file from trigger">
                            <TextInput
                                value={getString(localConfig, 'fileSource')}
                                onChange={(val) => handleChange('fileSource', val)}
                                placeholder="{{trigger.cvFile}}"
                            />
                        </FormField>
                        <FormField label="Fields to Extract">
                            <CheckboxGroup
                                options={CV_PARSER_FIELDS}
                                selected={extractFields}
                                onChange={(selected) => handleChange('extractFields', selected)}
                            />
                        </FormField>
                        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs space-y-1">
                            <strong>Output Variables:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                                {extractFields.map((field: string) => (
                                    <li key={field}>
                                        <code className="bg-black/20 px-1 rounded">{'{{steps.' + node.name + '.' + field + '}}'}</code>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
            }

            case 'wait': {
                const duration = getNumber(localConfig, 'duration');
                const unit = getString(localConfig, 'unit', 'seconds');
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">Delay Settings</h3>
                        <p className="text-xs text-slate-400">
                            Pause the workflow for a specified duration before continuing to the next step.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <FormField label="Duration">
                                <NumberInput
                                    value={duration}
                                    onChange={(val) => handleChange('duration', val)}
                                    min={1}
                                />
                            </FormField>
                            <FormField label="Unit">
                                <Select
                                    value={unit}
                                    onChange={(val) => handleChange('unit', val)}
                                    options={[
                                        { value: 'seconds', label: 'Seconds' },
                                        { value: 'minutes', label: 'Minutes' },
                                        { value: 'hours', label: 'Hours' },
                                    ]}
                                />
                            </FormField>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
                            The workflow will pause for{' '}
                            <strong>
                                {duration} {unit}
                            </strong>{' '}
                            before continuing.
                        </div>
                    </div>
                );
            }

            case 'logger':
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">Logger Settings</h3>
                        <FormField label="Log Level">
                            <Select
                                value={getString(localConfig, 'level')}
                                onChange={(val) => handleChange('level', val)}
                                options={[
                                    { value: 'info', label: 'Info' },
                                    { value: 'warn', label: 'Warning' },
                                    { value: 'error', label: 'Error' },
                                ]}
                            />
                        </FormField>
                        <FormField label="Message" hint="Use {{variable}} syntax to include dynamic data">
                            <TextArea
                                rows={4}
                                value={getString(localConfig, 'message')}
                                onChange={(val) => handleChange('message', val)}
                                placeholder="Processing employee: {{trigger.name}}"
                            />
                        </FormField>
                        <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-200 text-xs">
                            Logs will appear in the execution details and audit trail.
                        </div>
                    </div>
                );

            case 'datetime': {
                const dtOperation = getString(localConfig, 'operation');
                const outputField = getString(localConfig, 'outputField', 'formattedDate');
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">Date/Time Operation</h3>
                        <FormField label="Operation">
                            <Select
                                value={dtOperation}
                                onChange={(val) => handleChange('operation', val)}
                                options={[
                                    { value: 'now', label: 'Get Current Date/Time' },
                                    { value: 'format', label: 'Format Date' },
                                    { value: 'add', label: 'Add to Date' },
                                    { value: 'subtract', label: 'Subtract from Date' },
                                ]}
                            />
                        </FormField>
                        {dtOperation === 'format' && (
                            <FormField label="Input Date Field">
                                <TextInput
                                    value={getString(localConfig, 'inputField')}
                                    onChange={(val) => handleChange('inputField', val)}
                                    placeholder="{{trigger.startDate}}"
                                />
                            </FormField>
                        )}
                        {(dtOperation === 'add' || dtOperation === 'subtract') && (
                            <>
                                <FormField label="Input Date Field">
                                    <TextInput
                                        value={getString(localConfig, 'inputField')}
                                        onChange={(val) => handleChange('inputField', val)}
                                        placeholder="{{trigger.startDate}}"
                                    />
                                </FormField>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="Amount">
                                        <NumberInput
                                            value={getNumber(localConfig, 'value')}
                                            onChange={(val) => handleChange('value', val)}
                                            min={0}
                                        />
                                    </FormField>
                                    <FormField label="Unit">
                                        <Select
                                            value={getString(localConfig, 'unit')}
                                            onChange={(val) => handleChange('unit', val)}
                                            options={[
                                                { value: 'days', label: 'Days' },
                                                { value: 'hours', label: 'Hours' },
                                                { value: 'minutes', label: 'Minutes' },
                                            ]}
                                        />
                                    </FormField>
                                </div>
                            </>
                        )}
                        <FormField label="Output Format" hint="e.g. YYYY-MM-DD, DD/MM/YYYY HH:mm">
                            <TextInput
                                value={getString(localConfig, 'format')}
                                onChange={(val) => handleChange('format', val)}
                                placeholder="YYYY-MM-DD"
                            />
                        </FormField>
                        <FormField label="Output Variable Name">
                            <TextInput
                                value={outputField}
                                onChange={(val) => handleChange('outputField', val)}
                                placeholder="formattedDate"
                            />
                        </FormField>
                        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-200 text-xs">
                            Result available as:{' '}
                            <code className="bg-black/20 px-1 rounded">
                                {'{{steps.' + (node.name || 'datetime') + '.' + outputField + '}}'}
                            </code>
                        </div>
                    </div>
                );
            }

            case 'variable': {
                const variables = getKeyValueArray(localConfig, 'variables');
                return (
                    <div className="space-y-4 border-t border-white/5 pt-4">
                        <h3 className="text-sm font-bold text-white">Set Variables</h3>
                        <p className="text-xs text-slate-400">
                            Define variables that can be used in subsequent workflow steps.
                        </p>
                        <FormField label="Variables">
                            <KeyValueEditor
                                pairs={variables}
                                onChange={(pairs) => handleChange('variables', pairs)}
                                keyPlaceholder="Variable Name"
                                valuePlaceholder="Value or {{reference}}"
                            />
                        </FormField>
                        {variables.length > 0 && (
                            <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-200 text-xs space-y-1">
                                <strong>Available Variables:</strong>
                                <ul className="list-disc list-inside mt-1 space-y-0.5">
                                    {variables.map((v, i) => (
                                        <li key={i}>
                                            <code className="bg-black/20 px-1 rounded">
                                                {'{{steps.' + (node.name || 'variable') + '.' + (v.key || 'unnamed') + '}}'}
                                            </code>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                );
            }

            default:
                return (
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                        Configuration for <strong>{node.kind}</strong> is not yet available.
                    </div>
                );
        }
    };

    return (
        <>
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-4 top-4 bottom-4 w-[400px] bg-navy-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
                    <div>
                        <h2 className="text-lg font-bold text-white">{node.name || 'Configure Step'}</h2>
                        <span className="text-xs text-cyan-glow uppercase tracking-wider font-semibold">{node.kind}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <LuX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content (Form) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    {/* Common Field: Name */}
                    <FormField label="Step Name">
                        <TextInput
                            value={node.name || ''}
                            onChange={(val) => onUpdate(node.id, { name: val })}
                            placeholder={node.kind}
                        />
                    </FormField>

                    {/* Node-specific forms */}
                    {renderForm()}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/10 bg-transparent space-y-3">
                    {/* Keyboard hints */}
                    <div className="flex justify-center gap-4 text-[10px] text-slate-500 font-mono">
                        <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">Esc</kbd> Close</span>
                        <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">Ctrl+S</kbd> Save</span>
                        <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">Tab</kbd> Navigate</span>
                    </div>
                    
                    <div className="flex justify-between items-center gap-4">
                        <button
                            onClick={handleDeleteClick}
                            className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                            tabIndex={0}
                        >
                            <LuTrash2 className="w-4 h-4" />
                            Delete
                        </button>

                        <button
                            onClick={handleSave}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold bg-cyan-glow text-navy-950 hover:bg-white hover:scale-[1.02] transition-all shadow-glow-sm flex items-center justify-center gap-2"
                            tabIndex={0}
                        >
                            <LuSave className="w-4 h-4" />
                            Save Changes
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl space-y-4">
                        <h3 className="text-xl font-bold text-white">Delete Step?</h3>
                        <p className="text-slate-300 text-sm">
                            Are you sure you want to delete this step? This action cannot be undone and will remove connected edges.
                        </p>
                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg"
                            >
                                Delete Step
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ConfigPanel;
