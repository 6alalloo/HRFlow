import React, { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { FiGitBranch, FiActivity, FiZap, FiLogOut, FiUser, FiShield } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { createWorkflow, fetchWorkflows } from "../api/workflows";
import { Logo } from "../components/common/Logo";

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreating, setIsCreating] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleBuilderClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname.startsWith('/builder') || location.pathname.match(/\/workflows\/\d+\/builder/)) {
      // Already in builder, do nothing or maybe reset?
      return;
    }

    setIsCreating(true);
    try {
        // "Resume" logic: If the last modified workflow is a "Draft" (e.g., Untitled and recent), resume it.
        // For now, simpler heuristic: If there are workflows, pick the latest one?
        // User requested: "if there's a workflow saved but not ran".
        // We lack 'executions_count' here efficiently without fetching all executions.
        // Strategy: Create New always ensures a clean slate, BUT user asked for resume.
        // Let's Find the most recently updated workflow.
        
        const workflows = await fetchWorkflows();
        // Sort by updated_at desc
        const sorted = workflows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        
        const latest = sorted[0];
        
        // Use a heuristic: If it is named "Untitled Workflow", assume it's a draft
        if (latest && latest.name === "Untitled Workflow") {
            navigate(`/workflows/${latest.id}/builder`);
        } else {
            // Create new
            const newWorkflow = await createWorkflow({ name: "Untitled Workflow" });
            navigate(`/workflows/${newWorkflow.id}/builder`);
        }
    } catch (err) {
        console.error("Failed to handle builder click", err);
        // Fallback
        navigate('/builder'); 
    } finally {
        setIsCreating(false);
    }
  };

  const isBuilderActive = location.pathname.includes('/builder');

  return (
    <aside className="w-[280px] h-full flex flex-col bg-[#020617] border-r border-white/5 shrink-0 z-30">
      {/* Brand */}
      <div className="p-6 shrink-0 border-b border-white/5">
        <div className="d-flex align-items-center gap-3">
            <Logo style={{ width: '100px', height: 'auto' }} />
            <div>
                <div className="fw-bold text-white tracking-tight leading-4 text-xl">HRFlow</div>
                <div className="text-slate-500 font-medium text-[10px] tracking-[0.2em] mt-1 whitespace-nowrap">WORKFLOW AUTOMATION</div>
            </div>
        </div>
      </div>

      {/* Navigation - Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-2">
        {/* Workflows */}
        <NavLink
          to="/workflows"
          style={{ textDecoration: 'none' }}
          className={({ isActive }) =>
            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group !no-underline " +
            (isActive && !isBuilderActive 
                ? "bg-blue-600 !text-white shadow-lg shadow-blue-900/20 font-bold" 
                : "!text-slate-300 hover:!text-white hover:bg-white/5 font-bold")
          }
        >
          <FiGitBranch size={20} className="shrink-0" />
          <span className="text-base">Workflows</span>
        </NavLink>

        {/* Builder */}
        <a
          href="/builder"
          onClick={handleBuilderClick}
          style={{ textDecoration: 'none' }}
          className={
            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer group !no-underline " +
            (isBuilderActive 
                ? "bg-blue-600 !text-white shadow-lg shadow-blue-900/20 font-bold" 
                : "!text-slate-300 hover:!text-white hover:bg-white/5 font-bold")
          }
        >
          <FiZap size={20} className="shrink-0" />
          <span className="text-base">{isCreating ? "Loading..." : "Builder"}</span>
        </a>

        {/* Executions list */}
        <NavLink
          to="/executions"
          style={{ textDecoration: 'none' }}
          className={({ isActive }) =>
            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group !no-underline " +
            (isActive 
                ? "bg-blue-600 !text-white shadow-lg shadow-blue-900/20 font-bold" 
                : "!text-slate-300 hover:!text-white hover:bg-white/5 font-bold")
          }
        >
          <FiActivity size={20} className="shrink-0" />
          <span className="text-base">Executions</span>
        </NavLink>

        {/* Admin - Audit Logs (only show for Admin users) */}
        {user?.role?.name === "Admin" && (
          <NavLink
            to="/admin/audit-logs"
            style={{ textDecoration: 'none' }}
            className={({ isActive }) =>
              "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group !no-underline " +
              (isActive 
                  ? "bg-blue-600 !text-white shadow-lg shadow-blue-900/20 font-bold" 
                  : "!text-slate-300 hover:!text-white hover:bg-white/5 font-bold")
            }
          >
            <FiShield size={20} className="shrink-0" />
            <span className="text-base">Audit Logs</span>
          </NavLink>
        )}
      </div>

      {/* User Info & Logout - Fixed at Bottom */}
      <div className="p-4 shrink-0 border-t border-white/5 bg-[#020617]">
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
                <FiUser size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold truncate">
                  {user.full_name}
                </div>
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    {user.role.name}
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
                title="Sign out"
              >
                <FiLogOut size={16} />
              </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
