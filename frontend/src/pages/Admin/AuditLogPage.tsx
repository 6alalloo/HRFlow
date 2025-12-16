import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { apiGet } from "../../api/apiClient";

interface AuditLog {
  id: number;
  action: string; // Maps to event_type in our service
  actor_user_id: number | null;
  entity_type: string | null; // Maps to target_type
  entity_id: number | null; // Maps to target_id
  data_json: string | null;
  created_at: string;
  users?: {
    id: number;
    email: string;
  };
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({
    eventType: "",
    targetType: "",
  });

  useEffect(() => {
    fetchAuditLogs();
  }, [offset, filters]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (filters.eventType) params.append("eventType", filters.eventType);
      if (filters.targetType) params.append("targetType", filters.targetType);

      const response = await apiGet<AuditLogsResponse>(`/audit?${params.toString()}`);
      setLogs(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getEventBadgeColor = (eventType: string) => {
    if (eventType.includes("created")) return "badge-success";
    if (eventType.includes("updated")) return "badge-info";
    if (eventType.includes("deleted")) return "badge-danger";
    if (eventType.includes("failed")) return "badge-danger";
    if (eventType.includes("completed")) return "badge-success";
    return "badge-secondary";
  };

  const getUserName = (log: AuditLog) => {
    if (!log.users) return log.actor_user_id ? `User ${log.actor_user_id}` : "System";
    return log.users.email;
  };

  const parseDetails = (log: AuditLog) => {
    try {
      if (log.data_json) {
        return JSON.parse(log.data_json);
      }
      return {};
    } catch {
      return {};
    }
  };

  if (!user || user.role?.name !== "Admin") {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          <h4>Access Denied</h4>
          <p>You must be an administrator to view audit logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col">
          <h1 className="h3 mb-0">Audit Logs</h1>
          <p className="text-muted">View all system activity and changes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Event Type</label>
              <select
                className="form-select"
                value={filters.eventType}
                onChange={(e) =>
                  setFilters({ ...filters, eventType: e.target.value })
                }
              >
                <option value="">All Events</option>
                <option value="workflow_created">Workflow Created</option>
                <option value="workflow_updated">Workflow Updated</option>
                <option value="workflow_deleted">Workflow Deleted</option>
                <option value="execution_started">Execution Started</option>
                <option value="execution_completed">Execution Completed</option>
                <option value="execution_failed">Execution Failed</option>
                <option value="user_login">User Login</option>
                <option value="user_logout">User Logout</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Target Type</label>
              <select
                className="form-select"
                value={filters.targetType}
                onChange={(e) =>
                  setFilters({ ...filters, targetType: e.target.value })
                }
              >
                <option value="">All Targets</option>
                <option value="workflow">Workflow</option>
                <option value="execution">Execution</option>
                <option value="user">User</option>
              </select>
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <button
                className="btn btn-secondary"
                onClick={() => setFilters({ eventType: "", targetType: "" })}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="row mb-4">
        <div className="col-md-12">
          <div className="alert alert-info mb-0">
            Showing {logs.length} of {total} total audit log entries
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event</th>
                    <th>User</th>
                    <th>Target</th>
                    <th>Details</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td>
                        <span
                          className={`badge ${getEventBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td>{getUserName(log)}</td>
                      <td>
                        {log.entity_type && log.entity_id ? (
                          <span className="text-muted">
                            {log.entity_type} #{log.entity_id}
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <details>
                          <summary className="cursor-pointer text-primary">
                            View
                          </summary>
                          <pre className="mt-2 mb-0 p-2 bg-light rounded small">
                            {JSON.stringify(parseDetails(log), null, 2)}
                          </pre>
                        </details>
                      </td>
                      <td className="text-muted">
                        {parseDetails(log).ipAddress || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <button
                className="btn btn-outline-primary"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </button>
              <span className="text-muted">
                Page {Math.floor(offset / limit) + 1} of{" "}
                {Math.ceil(total / limit)}
              </span>
              <button
                className="btn btn-outline-primary"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
