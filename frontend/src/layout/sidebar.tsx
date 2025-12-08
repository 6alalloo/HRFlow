import React from "react";
import { NavLink } from "react-router-dom";
import { FiGitBranch, FiActivity, FiZap } from "react-icons/fi"; // FiZap for Builder

const Sidebar: React.FC = () => {
  return (
    <aside
      className="d-flex flex-column p-3"
      style={{
        width: "240px",
        backgroundColor: "#050816", // dark navy/black
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div className="mb-4">
        <div className="fs-4 fw-bold text-light">HRFlow</div>
        <div className="text-muted small">Automation Console</div>
      </div>

      <nav className="nav nav-pills flex-column gap-1 mb-4">
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

        {/* NEW: Builder goes directly to canvas */}
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

        {/* temporary hard-coded execution link just to verify the route */}
        <NavLink
          to="/executions/1"
          className={({ isActive }) =>
            "nav-link d-flex align-items-center gap-2 rounded-3 " +
            (isActive ? "bg-primary text-light" : "text-light")
          }
        >
          <FiActivity />
          <span>Sample Execution</span>
        </NavLink>
      </nav>

      <div className="mt-auto text-muted small">
        <span>v0.1 MVP</span>
      </div>
    </aside>
  );
};

export default Sidebar;