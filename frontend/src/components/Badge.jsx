export default function Badge({
  children,
  variant = "count", // 'active' | 'archived' | 'count' | 'warning' | 'danger' | 'info'
  size = "md", // 'sm' | 'md'
  className = "",
  style = {},
}) {
  const variantStyles = {
    active: {
      background: "rgba(34, 197, 94, 0.12)",
      borderColor: "rgba(34, 197, 94, 0.3)",
      color: "var(--success, #22c55e)",
    },
    archived: {
      background: "rgba(148, 163, 184, 0.12)",
      borderColor: "rgba(148, 163, 184, 0.3)",
      color: "var(--text-muted, #94a3b8)",
    },
    count: {
      background: "rgba(37, 99, 235, 0.15)",
      borderColor: "rgba(96, 165, 250, 0.3)",
      color: "var(--primary-lt, #60a5fa)",
    },
    warning: {
      background: "rgba(245, 158, 11, 0.12)",
      borderColor: "rgba(245, 158, 11, 0.3)",
      color: "var(--warning, #f59e0b)",
    },
    danger: {
      background: "rgba(239, 68, 68, 0.12)",
      borderColor: "rgba(239, 68, 68, 0.3)",
      color: "var(--danger, #ef4444)",
    },
    info: {
      background: "rgba(6, 182, 212, 0.12)",
      borderColor: "rgba(6, 182, 212, 0.3)",
      color: "var(--accent, #06b6d4)",
    },
  };

  const sizeStyles = {
    sm: { padding: "2px 8px", fontSize: "11px", height: "20px" },
    md: { padding: "4px 10px", fontSize: "12px", height: "24px" },
  };

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-full, 9999px)",
        border: "1px solid",
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
