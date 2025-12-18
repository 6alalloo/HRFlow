import React, { useEffect, useState, useMemo } from 'react';
import type { WorkflowApi } from '../../api/workflows';
import WorkflowListSidebar from './components/WorkflowListSidebar';
import WorkflowDetailPanel from './components/WorkflowDetailPanel';

type WorkflowSplitLayoutProps = {
    workflows: WorkflowApi[];
    isLoading: boolean;
    isCreating: boolean;
    error: string | null;
    onCreate: () => void;
    onRun: (wf: WorkflowApi) => void;
};

const WorkflowSplitLayout: React.FC<WorkflowSplitLayoutProps> = ({
    workflows,
    isLoading,
    isCreating,
    error,
    onCreate, 
    onRun
}) => {
    // UI State
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    
    // Track initialization
    const initializedRef = React.useRef(false);

    // Auto-select first workflow if none selected and workflows exist
    useEffect(() => {
        if (!initializedRef.current && workflows.length > 0) {
            // Use setTimeout to avoid synchronous state update warning during effect
            setTimeout(() => {
                 setSelectedId(workflows[0].id);
            }, 0);
            initializedRef.current = true;
        }
    }, [workflows]);

    // Derived State: Selected Workflow
    const selectedWorkflow = useMemo(() => 
        workflows.find(w => w.id === selectedId) || null
    , [workflows, selectedId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500">
                <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full mr-3"/>
                Loading workflows...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-rose-500">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-navy-950 text-slate-200">
            {/* Left Pane: Sidebar List */}
            <div className="w-[600px] flex-shrink-0 h-full">
                <WorkflowListSidebar 
                    workflows={workflows}
                    activeWorkflowId={selectedId}
                    onSelect={setSelectedId}
                    onCreate={onCreate}
                    isCreating={isCreating}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filterStatus={filterStatus}
                    onFilterChange={setFilterStatus}
                />
            </div>

            {/* Right Pane: Details */}
            <div className="flex-1 h-full min-w-0">
                <WorkflowDetailPanel 
                    workflow={selectedWorkflow}
                    onRun={onRun}
                />
            </div>
        </div>
    );
};

export default WorkflowSplitLayout;
