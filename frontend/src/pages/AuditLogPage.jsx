import { useState, useEffect } from "react";
import auditApi from "../api/auditApi";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (resourceFilter !== "ALL") {
        params.resource_type = resourceFilter;
      }
      const data = await auditApi.getLogs(params);
      setLogs(data || []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [resourceFilter]);

  const filteredLogs = logs.filter((l) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      l.actor_email?.toLowerCase().includes(term) ||
      l.action?.toLowerCase().includes(term) ||
      l.details?.toLowerCase().includes(term) ||
      l.resource_type?.toLowerCase().includes(term)
    );
  });

  const getActionBadgeVariant = (action) => {
    if (action.startsWith("CREATE")) return "success";
    if (action.startsWith("UPDATE") || action.startsWith("TOGGLE")) return "info";
    if (action.startsWith("DELETE") || action.startsWith("ARCHIVE") || action.startsWith("ROLLBACK")) return "warning";
    return "neutral";
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
            System Audit Log
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>
            Comprehensive administrative audit trail documenting role changes, dataset merges, category updates, and question bank mutations.
          </p>
        </div>
        <Button variant="secondary" onClick={loadLogs} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Logs"}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "center",
          marginBottom: "24px",
          background: "var(--bg-surface, #0d1b2a)",
          padding: "14px 20px",
          borderRadius: "10px",
          border: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
        }}
      >
        <input
          type="text"
          placeholder="Filter by actor email, action, details..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 14px",
            borderRadius: "6px",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.2))",
            color: "var(--text-main, #e2e8f0)",
            fontSize: "13px",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>
            Resource:
          </label>
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid var(--border, rgba(96, 165, 250, 0.2))",
              color: "var(--text-main, #e2e8f0)",
              fontSize: "13px",
            }}
          >
            <option value="ALL">All Resources</option>
            <option value="USER">User / PMO</option>
            <option value="USER_ASSIGNMENT">User Assignment</option>
            <option value="CATEGORY">Category</option>
            <option value="QUESTION_TEMPLATE">Question Bank</option>
            <option value="CLIENT">Client</option>
            <option value="PROJECT">Project</option>
            <option value="SURVEY">Survey</option>
            <option value="IMPORT_BATCH">Import Batch</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
          borderRadius: "12px",
          padding: "20px",
        }}
      >
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}><Spinner size="lg" /></div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)" }}>
            No audit records matching criteria.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))", textAlign: "left", color: "var(--text-muted, #94a3b8)" }}>
                  <th style={{ padding: "10px 12px", width: "180px" }}>Timestamp</th>
                  <th style={{ padding: "10px 12px" }}>Actor Email</th>
                  <th style={{ padding: "10px 12px" }}>Action</th>
                  <th style={{ padding: "10px 12px" }}>Resource</th>
                  <th style={{ padding: "10px 12px" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                      color: "var(--text-main, #e2e8f0)",
                    }}
                  >
                    <td style={{ padding: "12px", color: "var(--text-muted, #94a3b8)", fontSize: "12px", whiteSpace: "nowrap" }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "12px", fontWeight: 600, color: "#93c5fd" }}>
                      {log.actor_email}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "rgba(100, 116, 139, 0.2)",
                          color: "#cbd5e1",
                        }}
                      >
                        {log.resource_type} {log.resource_id ? `#${log.resource_id}` : ""}
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "var(--text-main, #e2e8f0)" }}>
                      {log.details || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
