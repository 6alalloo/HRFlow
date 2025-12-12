import React from "react";
import { NavLink } from "react-router-dom";
import { FiGitBranch, FiActivity, FiZap } from "react-icons/fi";

const Sidebar: React.FC = () => {
  return (
    <aside
      className="d-flex flex-column p-3"
      style={{
        width: "240px",
        backgroundColor: "#050816",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Brand */}
      <div className="mb-4">
        <div className="fs-4 fw-bold text-light">HRFlow</div>
        <div className="text-muted small">Automation Console</div>
      </div>

      {/* Navigation */}
      <nav className="nav nav-pills flex-column gap-1 mb-4">
        {/* Workflows */}
        <NavLink
          to="/workflows"
          className={({ isActive }) =>
            "nav-link d-flex align-items-center gap-2 rounded-3 " +
            (isActive ? "bg-primary text-light" : "text-light")
          }
        >
          <FiGitBranch />
          <span>Workflows</span>
        </NavLink>

        {/* Builder */}
        <NavLink
          to="/builder"
          className={({ isActive }) =>
            "nav-link d-flex align-items-center gap-2 rounded-3 " +
            (isActive ? "bg-primary text-light" : "text-light")
          }
        >
          <FiZap />
          <span>Builder</span>
        </NavLink>

        {/* Executions list */}
        <NavLink
          to="/executions"
          className={({ isActive }) =>
            "nav-link d-flex align-items-center gap-2 rounded-3 " +
            (isActive ? "bg-primary text-light" : "text-light")
          }
        >
          <FiActivity />
          <span>Executions</span>
        </NavLink>
      </nav>

      {/* Footer */}
      <div className="mt-auto text-muted small">
        <span>v0.1 MVP</span>
      </div>
    </aside>
  );
};

export default Sidebar;
