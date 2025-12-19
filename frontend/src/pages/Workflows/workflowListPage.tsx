import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlay } from "react-icons/fi";
import {
  fetchWorkflows,
  executeWorkflow,
  createWorkflow,
  deleteWorkflow,
} from "../../api/workflows";
import type { WorkflowApi } from "../../api/workflows";
import WorkflowSplitLayout from "./WorkflowSplitLayout";
import { FiTrash2, FiAlertTriangle } from "react-icons/fi";

// Re-adding generic Modal for Run
type RunModalProps = {
  workflow: WorkflowApi | null;
  isOpen: boolean;
  inputText: string;
  onInputTextChange: (value: string) => void;
  onClose: () => void;
  onConfirmRun: () => void;
  isRunning: boolean;
  error: string | null;
};

// Custom Delete Modal
type DeleteModalProps = {
    workflow: WorkflowApi | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
};

const DeleteConfirmationModal: React.FC<DeleteModalProps> = ({ workflow, isOpen, onClose, onConfirm, isDeleting }) => {
    if (!isOpen || !workflow) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1060]" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1070] w-full max-w-sm">
                <div className="bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl overflow-hidden p-6">
                    <h3 className="text-lg font-bold text-white mb-2">Delete Workflow?</h3>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        Are you sure you want to delete <span className="text-white font-medium">{workflow.name}</span>? This action cannot be undone.
                    </p>
                        
                    <div className="flex gap-3 justify-end">
                            <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="px-4 py-2 text-slate-300 hover:text-white text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-900/20 flex items-center gap-2 transition-all"
                        >
                            {isDeleting ? "Deleting..." : "Delete Workflow"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

const ExecuteWorkflowModal: React.FC<RunModalProps> = ({
  workflow,
  isOpen,
  inputText,
  onInputTextChange,
  onClose,
  onConfirmRun,
  isRunning,
  error,
}) => {
  if (!isOpen || !workflow) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[1040]"
        onClick={onClose}
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1050] w-full max-w-lg">
        <div className="bg-navy-900 text-white border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-white/5">
            <h5 className="text-lg font-bold">Run Workflow</h5>
            <button
              type="button"
              className="text-slate-400 hover:text-white transition-colors"
              onClick={onClose}
              disabled={isRunning}
            >
                ✕
            </button>
          </div>
          <div className="p-6">
            <p className="mb-2 text-sm text-slate-300">
              You are about to run the workflow: <br/>
              <strong className="text-white text-base">{workflow.name}</strong>
            </p>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              ID: {workflow.id}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-sm">
                {error}
              </div>
            )}

            <div className="mb-3">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Run input (JSON)</label>
              <textarea
                className="w-full bg-black/30 text-sm text-white border border-white/10 rounded-lg p-3 font-mono focus:border-cyan-500/50 focus:outline-none transition-all"
                rows={7}
                placeholder={`{\n  "name": "Sara Ali",\n  "email": "sara@company.com"\n}`}
                value={inputText}
                onChange={(e) => onInputTextChange(e.target.value)}
              />
              <div className="mt-1 text-[10px] text-slate-500">
                This JSON is sent to the backend as the execution input.
              </div>
            </div>
          </div>
          <div className="p-4 bg-black/20 border-t border-white/5 flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              onClick={onClose}
              disabled={isRunning}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-cyan-900/20 flex items-center gap-2 transition-all disabled:opacity-50"
              onClick={onConfirmRun}
              disabled={isRunning}
            >
              <FiPlay className="w-4 h-4" />
              {isRunning ? "Running..." : "Run Workflow"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/** ---------- Main page component ---------- **/

const WorkflowsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [workflows, setWorkflows] = useState<WorkflowApi[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Run Modal State
  const [selectedWorkflowForRun, setSelectedWorkflowForRun] = useState<WorkflowApi | null>(null);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runInputText, setRunInputText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Delete Modal State
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowApi | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create State
  const [isCreating, setIsCreating] = useState(false);

  // Load Workflows
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const apiWorkflows = await fetchWorkflows();
        setWorkflows(apiWorkflows);
      } catch (err) {
        console.error("[Workflows] Failed to load workflows", err);
        setLoadError("Failed to load workflows. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  // Handlers
  const handleOpenRunModal = (wf: WorkflowApi) => {
    setSelectedWorkflowForRun(wf);
    setRunInputText("");
    setRunError(null);
    setIsRunModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isRunning) return;
    setIsRunModalOpen(false);
  };

  const handleCreateWorkflow = async () => {
    try {
      setIsCreating(true);
      const created = await createWorkflow({
        name: "New Workflow",
        description: "Empty workflow. Add nodes to build your flow.",
        isActive: false, // Default to inactive/draft
      });
      // Add to list and navigate
      setWorkflows((prev) => [created, ...prev]);
      navigate(`/workflows/${created.id}/builder`);
    } catch (err) {
        alert("Failed to create workflow. See console.");
        console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRequest = (wf: WorkflowApi) => {
      setWorkflowToDelete(wf);
      setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
      if (!workflowToDelete) return;
      try {
          setIsDeleting(true);
          await deleteWorkflow(workflowToDelete.id);
          // Remove from list
          setWorkflows(prev => prev.filter(w => w.id !== workflowToDelete.id));
          setIsDeleteModalOpen(false);
          setWorkflowToDelete(null);
      } catch (err) {
          console.error("Failed to delete workflow", err);
          alert("Failed to delete workflow");
      } finally {
          setIsDeleting(false);
      }
  };

  const handleConfirmRun = async () => {
    if (!selectedWorkflowForRun) return;

    let inputObj: Record<string, unknown> | null = null;
    const trimmed = runInputText.trim();
    if (trimmed.length > 0) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setRunError('Run input must be a JSON object.');
          return;
        }
        inputObj = parsed;
      } catch {
        setRunError("Invalid JSON.");
        return;
      }
    }

    try {
      setIsRunning(true);
      setRunError(null);
      await executeWorkflow(selectedWorkflowForRun.id, inputObj, "manual");
      // We don't need to capture execution here anymore as we rely on the RecentExecutions list update
      // But we might want to trigger a refresh or show a toast?
      // For now, simple success.
      setIsRunModalOpen(false);
    } catch (err) {
      console.error("[Workflows] Failed to run workflow", err);
      setRunError("Failed to run workflow. Please try again.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
        <WorkflowSplitLayout 
            workflows={workflows}
            isLoading={isLoading}
            isCreating={isCreating}
            error={loadError}
            onCreate={handleCreateWorkflow}
            onRun={handleOpenRunModal}
            onDelete={handleDeleteRequest}
        />

        {/* Reusing existing Modal Logic */}
        <ExecuteWorkflowModal
            workflow={selectedWorkflowForRun} // Type mismatch fix might be needed if mapped differently, but WorkflowApi should match
            isOpen={isRunModalOpen}
            inputText={runInputText}
            onInputTextChange={setRunInputText}
            onClose={handleCloseModal}
            onConfirmRun={handleConfirmRun}
            isRunning={isRunning}
            error={runError}
        />

        <DeleteConfirmationModal 
            workflow={workflowToDelete}
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            isDeleting={isDeleting}
        />
    </>
  );
};

export default WorkflowsListPage;
