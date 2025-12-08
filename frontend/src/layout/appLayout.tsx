import React from "react";
import Sidebar from "./sidebar";

type AppLayoutProps = {
  children: React.ReactNode;
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div
      className="d-flex"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bs-body-bg)",
        color: "var(--bs-body-color)",
      }}
    >
      {/* Left sidebar */}
      <Sidebar />

      {/* Right side: header + page content */}
      <main className="flex-grow-1 d-flex flex-column">
        {/* Top bar */}
        <header
          className="d-flex align-items-center justify-content-between px-4 py-3"
          style={{
            borderBottom: "1px solid var(--bs-border-color)",
            backgroundColor: "#05050a",
          }}
        >
          <div className="fw-semibold">HRFlow Dashboard</div>
          <div className="text-muted small">User: demo@hrflow.local</div>
        </header>

        {/* Page content */}
        <div className="container-fluid flex-grow-1">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;