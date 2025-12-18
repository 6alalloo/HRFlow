import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FiCheck, FiX, FiClock, FiBox, FiArrowRight, FiActivity, FiCpu, FiMessageSquare } from "react-icons/fi";
import {
  fetchExecutionWithSteps,
  type ExecutionDetailResponse,
  type ExecutionStep,
} from "../../api/executions";
import { executeWorkflow } from "../../api/workflows";

const ExecutionDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<ExecutionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<ExecutionStep | null>(null);
  const [rerunning, setRerunning] = useState(false);

  const executionId = params.id ? Number(params.id) : NaN;

  const load = useCallback(async () => {
    if (!executionId || Number.isNaN(executionId)) return;
    try {
      setLoading(true);
      const result = await fetchExecutionWithSteps(executionId);
      setData(result);
      if (result.steps.length > 0) {
          // Verify if there's a failed step to select by default, otherwise select first
          const failedStep = result.steps.find(s => s.status === 'failed');
          setSelectedStep(failedStep || result.steps[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => { void load(); }, [load]);

  const handleRerun = async () => {
      if (!data) return;
      setRerunning(true);
      try {
          const res = await executeWorkflow(data.execution.workflow_id, null, "manual");
          if (res?.execution?.id) navigate(`/executions/${res.execution.id}`);
      } catch (e) {
          console.error(e);
      } finally {
          setRerunning(false);
      }
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-500">Loading details...</div>;
  if (!data) return <div className="p-10 text-center text-slate-500">Execution not found</div>;

  const { execution, steps } = data;
  const isSuccess = execution.status === 'completed';

  return (
    <div className="h-full flex flex-col bg-navy-950 text-white overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* 1. Header Area */}
      <div className="px-8 py-6 border-b border-white/5 bg-navy-950/50 backdrop-blur-md z-10 flex items-center justify-between shrink-0">
        <div>
            <div className="flex items-center gap-3 mb-1">
                <Link to="/executions" className="text-slate-500 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
                    Waitlist <FiActivity />
                </Link>
                <span className="text-slate-600">/</span>
                <span className="text-slate-400 text-sm">Run #{execution.id}</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                {execution.workflows?.name || "Untitled Workflow"}
                <span className="text-slate-500 text-lg font-normal">#{execution.id}</span>
            </h1>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
                <span className="flex items-center gap-1.5">
                    <FiActivity className="text-blue-400"/> Triggered by <b className="text-slate-300 uppercase">{execution.trigger_type || 'Manual'}</b>
                </span>
                <span className="w-px h-3 bg-white/10" />
                <span className="flex items-center gap-1.5">
                    <FiClock className="text-purple-400"/> {execution.duration_ms ? `${(execution.duration_ms/1000).toFixed(2)}s` : '0s'}
                </span>
            </div>
        </div>

        <div className="flex items-center gap-6">
            {/* BIG STATUS PILL */}
            <div className={`
                px-6 py-2 rounded-full border shadow-[0_0_30px_rgba(0,0,0,0.3)] backdrop-blur-sm
                flex items-center gap-3 text-lg font-bold tracking-widest uppercase
                ${isSuccess 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-900/20' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-900/20'}
            `}>
                {isSuccess ? 'Success' : 'Failed'}
                {isSuccess ? <FiCheck className="w-6 h-6 border-2 border-current rounded-full p-0.5" /> : <FiX className="w-6 h-6 border-2 border-current rounded-full p-0.5" />}
            </div>

            <button 
                onClick={handleRerun}
                disabled={rerunning}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-white transition-all flex items-center gap-2"
            >
                {rerunning ? <FiActivity className="animate-spin" /> : <FiActivity />} Re-run
            </button>
        </div>
      </div>

      {/* 2. Split Content */}
      <div className="flex-1 flex overflow-hidden z-10">
          
          {/* LEFT: Timeline Panel */}
          <div className="w-[300px] border-r border-white/5 bg-navy-900/20 backdrop-blur-sm flex flex-col">
              <div className="p-3 border-b border-white/5">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Steps</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                  <div className="relative pl-3 space-y-4">
                      {/* Vertical Line */}
                      <div className="absolute left-[24px] top-3 bottom-3 w-px bg-white/5 z-0" />

                      {steps.map((step, idx) => {
                          const isSelected = selectedStep?.id === step.id;
                          const isStepSuccess = step.status === 'completed';
                          const isStepFailed = step.status === 'failed';
                          
                          return (
                              <div 
                                key={step.id} 
                                onClick={() => setSelectedStep(step)}
                                className={`relative z-10 cursor-pointer group flex items-start gap-3 p-2.5 rounded-lg border transition-all duration-200
                                    ${isSelected 
                                        ? 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-900/10' 
                                        : 'bg-navy-950/40 border-white/5 hover:bg-white/5 hover:border-white/10'}
                                `}
                              >
                                  {/* Status Circle */}
                                  <div className={`
                                      mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border shrink-0 shadow-lg
                                      ${isStepSuccess ? 'bg-emerald-500 text-navy-950 border-emerald-400' : ''}
                                      ${isStepFailed ? 'bg-rose-500 text-white border-rose-400' : ''}
                                      ${!isStepSuccess && !isStepFailed ? 'bg-slate-700 text-slate-400 border-slate-600' : ''}
                                  `}>
                                      {isStepSuccess && <FiCheck size={12} strokeWidth={3} />}
                                      {isStepFailed && <FiX size={12} strokeWidth={3} />}
                                  </div>

                                  <div className="min-w-0">
                                      <h4 className={`text-xs font-bold mb-0.5 ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                          {step.workflow_nodes?.name || `Node ${step.node_id}`}
                                      </h4>
                                      <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
                                          <span>{new Date(step.started_at || '').toLocaleTimeString()}</span>
                                      </div>
                                  </div>
                                  
                                  {isSelected && (
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                          <FiActivity className="text-blue-400 animate-pulse w-3 h-3" />
                                      </div>
                                  )}
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>

          {/* RIGHT: Detail Viewer */}
          <div className="flex-1 overflow-y-auto bg-navy-950/40 p-6 custom-scrollbar relative">
               {selectedStep ? (
                   <div className="max-w-4xl mx-auto space-y-5 animate-fade-in-up">
                       <div className="flex items-center gap-3 mb-4">
                           <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 text-lg">
                               <FiCpu className="text-blue-400" />
                           </div>
                           <div>
                               <h2 className="text-lg font-bold text-white">Step Details</h2>
                               <p className="text-slate-400 text-xs">Reviewing data for <span className="text-white font-mono">{selectedStep.workflow_nodes?.name}</span></p>
                           </div>
                       </div>

                       {/* Input Data Card */}
                       <div className="bg-[#0B0E14] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                           <div className="px-4 py-2.5 border-b border-white/5 bg-white/5 flex items-center justify-between">
                               <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                   <FiBox /> Input Data
                               </span>
                               <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono border border-blue-500/20">JSON</span>
                           </div>
                           <div className="p-0 overflow-x-auto">
                               <pre className="text-[11px] font-mono text-slate-300 p-4 leading-relaxed">
                                   {selectedStep.input_json ? JSON.stringify(JSON.parse(selectedStep.input_json), null, 2) : <span className="text-slate-600 italic">// No input data received</span>}
                               </pre>
                           </div>
                       </div>

                        {/* Arrow Divider */}
                       <div className="flex justify-center opacity-30">
                           <FiArrowRight size={20} className="text-slate-400 rotate-90" />
                       </div>

                       {/* Output Data Card */}
                       <div className={`bg-[#0B0E14] border rounded-xl overflow-hidden shadow-2xl ${
                           selectedStep.status === 'failed' ? 'border-rose-500/20 shadow-rose-900/10' : 'border-white/10'
                       }`}>
                           <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
                               selectedStep.status === 'failed' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-white/5'
                           }`}>
                               <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                                   selectedStep.status === 'failed' ? 'text-rose-400' : 'text-emerald-400'
                               }`}>
                                   <FiMessageSquare /> Output Data
                               </span>
                               <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                   selectedStep.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                               }`}>
                                   {selectedStep.status.toUpperCase()}
                               </span>
                           </div>
                           <div className="p-0 overflow-x-auto">
                               {selectedStep.logs && (
                                   <div className="border-b border-white/5 bg-rose-950/10 p-4 text-[11px] font-mono text-rose-300">
                                       <b className="block mb-1 text-rose-400">Error Log:</b>
                                       {selectedStep.logs}
                                   </div>
                               )}
                               <pre className="text-[11px] font-mono text-slate-300 p-4 leading-relaxed">
                                   {selectedStep.output_json ? JSON.stringify(JSON.parse(selectedStep.output_json), null, 2) : <span className="text-slate-600 italic">// No output data produced</span>}
                               </pre>
                           </div>
                       </div>
                   </div>
               ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-600">
                       <FiActivity size={48} className="mb-4 opacity-20" />
                       <p className="text-sm">Select a step from the timeline to view data.</p>
                   </div>
               )}
          </div>
      </div>
    </div>
  );
};

export default ExecutionDetailPage;
