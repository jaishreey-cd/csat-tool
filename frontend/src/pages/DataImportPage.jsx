import { useState, useEffect } from "react";
import dataSyncApi from "../api/dataSyncApi";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";

export default function DataImportPage() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("add_update");
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [rollingBackId, setRollingBackId] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "info" });

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await dataSyncApi.getImports();
      setImportHistory(data || []);
    } catch (err) {
      console.error("Failed to load import history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreviewData(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    try {
      setPreviewing(true);
      const data = await dataSyncApi.preview(file, mode);
      setPreviewData(data);
      setToast({ message: "File parsed and validated successfully.", type: "success" });
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || "Failed to validate dataset.",
        type: "error",
      });
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file) return;
    try {
      setConfirming(true);
      const result = await dataSyncApi.confirm(file, mode);
      setToast({
        message: `Import successful! Created ${result.new_clients} clients, ${result.new_projects} projects.`,
        type: "success",
      });
      setFile(null);
      setPreviewData(null);
      await loadHistory();
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || "Import execution failed.",
        type: "error",
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleRollback = async (batchId) => {
    if (!window.confirm(`Are you sure you want to rollback import batch #${batchId}?`)) return;
    try {
      setRollingBackId(batchId);
      await dataSyncApi.rollback(batchId);
      setToast({ message: `Successfully rolled back batch #${batchId}.`, type: "success" });
      await loadHistory();
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || "Rollback failed. You can only rollback the latest applied batch.",
        type: "error",
      });
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
          Data Import & Synchronization
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>
          Upload client and project datasets (Excel or CSV), preview merge diffs, validate records, and manage historical imports.
        </p>
      </div>

      {/* Upload & Validation Card */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "32px",
        }}
      >
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-white, #ffffff)", margin: "0 0 16px 0" }}>
          Import Client & Project Data
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 240px auto", gap: "16px", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", marginBottom: "6px" }}>
              Select File (.xlsx, .xls, .csv)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, rgba(96, 165, 250, 0.2))",
                background: "rgba(15, 23, 42, 0.6)",
                color: "var(--text-main, #e2e8f0)",
                fontSize: "13px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", marginBottom: "6px" }}>
              Import Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, rgba(96, 165, 250, 0.2))",
                background: "rgba(15, 23, 42, 0.6)",
                color: "var(--text-main, #e2e8f0)",
                fontSize: "13px",
              }}
            >
              <option value="add_update">Add & Update (Merge)</option>
              <option value="full_sync">Full Sync (Archive missing)</option>
            </select>
          </div>

          <div>
            <Button
              variant="primary"
              onClick={handlePreview}
              disabled={!file || previewing}
            >
              {previewing ? "Validating..." : "Validate & Preview"}
            </Button>
          </div>
        </div>

        {/* Validation Diff Preview */}
        {previewData && (
          <div
            style={{
              marginTop: "24px",
              padding: "20px",
              borderRadius: "8px",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#60a5fa", margin: "0 0 12px 0" }}>
              Validation Summary for "{file?.name}"
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginBottom: "18px" }}>
              <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                <div style={{ fontSize: "11px", color: "#6ee7b7", fontWeight: 700 }}>NEW CLIENTS</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>{previewData.diff?.new_clients?.length || 0}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                <div style={{ fontSize: "11px", color: "#6ee7b7", fontWeight: 700 }}>NEW PROJECTS</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>{previewData.diff?.new_projects?.length || 0}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(59, 130, 246, 0.1)", borderRadius: "8px", border: "1px solid rgba(59, 130, 246, 0.25)" }}>
                <div style={{ fontSize: "11px", color: "#93c5fd", fontWeight: 700 }}>UPDATED PROJECTS</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>{previewData.diff?.updated_projects?.length || 0}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(100, 116, 139, 0.1)", borderRadius: "8px", border: "1px solid rgba(100, 116, 139, 0.25)" }}>
                <div style={{ fontSize: "11px", color: "#cbd5e1", fontWeight: 700 }}>UNCHANGED</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>{previewData.diff?.unchanged_projects || 0}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
                <div style={{ fontSize: "11px", color: "#fca5a5", fontWeight: 700 }}>VALIDATION ERRORS</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>{previewData.validation_errors?.length || 0}</div>
              </div>
            </div>

            {/* In-file duplicates warning */}
            {previewData.in_file_duplicates?.length > 0 && (
              <div style={{ padding: "10px 14px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "6px", marginBottom: "16px", color: "#fcd34d", fontSize: "13px" }}>
                ⚠️ Found {previewData.in_file_duplicates.length} duplicate row(s) in file. Only the latest occurrence will be applied.
              </div>
            )}

            {/* Validation errors table */}
            {previewData.validation_errors?.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "13px", fontWeight: 600, color: "#f87171", margin: "0 0 8px 0" }}>Row Errors (Skipped):</h4>
                <div style={{ maxHeight: "150px", overflowY: "auto", background: "rgba(0,0,0,0.3)", padding: "8px 12px", borderRadius: "6px", fontSize: "12px", color: "#fca5a5" }}>
                  {previewData.validation_errors.map((err, idx) => (
                    <div key={idx} style={{ padding: "3px 0" }}>
                      Row {err.row}: {err.field} — {err.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                disabled={confirming}
              >
                {confirming ? "Applying Import..." : "Confirm & Apply Import"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPreviewData(null);
                  setFile(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Historical Imports Table */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-white, #ffffff)", margin: 0 }}>
            Import History & Rollback Log
          </h2>
          <Button variant="secondary" onClick={loadHistory} disabled={loadingHistory}>
            {loadingHistory ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {loadingHistory ? (
          <div style={{ padding: "40px", textAlign: "center" }}><Spinner size="lg" /></div>
        ) : importHistory.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "14px" }}>
            No dataset imports recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))", textAlign: "left", color: "var(--text-muted, #94a3b8)" }}>
                  <th style={{ padding: "10px 12px" }}>Batch #</th>
                  <th style={{ padding: "10px 12px" }}>Filename</th>
                  <th style={{ padding: "10px 12px" }}>Mode</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px" }}>New Clients</th>
                  <th style={{ padding: "10px 12px" }}>New Projects</th>
                  <th style={{ padding: "10px 12px" }}>Imported At</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((b, idx) => {
                  const isLatestApplied = idx === 0 && b.status === "applied";
                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        color: "var(--text-main, #e2e8f0)",
                      }}
                    >
                      <td style={{ padding: "12px", fontWeight: 700 }}>#{b.id}</td>
                      <td style={{ padding: "12px", fontWeight: 600 }}>{b.filename}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "rgba(100, 116, 139, 0.2)", color: "#cbd5e1" }}>
                          {b.mode}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <Badge variant={b.status === "applied" ? "success" : "warning"}>
                          {b.status}
                        </Badge>
                      </td>
                      <td style={{ padding: "12px", color: "#34d399", fontWeight: 700 }}>+{b.new_clients}</td>
                      <td style={{ padding: "12px", color: "#60a5fa", fontWeight: 700 }}>+{b.new_projects}</td>
                      <td style={{ padding: "12px", color: "var(--text-muted, #94a3b8)" }}>
                        {new Date(b.uploaded_at).toLocaleString()}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        {isLatestApplied ? (
                          <button
                            type="button"
                            onClick={() => handleRollback(b.id)}
                            disabled={rollingBackId === b.id}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: "rgba(239, 68, 68, 0.15)",
                              color: "#f87171",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              cursor: "pointer",
                            }}
                          >
                            {rollingBackId === b.id ? "Rolling back..." : "Rollback"}
                          </button>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "info" })}
        />
      )}
    </div>
  );
}
