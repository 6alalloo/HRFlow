import React from 'react';
import { FiPlay, FiLayers, FiClock, FiSettings, FiActivity } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { WorkflowApi } from '../../../api/workflows';
import RecentExecutions from './RecentExecutions';

type WorkflowDetailPanelProps = {
    workflow: WorkflowApi | null;
    onRun: (wf: WorkflowApi) => void;
};

const WorkflowDetailPanel: React.FC<WorkflowDetailPanelProps> = ({ workflow, onRun }) => {
    const navigate = useNavigate();

    if (!workflow) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full bg-navy-950/50 backdrop-blur-sm">
                <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                     <FiLayers size={24} className="opacity-20" />
                </div>
                <p className="text-sm">Select a workflow to view details</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-navy-950/80 backdrop-blur-xl border-l border-white/5 relative">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                <div className="max-w-4xl"> 
                    {/* 1. Header (Compact) */}
                    <div className="mb-5 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10 shadow-lg backdrop-blur-md flex-shrink-0">
                                <FiLayers className="text-blue-400 text-lg" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white tracking-tight leading-tight">
                                    {workflow.name}
                                </h1>
                                <p className="text-slate-400 text-xs leading-snug max-w-2xl mt-0.5">
                                    {workflow.description || "No description provided."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 relative z-10">
                        {/* LEFT COLUMN: Stats */}
                        <div>
                            <div className="bg-white/5 rounded-xl p-4 border border-white/5 shadow-inner">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                        <FiActivity className="text-cyan-400"/> Performance
                                    </h3>
                                    <span className="text-[9px] text-slate-500 bg-black/20 px-1.5 py-0.5 rounded">30 Days</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                                    <div>
                                        <div className="text-[9px] text-slate-400 mb-0.5 uppercase tracking-wide">Runs</div>
                                        <div className="text-xl font-bold text-white">150</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-slate-400 mb-0.5 uppercase tracking-wide">Success</div>
                                        <div className="text-xl font-bold text-emerald-400">98%</div>
                                    </div>
                                     <div>
                                        <div className="text-[9px] text-slate-400 mb-0.5 uppercase tracking-wide">Avg Time</div>
                                        <div className="text-xl font-bold text-white">1.2s</div>
                                    </div>
                                     <div>
                                        <div className="text-[9px] text-slate-400 mb-0.5 uppercase tracking-wide">Last Run</div>
                                        <div className="text-xl font-bold text-white">Today</div>
                                    </div>
                                </div>
                                
                                <div className="mt-5 pt-3 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-xs text-slate-300">
                                        <FiClock className="text-purple-400 w-3 h-3" />
                                        <span className="text-[10px]">Runs daily at 9:00 AM UTC</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Recent Executions */}
                        <div className="h-full">
                             <div className="bg-white/5 rounded-xl p-4 border border-white/5 h-full">
                                <div className="mb-2">
                                     <RecentExecutions workflowId={workflow.id} />
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Footer Actions */}
            <div className="px-5 py-3 bg-navy-950/90 backdrop-blur border-t border-white/5 z-20">
                <div className="max-w-4xl flex gap-3"> 
                    <button
                        onClick={() => onRun(workflow)}
                        className="flex-1 px-3 py-2 bg-gradient-to-b from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white border border-white/10 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.2)] backdrop-blur-md group"
                    >
                        <FiPlay className="text-emerald-400 group-hover:scale-110 transition-transform" /> <span className="text-shadow-sm">Run</span>
                    </button>
                    <button
                        onClick={() => navigate(`/workflows/${workflow.id}/builder`)}
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:brightness-110 text-white rounded-lg font-bold text-xs shadow-[0_0_20px_rgba(59,130,246,0.5)] border border-white/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01]"
                    >
                        <FiSettings className="text-white animate-spin-slow" /> Builder
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkflowDetailPanel;
