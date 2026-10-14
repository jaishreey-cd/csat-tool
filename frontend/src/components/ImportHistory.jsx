import { useState, useEffect, useCallback } from "react";
import Button from "./Button";
import Badge from "./Badge";
import Spinner from "./Spinner";
import EmptyState from "./EmptyState";
import dataSyncApi from "../api/dataSyncApi";

export default function ImportHistory({
  isOpen,
  onClose,
  onBatchRolledBack,
  onShowToast,
}) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rollingBackId, setRollingBackId] = useState(null);
  const [confirmingRollbackId, setConfirmingRollbackId] = useState(null);

  const fetchImports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await dataSyncApi.getImports();
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load import history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchImports();
    } else {
      setConfirmingRollbackId(null);
    }
  }, [isOpen, fetchImports]);

  const handleRollback = async (batchId) => {
    setRollingBackId(batchId);
    try {
      const res = await dataSyncApi.rollback(batchId);
      if (onShowToast) {
        onShowToast(res.message, "info");
      }
      if (onBatchRolledBack) {
        onBatchRolledBack(res.clients_data_last_updated);
      }
      fetchImports();
    } catch (err) {
      if (onShowToast) {
        onShowToast(err?.response?.data?.detail || "Failed to rollback batch.", "error");
      }
    } finally {
      setRollingBackId(null);
      setConfirmingRollbackId(null);
    }
  };

  if (!isOpen) return null;

  // Identify the latest applied batch
  const latestAppliedBatch = batches.find((b) => b.status === "applied");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
        backgroundColor: "rgba(10, 22, 40, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          height: "100%",
          background: "var(--bg-surface, #0d1b2a)",
          borderLeft: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          boxShadow: "var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.45))",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s ease-out",
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "17px", color: "var(--text-white, #ffffff)", fontWeight: 600 }}>
              Import History
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-dim, #64748b)" }}>
              Audit log of all dataset synchronizations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history drawer"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-dim, #64748b)",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            &times;
          </button>
        </div>

        {/* Drawer Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", gap: "10px", color: "var(--text-muted, #94a3b8)" }}>
              <Spinner size="md" />
              <span>Loading past batches...</span>
            </div>
          ) : error ? (
            <div style={{ color: "var(--danger, #ef4444)", fontSize: "13px", padding: "12px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "var(--radius-sm, 6px)" }}>
              {error}
            </div>
          ) : batches.length === 0 ? (
            <EmptyState
              title="No import history"
              description="No datasets have been imported yet."
              icon="📜"
            />
          ) : (
            batches.map((b) => {
              const isApplied = b.status === "applied";
              const isLatestApplied = latestAppliedBatch && latestAppliedBatch.id === b.id;

              return (
                <div
                  key={b.id}
                  style={{
                    background: "var(--bg-card, rgba(14, 30, 50, 0.8))",
                    border: `1px solid ${
                      isApplied ? "var(--border, rgba(96, 165, 250, 0.1))" : "rgba(148, 163, 184, 0.15)"
                    }`,
                    borderRadius: "var(--radius-lg, 12px)",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-white, #ffffff)" }}>
                        Batch #{b.id}
                      </span>
                      <Badge variant={isApplied ? "active" : "archived"}>
                        {isApplied ? "Applied" : "Rolled Back"}
                      </Badge>
                    </div>
                    <Badge variant="count">{b.mode}</Badge>
                  </div>

                  {/* Metadata */}
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div>
                      File: <strong style={{ color: "var(--text-main, #e2e8f0)" }}>{b.filename}</strong>
                    </div>
                    <div>
                      Time: {new Date(b.uploaded_at).toLocaleString()}
                    </div>
                    {b.uploaded_by_email && (
                      <div>By: {b.uploaded_by_email}</div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "6px",
                      background: "rgba(10, 22, 40, 0.4)",
                      padding: "8px",
                      borderRadius: "var(--radius-sm, 6px)",
                      fontSize: "11px",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--text-dim, #64748b)" }}>Projects: </span>
                      <strong style={{ color: "var(--primary-lt, #60a5fa)" }}>+{b.projects_created}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-dim, #64748b)" }}>Updated: </span>
                      <strong style={{ color: "var(--warning, #f59e0b)" }}>~{b.projects_updated}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-dim, #64748b)" }}>Archived: </span>
                      <strong style={{ color: "var(--danger, #ef4444)" }}>-{b.projects_archived}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-dim, #64748b)" }}>Clients: </span>
                      <strong style={{ color: "var(--primary-lt, #60a5fa)" }}>+{b.clients_created}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-dim, #64748b)" }}>Updated: </span>
                      <strong style={{ color: "var(--warning, #f59e0b)" }}>~{b.clients_updated}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-dim, #64748b)" }}>Reactivated: </span>
                      <strong style={{ color: "var(--success, #22c55e)" }}>+{b.projects_reactivated}</strong>
                    </div>
                  </div>

                  {/* Rollback trigger - only available for the latest applied batch */}
                  {isLatestApplied && (
                    <div style={{ marginTop: "4px", borderTop: "1px solid var(--border, rgba(96, 165, 250, 0.1))", paddingTop: "10px" }}>
                      {confirmingRollbackId !== b.id ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmingRollbackId(b.id)}
                          style={{ width: "100%" }}
                        >
                          ↺ Rollback This Batch
                        </Button>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ fontSize: "11px", color: "var(--warning, #f59e0b)" }}>
                            Confirm reverting all changes from batch #{b.id}?
                          </span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleRollback(b.id)}
                              loading={rollingBackId === b.id}
                              style={{ flex: 1 }}
                            >
                              Yes, Revert
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingRollbackId(null)}
                              disabled={rollingBackId === b.id}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
