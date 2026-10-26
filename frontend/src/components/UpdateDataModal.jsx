import { useState, useEffect, useCallback } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Badge from "./Badge";
import Spinner from "./Spinner";
import FileDropzone from "./FileDropzone";
import dataSyncApi from "../api/dataSyncApi";

export default function UpdateDataModal({
  isOpen,
  onClose,
  onSuccess,
  onShowToast,
}) {
  const [mode, setMode] = useState("add_update"); // 'add_update' | 'full_sync'
  const [file, setFile] = useState(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState("");

  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);
  const [confirmationInput, setConfirmationInput] = useState("");

  // Rollback state
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);

  // Expandable list toggles
  const [expandedSection, setExpandedSection] = useState(null);

  // Reset modal state on close/open
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewData(null);
      setPreviewError("");
      setConfirmResult(null);
      setConfirmationInput("");
      setShowRollbackConfirm(false);
      setExpandedSection(null);
      setMode("add_update");
    }
  }, [isOpen]);

  // Trigger preview when file or mode changes
  const fetchPreview = useCallback(async (selectedFile, selectedMode) => {
    if (!selectedFile) {
      setPreviewData(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const data = await dataSyncApi.preview(selectedFile, selectedMode);
      setPreviewData(data);
    } catch (err) {
      setPreviewData(null);
      setPreviewError(err?.response?.data?.detail || "Failed to parse preview from file.");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setConfirmResult(null);
    fetchPreview(selectedFile, mode);
  };

  const handleFileRemove = () => {
    setFile(null);
    setPreviewData(null);
    setPreviewError("");
    setConfirmResult(null);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (file) {
      fetchPreview(file, newMode);
    }
  };

  const handleConfirmSync = async () => {
    if (!file || !previewData || !previewData.can_confirm) return;

    setConfirmLoading(true);
    try {
      const result = await dataSyncApi.confirm(file, mode);
      setConfirmResult(result);
      if (onShowToast) {
        onShowToast("Dataset imported successfully!", "success");
      }
      if (onSuccess) {
        onSuccess(result.clients_data_last_updated);
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast(err?.response?.data?.detail || "Import confirmation failed.", "error");
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!confirmResult?.batch_id) return;
    setRollbackLoading(true);
    try {
      const res = await dataSyncApi.rollback(confirmResult.batch_id);
      if (onShowToast) {
        onShowToast(res.message, "info");
      }
      if (onSuccess) {
        onSuccess(res.clients_data_last_updated);
      }
      onClose();
    } catch (err) {
      if (onShowToast) {
        onShowToast(err?.response?.data?.detail || "Rollback failed.", "error");
      }
    } finally {
      setRollbackLoading(false);
      setShowRollbackConfirm(false);
    }
  };

  // Calculations for archive warnings
  const totalWouldBeArchived =
    (previewData?.diff_summary?.would_be_archived_clients?.count || 0) +
    (previewData?.diff_summary?.would_be_archived_projects?.count || 0);

  const isFullSyncWithArchives = mode === "full_sync" && totalWouldBeArchived > 0;
  const isApplyDisabled =
    !file ||
    previewLoading ||
    !previewData ||
    !previewData.can_confirm ||
    (isFullSyncWithArchives && confirmationInput.trim() !== "UPDATE");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Client & Project Dataset"
      maxWidth="720px"
      footer={
        confirmResult ? (
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <div>
              {!showRollbackConfirm ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRollbackConfirm(true)}
                  disabled={rollbackLoading}
                >
                  ↺ Undo This Import
                </Button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--warning, #f59e0b)" }}>Confirm undo?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleRollback}
                    loading={rollbackLoading}
                  >
                    Yes, Roll Back
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRollbackConfirm(false)}
                    disabled={rollbackLoading}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <Button variant="primary" size="md" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" size="md" onClick={onClose} disabled={confirmLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={isApplyDisabled}
              loading={confirmLoading}
              onClick={handleConfirmSync}
            >
              Apply Updates
            </Button>
          </>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Post-Import Result Panel */}
        {confirmResult ? (
          <div
            style={{
              padding: "20px",
              background: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: "var(--radius-lg, 12px)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px" }}>🎉</span>
              <div>
                <h4 style={{ margin: 0, fontSize: "16px", color: "#86efac", fontWeight: 600 }}>
                  Data Merge Successfully Applied
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                  Import Batch #{confirmResult.batch_id} · Mode: {confirmResult.mode}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "10px",
                marginTop: "4px",
              }}
            >
              <StatPill label="Projects Created" value={confirmResult.projects_created} color="var(--primary-lt, #60a5fa)" />
              <StatPill label="Projects Updated" value={confirmResult.projects_updated} color="var(--warning, #f59e0b)" />
              <StatPill label="Clients Created" value={confirmResult.clients_created} color="var(--primary-lt, #60a5fa)" />
              <StatPill label="Clients Updated" value={confirmResult.clients_updated} color="var(--warning, #f59e0b)" />
              {confirmResult.projects_archived > 0 && (
                <StatPill label="Projects Archived" value={confirmResult.projects_archived} color="var(--danger, #ef4444)" />
              )}
              {confirmResult.projects_reactivated > 0 && (
                <StatPill label="Reactivated" value={confirmResult.projects_reactivated} color="var(--success, #22c55e)" />
              )}
              <StatPill label="Unchanged" value={confirmResult.unchanged} color="var(--text-dim, #64748b)" />
            </div>

            <div style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", marginTop: "4px" }}>
              Last updated timestamp refreshed to:{" "}
              {new Date(confirmResult.clients_data_last_updated).toLocaleString()}
            </div>
          </div>
        ) : (
          <>
            {/* Step 1: Info Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "14px 16px",
                background: "rgba(37, 99, 235, 0.1)",
                border: "1px solid rgba(96, 165, 250, 0.2)",
                borderRadius: "var(--radius-md, 9px)",
                fontSize: "13px",
                lineHeight: 1.5,
                color: "var(--text-main, #e2e8f0)",
              }}
            >
              <span style={{ fontSize: "18px", color: "var(--primary-lt, #60a5fa)" }}>🛡️</span>
              <div>
                <strong>Safe Merge Guarantee:</strong> Existing data is never deleted. New records are added,
                changed records are updated, and records removed from Utiliza can be safely archived.
              </div>
            </div>

            {/* Step 2: Mode Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                Sync Mode
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <ModeCard
                  title="Add & update only"
                  subtitle="New records are added, existing are updated. Missing records remain untouched."
                  badge="Recommended"
                  active={mode === "add_update"}
                  onClick={() => handleModeChange("add_update")}
                />
                <ModeCard
                  title="Full sync"
                  subtitle="Archive records missing from the file. Preserves full historical audit."
                  active={mode === "full_sync"}
                  onClick={() => handleModeChange("full_sync")}
                />
              </div>
            </div>

            {/* Step 3: FileDropzone */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                Spreadsheet Upload
              </label>
              <FileDropzone
                file={file}
                onFileSelect={handleFileSelect}
                onFileRemove={handleFileRemove}
                disabled={previewLoading || confirmLoading}
              />
            </div>

            {/* Step 4: Preview Diagnostics */}
            {previewLoading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px",
                  gap: "10px",
                  color: "var(--text-muted, #94a3b8)",
                  fontSize: "14px",
                }}
              >
                <Spinner size="md" />
                <span>Analyzing and computing diffs...</span>
              </div>
            )}

            {previewError && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: "var(--radius-md, 9px)",
                  color: "#fca5a5",
                  fontSize: "13px",
                }}
              >
                <strong>Validation Error:</strong> {previewError}
              </div>
            )}

            {previewData && !previewLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Summary Tiles */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
                  <SummaryTile
                    label="New"
                    count={
                      previewData.diff_summary.new_clients.count +
                      previewData.diff_summary.new_projects.count
                    }
                    color="var(--primary-lt, #60a5fa)"
                    onClick={() => setExpandedSection(expandedSection === "new" ? null : "new")}
                    active={expandedSection === "new"}
                  />
                  <SummaryTile
                    label="Updated"
                    count={
                      previewData.diff_summary.updated_clients.count +
                      previewData.diff_summary.updated_projects.count
                    }
                    color="var(--warning, #f59e0b)"
                    onClick={() => setExpandedSection(expandedSection === "updated" ? null : "updated")}
                    active={expandedSection === "updated"}
                  />
                  <SummaryTile
                    label="Unchanged"
                    count={
                      previewData.diff_summary.unchanged_clients +
                      previewData.diff_summary.unchanged_projects
                    }
                    color="var(--text-dim, #64748b)"
                  />
                  <SummaryTile
                    label="Reactivated"
                    count={
                      previewData.diff_summary.reactivated_clients.count +
                      previewData.diff_summary.reactivated_projects.count
                    }
                    color="var(--success, #22c55e)"
                    onClick={() =>
                      setExpandedSection(expandedSection === "reactivated" ? null : "reactivated")
                    }
                    active={expandedSection === "reactivated"}
                  />
                  <SummaryTile
                    label="Will Archive"
                    count={totalWouldBeArchived}
                    color="var(--danger, #ef4444)"
                    onClick={() =>
                      setExpandedSection(expandedSection === "archived" ? null : "archived")
                    }
                    active={expandedSection === "archived"}
                  />
                </div>

                {/* Expandable Section Details */}
                {expandedSection === "new" && (
                  <DiffExpandList
                    title="New Entities to be Created"
                    items={[
                      ...previewData.diff_summary.new_clients.items,
                      ...previewData.diff_summary.new_projects.items,
                    ]}
                  />
                )}

                {expandedSection === "updated" && (
                  <DiffExpandList
                    title="Updated Records (Fields changed: Old → New)"
                    items={[
                      ...previewData.diff_summary.updated_clients.items,
                      ...previewData.diff_summary.updated_projects.items,
                    ]}
                    showChanges
                  />
                )}

                {expandedSection === "reactivated" && (
                  <DiffExpandList
                    title="Archived Records Being Reactivated"
                    items={[
                      ...previewData.diff_summary.reactivated_clients.items,
                      ...previewData.diff_summary.reactivated_projects.items,
                    ]}
                    showChanges
                  />
                )}

                {expandedSection === "archived" && (
                  <DiffExpandList
                    title="Records that will be Archived (Missing from file)"
                    items={[
                      ...previewData.diff_summary.would_be_archived_clients.items,
                      ...previewData.diff_summary.would_be_archived_projects.items,
                    ]}
                  />
                )}

                {/* Row-Level Errors Table */}
                {previewData.errors && previewData.errors.length > 0 && (
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: "var(--radius-md, 9px)",
                      padding: "12px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ color: "#fca5a5", fontWeight: 600, fontSize: "13px" }}>
                      ⚠️ {previewData.errors.length} Row Validation Errors (Must fix file to apply):
                    </div>
                    <div style={{ maxHeight: "140px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {previewData.errors.map((err, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: "12px",
                            color: "#fecaca",
                            background: "rgba(0, 0, 0, 0.2)",
                            padding: "6px 10px",
                            borderRadius: "var(--radius-sm, 6px)",
                          }}
                        >
                          <strong>Row {err.row}</strong> [{err.field}]: {err.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* In-File Duplicates */}
                {previewData.in_file_duplicates && previewData.in_file_duplicates.length > 0 && (
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                      borderRadius: "var(--radius-md, 9px)",
                      padding: "10px 14px",
                      fontSize: "12px",
                      color: "#fde68a",
                    }}
                  >
                    ℹ️ <strong>{previewData.in_file_duplicates.length} in-file duplicates detected.</strong> First occurrence kept; duplicates skipped.
                  </div>
                )}

                {/* Step 5: Full Sync Confirmation Input */}
                {isFullSyncWithArchives && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: "var(--radius-md, 9px)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#fca5a5" }}>
                      ⚠️ Archive Confirmation Required
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                      Full sync mode will archive {totalWouldBeArchived} active records missing from this file.
                      To confirm this action, please type <strong>UPDATE</strong> below:
                    </p>
                    <input
                      type="text"
                      placeholder="Type UPDATE"
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      style={{
                        height: "38px",
                        padding: "0 12px",
                        background: "var(--bg-surface, #0d1b2a)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        borderRadius: "var(--radius-sm, 6px)",
                        color: "var(--text-white, #ffffff)",
                        fontSize: "13px",
                        outline: "none",
                        width: "180px",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function ModeCard({ title, subtitle, badge = null, active = false, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 16px",
        borderRadius: "var(--radius-md, 9px)",
        border: `1px solid ${
          active ? "var(--primary-lt, #60a5fa)" : "var(--border, rgba(96, 165, 250, 0.1))"
        }`,
        background: active ? "var(--bg-active, rgba(37, 99, 235, 0.15))" : "var(--bg-hover, rgba(13, 27, 42, 0.4))",
        cursor: "pointer",
        transition: "all 0.15s ease",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
          {title}
        </span>
        {badge && <Badge variant="count">{badge}</Badge>}
      </div>
      <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", lineHeight: 1.4 }}>
        {subtitle}
      </span>
    </div>
  );
}

function SummaryTile({ label, count, color, active = false, onClick = null }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? "var(--bg-hover, rgba(30, 58, 95, 0.4))" : "var(--bg-surface, #0d1b2a)",
        border: `1px solid ${active ? color : "var(--border, rgba(96, 165, 250, 0.1))"}`,
        borderRadius: "var(--radius-md, 9px)",
        padding: "10px 8px",
        textAlign: "center",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: "20px", fontWeight: 700, color }}>{count}</div>
      <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
        {label}
      </div>
    </div>
  );
}

function DiffExpandList({ title, items = [], showChanges = false }) {
  if (!items || items.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--bg-hover, rgba(10, 22, 40, 0.6))",
        border: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
        borderRadius: "var(--radius-md, 9px)",
        padding: "12px 16px",
        maxHeight: "180px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>
        {title} ({items.length})
      </div>
      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            padding: "6px 8px",
            background: "var(--bg-surface, #0d1b2a)",
            borderRadius: "var(--radius-sm, 6px)",
          }}
        >
          <div>
            <span style={{ color: "var(--text-main, #e2e8f0)", fontWeight: 500 }}>{item.name}</span>
          </div>

          {showChanges && item.changes && item.changes.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {item.changes.map((ch, cIdx) => (
                <span
                  key={cIdx}
                  style={{
                    fontSize: "11px",
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    color: "#fde68a",
                  }}
                >
                  {ch.field}: {ch.old_value || "—"} → <strong>{ch.new_value || "—"}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div
      style={{
        background: "var(--bg-surface, #0d1b2a)",
        padding: "8px 12px",
        borderRadius: "var(--radius-sm, 6px)",
        border: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
      }}
    >
      <div style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>{label}</div>
      <div style={{ fontSize: "16px", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
