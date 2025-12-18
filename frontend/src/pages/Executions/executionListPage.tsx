// src/pages/Executions/executionsListPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiActivity, FiUser, FiZap, FiClock, FiCheck, FiX, FiRefreshCw, FiChevronRight, FiFilter } from "react-icons/fi";
import {
  fetchExecutions,
  type ExecutionSummary,
  type ExecutionStatus,
} from "../../api/executions";

type StatusFilter = "all" | ExecutionStatus;

const POLL_INTERVAL_MS = 3000;

const ExecutionsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [workflowIdFilterText, setWorkflowIdFilterText] = useState("");

  const pollTimerRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);

  const workflowIdFilter = useMemo(() => {
    const trimmed = workflowIdFilterText.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [workflowIdFilterText]);

  const loadExecutions = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const data = await fetchExecutions();
      setExecutions(data);
    } catch (err: any) {
      console.error("[ExecutionsListPage] Failed to load executions:", err);
      setError(err.message || "Failed to load");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    void loadExecutions();
  }, []);

  const filteredExecutions = useMemo(() => {
    return executions.filter((ex) => {
      if (statusFilter !== "all" && ex.status !== statusFilter) return false;
      if (workflowIdFilter != null && ex.workflow_id !== workflowIdFilter) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;

      const wfName = ex.workflows?.name?.toLowerCase() ?? "";
      const idStr = String(ex.id);
      return wfName.includes(q) || idStr.includes(q);
    });
  }, [executions, statusFilter, search, workflowIdFilter]);

  const shouldPoll = useMemo(() => {
    if (statusFilter === "running") return true;
    return executions.some((ex) => ex.status === "running" || ex.status === "queued");
  }, [executions, statusFilter]);

  useEffect(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (!shouldPoll) return;

    pollTimerRef.current = window.setInterval(() => {
      void loadExecutions({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [shouldPoll]);

  const getTriggerIcon = (type: string) => {
      switch(type?.toLowerCase()) {
          case 'manual': return <FiUser />;
          case 'webhook': return <FiZap />;
          case 'schedule': return <FiClock />;
          default: return <FiActivity />;
      }
  };

  return (
    <div className="h-full flex flex-col bg-[#020617] text-white overflow-hidden relative">
       {/* Ambient Glows */}
       <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
       <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="px-8 py-8 border-b border-white/5 z-10 shrink-0 bg-white/[0.02] backdrop-blur-xl">
        <div className="flex items-end justify-between mb-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Executions</h1>
                <p className="text-slate-400 text-sm">Monitor your automation history in real-time.</p>
            </div>
            <div className="flex gap-3">
                 {/* Refresh Button */}
                <button 
                    onClick={() => loadExecutions({ silent: false })}
                    disabled={refreshing || loading}
                    className="p-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50"
                >
                    <FiRefreshCw className={refreshing ? "animate-spin" : ""} size={16} />
                </button>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-6">
             {/* Search */}
            <div className="relative flex-1 max-w-lg">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <FiSearch className="text-slate-500 text-lg" />
                </div>
                <input 
                    type="text" 
                    placeholder="Search by execution ID, workflow ID, or name..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-black/60 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-inner"
                />
            </div>

            {/* Status Filters - Neon Glass Style */}
            <div className="flex items-center p-1 bg-black/40 border border-white/10 rounded-xl backdrop-blur-2xl shadow-2xl">
                {(['all', 'running', 'completed', 'failed'] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-300 relative overflow-hidden
                            ${statusFilter === s 
                                ? 'text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}
                        `}
                    >
                        {statusFilter === s && (
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-90 rounded-lg -z-10 animate-pulse-slow" />
                        )}
                        {statusFilter === s && s === 'running' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-orange-600 opacity-90 rounded-lg -z-10" />
                        )}
                        {statusFilter === s && s === 'failed' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-rose-600 to-red-600 opacity-90 rounded-lg -z-10" />
                        )}
                        {statusFilter === s && s === 'completed' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-90 rounded-lg -z-10" />
                        )}
                        {s}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar z-10 space-y-3">
          {loading && !refreshing ? (
              <div className="flex justify-center pt-24 flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center mb-6">
                      <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                      <FiActivity className="text-blue-500 text-xl" />
                  </div>
                  <span className="text-slate-500 text-sm tracking-wide">Fetching executions...</span>
              </div>
          ) : filteredExecutions.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-24 text-slate-500 opacity-60">
                  <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 border border-white/5 transform rotate-3">
                      <FiSearch size={32} className="text-slate-400 -rotate-3" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-1">No executions found</h3>
                  <p className="text-sm">Try adjusting your filters or search terms.</p>
              </div>
          ) : (
              <div className="space-y-3 pb-8">
                  {filteredExecutions.map((ex) => (
                      <div 
                        key={ex.id}
                        onClick={() => navigate(`/executions/${ex.id}`)}
                        className="group relative flex items-center justify-between p-4 pl-5 bg-white/[0.02] border border-white/5 rounded-2xl cursor-pointer transition-all duration-300 hover:bg-white/[0.04] hover:border-white/10 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 overflow-hidden"
                      >
                          {/* Left Accent Bar */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-300
                              ${ex.status === 'completed' ? 'bg-emerald-500' : ''}
                              ${ex.status === 'failed' ? 'bg-rose-500' : ''}
                              ${ex.status === 'running' ? 'bg-amber-500' : ''}
                              ${!['completed','failed','running'].includes(ex.status) ? 'bg-slate-700' : ''}
                          `} />

                          <div className="flex items-center gap-6 z-10">
                               {/* Status Icon */}
                              <div className={`
                                  w-11 h-11 rounded-xl flex items-center justify-center border shadow-lg transition-transform group-hover:scale-110 duration-300
                                  ${ex.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/10' : ''}
                                  ${ex.status === 'failed' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/10' : ''}
                                  ${ex.status === 'running' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/10' : ''}
                                  ${!['completed','failed','running'].includes(ex.status) ? 'bg-slate-800 border-slate-700 text-slate-500' : ''}
                              `}>
                                  {ex.status === 'completed' && <FiCheck size={18} strokeWidth={2.5} />}
                                  {ex.status === 'failed' && <FiX size={18} strokeWidth={2.5} />}
                                  {ex.status === 'running' && <div className="w-2.5 h-2.5 bg-current rounded-full animate-pulse shadow-[0_0_10px_currentColor]" />}
                              </div>

                              <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-3">
                                      <span className="text-white font-bold text-lg group-hover:text-blue-400 transition-colors">
                                          {ex.workflows?.name || "Untitled Workflow"}
                                      </span>
                                      <span className="text-slate-600 text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                                          #{ex.id}
                                      </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                      <span className={`uppercase tracking-wider text-[10px] flex items-center gap-1.5
                                          ${ex.status === 'failed' ? 'text-rose-400' : ''}
                                          ${ex.status === 'running' ? 'text-amber-400' : ''}
                                          ${ex.status === 'completed' ? 'text-emerald-400' : ''}
                                      `}>
                                          {ex.status}
                                      </span>
                                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                                      <span className="flex items-center gap-1.5 text-slate-400">
                                          {getTriggerIcon(ex.trigger_type || 'manual')} 
                                          <span className="capitalize">{ex.trigger_type || 'Manual'}</span>
                                      </span>
                                  </div>
                              </div>
                          </div>

                          <div className="flex items-center gap-10 z-10">
                                <div className="text-right hidden sm:block">
                                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Duration</div>
                                    <div className="font-mono text-sm text-slate-300 font-medium">
                                        {ex.duration_ms ? `${(ex.duration_ms/1000).toFixed(2)}s` : '-'}
                                    </div>
                                </div>
                                <div className="text-right min-w-[100px]">
                                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Started</div>
                                    <div className="text-sm text-slate-300 font-medium">
                                        {new Date(ex.started_at || '').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                                    <FiChevronRight className="text-white" />
                                </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

export default ExecutionsListPage
