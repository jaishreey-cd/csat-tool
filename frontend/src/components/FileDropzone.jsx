import { useState, useRef } from "react";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function FileDropzone({
  file,
  onFileSelect,
  onFileRemove,
  disabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const validateAndProcessFile = (selectedFile) => {
    setError("");
    if (!selectedFile) return;

    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (![".csv", ".xlsx"].includes(ext)) {
      setError("Invalid file type. Please upload a .csv or .xlsx spreadsheet.");
      return;
    }

    if (selectedFile.size > MAX_SIZE_BYTES) {
      setError(`File size exceeds 5 MB limit (${formatFileSize(selectedFile.size)}).`);
      return;
    }

    onFileSelect(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          style={{
            border: `2px dashed ${
              isDragging
                ? "var(--primary-lt, #60a5fa)"
                : "var(--border-strong, rgba(96, 165, 250, 0.25))"
            }`,
            borderRadius: "var(--radius-lg, 12px)",
            backgroundColor: isDragging
              ? "var(--bg-active, rgba(37, 99, 235, 0.15))"
              : "rgba(13, 27, 42, 0.5)",
            padding: "32px 20px",
            textAlign: "center",
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                validateAndProcessFile(e.target.files[0]);
              }
            }}
            disabled={disabled}
          />
          <div style={{ fontSize: "32px" }}>📊</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main, #e2e8f0)" }}>
            Drag and drop your spreadsheet here, or <span style={{ color: "var(--primary-lt, #60a5fa)" }}>browse</span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-dim, #64748b)" }}>
            Supported formats: .xlsx or .csv (Max 5 MB)
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
            borderRadius: "var(--radius-md, 9px)",
            padding: "14px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>
              {file.name.endsWith(".csv") ? "📄" : "📑"}
            </span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                {file.name}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                {formatFileSize(file.size)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onFileRemove}
            disabled={disabled}
            aria-label="Remove selected file"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-dim, #64748b)",
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: "18px",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm, 6px)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger, #ef4444)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim, #64748b)")}
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: "13px",
            color: "var(--danger, #ef4444)",
            padding: "6px 10px",
            background: "rgba(239, 68, 68, 0.1)",
            borderRadius: "var(--radius-sm, 6px)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
