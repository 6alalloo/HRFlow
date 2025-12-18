import React from 'react';
import { motion } from 'framer-motion';
import { FiChevronRight, FiClock, FiActivity } from 'react-icons/fi';
import type { WorkflowApi } from '../../../api/workflows';

type WorkflowCardProps = {
    workflow: WorkflowApi;
    isActive: boolean;
    onClick: () => void;
};

const WorkflowCard: React.FC<WorkflowCardProps> = ({ workflow, isActive, onClick }) => {
    return (
        <motion.div
            layoutId={`workflow-card-${workflow.id}`}
            onClick={onClick}
            className={`
                group relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer border transition-all duration-300
                ${isActive 
                    ? 'bg-gradient-to-r from-blue-600/20 to-cyan-500/10 border-blue-500/30 shadow-[0_4px_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-400/20' 
                    : 'bg-white/5 border-white/5 hover:border-white/10 hover:shadow-lg hover:shadow-black/20 hover:bg-white/10'
                }
            `}
        >
            <div className="flex items-center gap-3 min-w-0">
                {/* 1. Type Icon (Visual Anchor) */}
                <div className={`
                    w-8 h-8 rounded text-xs flex items-center justify-center border transition-colors flex-shrink-0
                    ${isActive 
                        ? 'bg-blue-500/20 border-blue-400/30 text-blue-300' 
                        : 'bg-navy-900 border-white/5 text-slate-500 group-hover:text-slate-300 group-hover:border-white/10'}
                `}>
                    <FiActivity size={16} className={isActive ? 'animate-pulse' : ''} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3 className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white transition-colors'}`}>
                            {workflow.name}
                        </h3>
                         {/* Status Dot */}
                         {workflow.is_active && (
                            <span className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                         )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                         <div className={`
                            px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase tracking-wider border
                            ${workflow.is_active 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}
                        `}>
                            {workflow.is_active ? 'Active' : 'Draft'}
                        </div>
                        <span className="text-[9px] text-slate-500 font-medium hidden sm:inline-block">
                             {new Date(workflow.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Side: Active Indicator */}
            {isActive && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <FiChevronRight className="text-blue-400 w-4 h-4 opacity-0 animate-slide-in" /> 
                </div>
            )}
        </motion.div>
    );
};

export default WorkflowCard;
