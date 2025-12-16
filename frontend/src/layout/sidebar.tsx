import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FiGitBranch, FiActivity, FiZap, FiLogOut, FiUser, FiShield } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

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

        {/* Admin - Audit Logs (only show for Admin users) */}
        {user?.role?.name === "Admin" && (
          <NavLink
            to="/admin/audit-logs"
            className={({ isActive }) =>
              "nav-link d-flex align-items-center gap-2 rounded-3 " +
              (isActive ? "bg-primary text-light" : "text-light")
            }
          >
            <FiShield />
            <span>Audit Logs</span>
          </NavLink>
        )}
      </nav>

      {/* User Info & Logout */}
      <div className="mt-auto">
        {user && (
          <div
            className="mb-3 p-2 rounded-3"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div className="d-flex align-items-center gap-2 mb-2">
              <div
                className="d-flex align-items-center justify-content-center rounded-circle"
                style={{
                  width: "32px",
                  height: "32px",
                  backgroundColor: "rgba(74, 144, 217, 0.2)",
                  color: "#4a90d9",
                }}
              >
                <FiUser size={16} />
              </div>
              <div className="flex-grow-1 overflow-hidden">
                <div
                  className="text-light small fw-medium text-truncate"
                  title={user.full_name}
                >
                  {user.full_name}
                </div>
                <div
                  className="text-muted small text-truncate"
                  style={{ fontSize: "0.7rem" }}
                  title={user.email}
                >
                  {user.email}
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center justify-content-between">
              <span
                className="badge"
                style={{
                  backgroundColor:
                    user.role.name === "Admin"
                      ? "rgba(220, 53, 69, 0.2)"
                      : "rgba(40, 167, 69, 0.2)",
                  color: user.role.name === "Admin" ? "#f8d7da" : "#d4edda",
                  fontSize: "0.65rem",
                }}
              >
                {user.role.name}
              </span>
              <button
                onClick={handleLogout}
                className="btn btn-sm d-flex align-items-center gap-1"
                style={{
                  color: "rgba(255, 255, 255, 0.6)",
                  padding: "2px 8px",
                  fontSize: "0.75rem",
                }}
                title="Sign out"
              >
                <FiLogOut size={12} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
        <div className="text-muted small">
          <span>v0.1 MVP</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
