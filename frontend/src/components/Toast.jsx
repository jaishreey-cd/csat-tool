import { useEffect } from "react";

export default function Toast({
  message,
  type = "info", // 'success' | 'error' | 'warning' | 'info'
  onClose,
  duration = 4000,
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const typeConfig = {
    success: {
      borderColor: "var(--success, #22c55e)",
      bg: "rgba(34, 197, 94, 0.15)",
      textColor: "#86efac",
      icon: "✓",
    },
    error: {
      borderColor: "var(--danger, #ef4444)",
      bg: "rgba(239, 68, 68, 0.15)",
      textColor: "#fca5a5",
      icon: "✕",
    },
    warning: {
      borderColor: "var(--warning, #f59e0b)",
      bg: "rgba(245, 158, 11, 0.15)",
      textColor: "#fde68a",
      icon: "⚠",
    },
    info: {
      borderColor: "var(--primary-lt, #60a5fa)",
      bg: "rgba(37, 99, 235, 0.15)",
      textColor: "#bfdbfe",
      icon: "ℹ",
    },
  };

  const current = typeConfig[type] || typeConfig.info;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 200,
        background: "var(--bg-surface, #0d1b2a)",
        border: `1px solid ${current.borderColor}`,
        borderRadius: "var(--radius-md, 9px)",
        boxShadow: "var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.45))",
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        maxWidth: "420px",
        color: "var(--text-main, #e2e8f0)",
        fontSize: "14px",
        animation: "toastSlideIn 0.25s ease-out",
      }}
    >
      <span
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: current.bg,
          color: current.textColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: "bold",
          flexShrink: 0,
        }}
      >
        {current.icon}
      </span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-dim, #64748b)",
          cursor: "pointer",
          fontSize: "16px",
          padding: "2px 4px",
          lineHeight: 1,
        }}
      >
        &times;
      </button>

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
