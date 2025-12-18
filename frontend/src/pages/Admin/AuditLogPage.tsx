import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { apiGet } from "../../api/apiClient";
import { 
    FiShield, 
    FiActivity, 
    FiUser, 
    FiSearch, 
    FiFilter,
    FiPlusCircle,
    FiEdit3,
    FiTrash2,
    FiLogIn,
    FiLogOut,
    FiChevronRight,
    FiChevronLeft
} from "react-icons/fi";

interface AuditLog {
  id: number;
  action: string;
  actor_user_id: number | null;
  entity_type: string | null;
  entity_id: number | null;
  data_json: string | null;
  created_at: string;
  users?: {
    id: number;
    email: string;
  };
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25); // Slightly increased limit for compact view
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({
    eventType: "",
    targetType: "",
  });
  const [expandedLogs, setExpandedLogs] = useState<number[]>([]);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (filters.eventType) params.append("eventType", filters.eventType);
      if (filters.targetType) params.append("targetType", filters.targetType);

      const response = await apiGet<AuditLogsResponse>(`/audit?${params.toString()}`);
      setLogs(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, filters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const toggleExpand = (id: number) => {
    setExpandedLogs(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const getActionIcon = (action: string) => {
    if (action.includes("create")) return <FiPlusCircle className="text-emerald-400" />;
    if (action.includes("update")) return <FiEdit3 className="text-blue-400" />;
    if (action.includes("delete")) return <FiTrash2 className="text-rose-400" />;
    if (action.includes("login")) return <FiLogIn className="text-amber-400" />;
    if (action.includes("logout")) return <FiLogOut className="text-slate-400" />;
    return <FiActivity className="text-purple-400" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes("create")) return "from-emerald-500/20 to-teal-500/5 border-emerald-500/20";
    if (action.includes("update")) return "from-blue-500/20 to-indigo-500/5 border-blue-500/20";
    if (action.includes("delete")) return "from-rose-500/20 to-red-500/5 border-rose-500/20";
    if (action.includes("login")) return "from-amber-500/20 to-orange-500/5 border-amber-500/20";
    return "from-slate-800/50 to-slate-900/50 border-white/5";
  };

  const formatActionName = (action: string) => {
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatKey = (key: string) => {
    // Handle snake_case and camelCase/PascalCase
    return key
      .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
      .replace(/_/g, ' ')         // Replace underscores with spaces
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-slate-600">-</span>;
    
    if (typeof value === 'boolean') {
      return value ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Yes
        </span>
      ) : (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          No
        </span>
      );
    }

    if (typeof value === 'object') {
        // Flatten object to comma-separated key: value string for "plaintext" feel
        return (
             <div className="flex flex-col gap-1">
                {Object.entries(value).map(([k, v]) => (
                    <div key={k} className="flex gap-1 text-[10px]">
                        <span className="text-slate-500">{formatKey(k)}:</span>
                        <span className="text-slate-300">{formatValue(v)}</span>
                    </div>
                ))}
            </div>
        );
    }

    // Check if valid date string (simple check)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        try {
            return new Date(value).toLocaleString();
        } catch {}
    }

    // Humanize snake_case strings (e.g. "node_deleted" -> "Node Deleted")
    if (typeof value === 'string' && value.includes('_')) {
        return value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    
    // Capitalize first letter of simple strings
    if (typeof value === 'string') {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    return String(value);
  };

  const parseDetails = (log: AuditLog) => {
    try {
      if (!log.data_json) return {};
      
      const raw = JSON.parse(log.data_json);
      // Flatten details if present
      const { details, ...topLevel } = raw;
      let flat = { ...topLevel };
      if (details && typeof details === 'object') {
          flat = { ...flat, ...details };
      }


      // Filter out technical/noisy fields
      // Added case-insensitive checking logic below, so we list canonical forms to ban here
      const bannedKeys = [
          'ipaddress', 'useragent', 'ip_address', 'user_agent', 
          'node_id', 'nodeid', 'id', 'workflow_id', 'execution_id', 'org_id',
          'nodetype', 'node_type', 'kind' // We will handle node type/kind manually
      ];
      
      const clean: Record<string, any> = {};
      
      // Add "Performed By" first
      const actorName = log.users?.email || `User #${log.actor_user_id}`;
      clean["Performed By"] = actorName;

      // Handle Node Type manually to ensure it shows up nicely
      const nodeTypeKey = Object.keys(flat).find(k => k.toLowerCase() === 'node_type' || k.toLowerCase() === 'nodetype' || k.toLowerCase() === 'kind');
      if (nodeTypeKey && flat[nodeTypeKey]) {
          // Format e.g. "send_email" -> "Send Email"
          let typeVal = flat[nodeTypeKey];
          if (typeof typeVal === 'string') {
               // Remove "Node" suffix if present for cleaner look, e.g. "EmailNode" -> "Email"
               typeVal = typeVal.replace(/node$/i, '');
               typeVal = typeVal.split(/[_ ]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }
          clean["Node Type"] = typeVal;
      }

      // Add rest, filtering keys
      Object.entries(flat).forEach(([k, v]) => {
          const lowerK = k.toLowerCase().replace(/_/g, '');
          // Check if strictly banned or contains specific substrings we definitely don't want
          const isBanned = bannedKeys.some(b => b.replace(/_/g, '') === lowerK);
          
          if (!isBanned) {
              clean[k] = v;
          }
      });

      return clean;

    } catch {
        return {}; 
    }
  };

  if (!user || user.role?.name !== "Admin") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="p-8 mt-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-xl text-center max-w-md">
            <FiShield className="mx-auto text-5xl text-rose-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-rose-200">Restricted area. Administrator privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div>
           <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <FiShield className="text-blue-400 text-xl" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                    Audit Logs
                </h1>
           </div>
           <p className="text-slate-400 text-sm max-w-2xl">
                Comprehensive record of system activities, security events, and data modifications.
           </p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiFilter className="text-slate-500" />
                </div>
                <select 
                    value={filters.eventType}
                    onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value }))}
                    className="pl-10 pr-8 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 focus:bg-white/5 appearance-none hover:bg-white/5 transition-colors cursor-pointer min-w-[180px]"
                >
                    <option value="" className="bg-slate-900">All Events</option>
                    <option value="workflow_created" className="bg-slate-900">Workflow Created</option>
                    <option value="workflow_updated" className="bg-slate-900">Workflow Updated</option>
                    <option value="workflow_deleted" className="bg-slate-900">Workflow Deleted</option>
                    <option value="execution_started" className="bg-slate-900">Execution Started</option>
                    <option value="execution_completed" className="bg-slate-900">Execution Completed</option>
                    <option value="execution_failed" className="bg-slate-900">Execution Failed</option>
                    <option value="user_login" className="bg-slate-900">User Login</option>
                </select>
            </div>

            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="text-slate-500" />
                </div>
                <select 
                    value={filters.targetType}
                    onChange={(e) => setFilters(prev => ({ ...prev, targetType: e.target.value }))}
                    className="pl-10 pr-8 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 focus:bg-white/5 appearance-none hover:bg-white/5 transition-colors cursor-pointer min-w-[150px]"
                >
                    <option value="" className="bg-slate-900">All Targets</option>
                    <option value="workflow" className="bg-slate-900">Workflow</option>
                    <option value="execution" className="bg-slate-900">Execution</option>
                    <option value="user" className="bg-slate-900">User</option>
                </select>
            </div>
        </div>
      </div>

      {/* Logs Feed - Ultra Compact */}
      <div className="space-y-1">
        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
                <FiActivity className="animate-spin text-3xl opacity-50" />
                <p className="animate-pulse font-medium">Loading audit trail...</p>
            </div>
        ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                <FiShield className="text-4xl mb-4 opacity-30" />
                <p>No audit logs found matching your filters.</p>
            </div>
        ) : (
            <>
                {logs.map((log, idx) => {
                    const details = parseDetails(log);
                    const isExpanded = expandedLogs.includes(log.id);
                    const actionColor = getActionColor(log.action);
                    const hasDetails = details && Object.keys(details).length > 0;

                    return (
                        <div 
                            key={log.id} 
                            style={{ animationDelay: `${idx * 20}ms` }}
                            className={`group relative overflow-hidden rounded-md border transition-all duration-300 bg-gradient-to-br animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards
                                ${actionColor} ${isExpanded ? 'bg-white/[0.04] border-white/20 shadow-lg' : 'bg-white/[0.01] hover:bg-white/[0.03]'}
                            `}
                        >
                            <div className={`flex items-center gap-3 px-3 py-2 ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                                 onClick={hasDetails ? () => toggleExpand(log.id) : undefined}
                            >
                                {/* Icon */}
                                <div className="p-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner shrink-0 text-white/90">
                                    {getActionIcon(log.action)}
                                </div>

                                {/* Content Line: Action - User - Entity */}
                                <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                                    <span className="text-white font-medium text-xs tracking-wide">
                                        {formatActionName(log.action)}
                                    </span>
                                    
                                    {/* Divider */}
                                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-600"></span>

                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <FiUser size={10} className="text-slate-500"/>
                                        <span className="truncate max-w-[150px]">
                                            {log.users?.email || `User ${log.actor_user_id || 'System'}`}
                                        </span>
                                    </div>

                                    {log.entity_type && (
                                        <>
                                            <span className="text-slate-600 text-[10px] hidden sm:inline">on</span>
                                            <div className="px-1.5 py-px rounded border border-white/10 bg-white/5 text-[10px] text-slate-300 font-mono flex items-center gap-1">
                                                <span>{log.entity_type}</span>
                                                <span className="opacity-50">#{log.entity_id}</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Right Side: Time & Chevron */}
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                                        <span className="hidden md:inline">{new Date(log.created_at).toLocaleString()}</span>
                                        <span className="md:hidden">{new Date(log.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    
                                    {hasDetails && (
                                        <div className={`text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-blue-400' : 'group-hover:text-slate-300'}`}>
                                            <FiChevronRight size={14} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Details Panel - Smart Grid */}
                            {isExpanded && (
                                <div className="border-t border-white/5 bg-black/40 px-4 py-3 animate-in slide-in-from-top-1">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-3 uppercase tracking-wider font-bold">
                                        <FiActivity size={10} />
                                        <span>Event Properties</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {Object.entries(details).map(([key, value]) => (
                                            <div key={key} className="flex flex-col gap-1 min-w-0">
                                                <span className="text-[10px] text-slate-500 font-medium tracking-wide truncate">
                                                    {formatKey(key)}
                                                </span>
                                                <span className="text-sm text-slate-200 break-words font-medium">
                                                    {formatValue(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        )}
      </div>

       {/* Pagination */}
      <div className="flex items-center justify-between border-t border-white/5 pt-6">
        <p className="text-sm text-slate-500 pointer-events-none">
            Showing <span className="font-bold text-white">{logs.length}</span> of <span className="font-bold text-white">{total}</span> events
        </p>
        <div className="flex gap-2">
            <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="p-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
                <FiChevronLeft size={16} />
            </button>
            <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="p-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
                <FiChevronRight size={16} />
            </button>
        </div>
      </div>
    </div>
  );
}
