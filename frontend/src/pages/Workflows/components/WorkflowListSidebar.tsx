import React from 'react';
import { FiSearch, FiPlus } from 'react-icons/fi';
import type { WorkflowApi } from '../../../api/workflows';
import WorkflowCard from './WorkflowCard';

type WorkflowListSidebarProps = {
    workflows: WorkflowApi[];
    activeWorkflowId: number | null;
    onSelect: (id: number) => void;
    onCreate: () => void;
    isCreating: boolean;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    filterStatus: 'all' | 'active' | 'inactive';
    onFilterChange: (s: 'all' | 'active' | 'inactive') => void;
};

const WorkflowListSidebar: React.FC<WorkflowListSidebarProps> = ({
    workflows,
    activeWorkflowId,
    onSelect,
    onCreate,
    isCreating,
    searchQuery,
    onSearchChange,
    filterStatus,
    onFilterChange
}) => {
    // 1. Filter Logic
    const filtered = workflows.filter(wf => {
        // Status Filter
        if (filterStatus === 'active' && !wf.is_active) return false;
        if (filterStatus === 'inactive' && wf.is_active) return false;

        // Search Filter
        const q = searchQuery.toLowerCase();
        return (
            wf.name.toLowerCase().includes(q) ||
            (wf.description || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="flex flex-col h-full bg-navy-950/80 backdrop-blur-xl border-r border-white/5 relative z-30">
            {/* Header / Toolbar */}
            <div className="p-6 border-b border-white/5 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                     <h2 className="text-lg font-bold text-white tracking-tight">Workflows</h2>
                      <button 
                        onClick={onCreate}
                        disabled={isCreating}
                        className="p-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 hover:scale-105"
                        title="Create New Workflow"
                    >
                        {isCreating ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <FiPlus size={18} />}
                    </button>
                </div>

                <div className="flex gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1 group">
                        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search workflows..." 
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-inner"
                        />
                    </div>

                    {/* Filter Dropdown (Simplified as button for now to match look) */}
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                        <button 
                            onClick={() => onFilterChange('all')}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${filterStatus === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                        >
                            All
                        </button>
                        <button 
                            onClick={() => onFilterChange('active')}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${filterStatus === 'active' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm border border-emerald-500/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-white/5'}`}
                        >
                            Active
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {filtered.length > 0 ? (
                    filtered.map(wf => (
                        <WorkflowCard 
                            key={wf.id}
                            workflow={wf}
                            isActive={wf.id === activeWorkflowId}
                            onClick={() => onSelect(wf.id)}
                        />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-2">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
                            <FiSearch size={20} opacity={0.5} />
                        </div>
                        <p className="text-sm font-medium">No workflows found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkflowListSidebar;
