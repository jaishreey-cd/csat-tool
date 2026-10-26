export default function Badge({
  children,
  variant = "count", // 'active' | 'archived' | 'count' | 'warning' | 'danger' | 'info' | 'success'
  size = "md", // 'sm' | 'md'
  dot = null, // boolean override, defaults to true for status variants
  className = "",
  style = {},
}) {
  const variantStyles = {
    active: {
      background: "var(--badge-success-bg, rgba(34, 197, 94, 0.12))",
      borderColor: "var(--badge-success-border, rgba(34, 197, 94, 0.35))",
      color: "var(--badge-success-text, #22c55e)",
    },
    success: {
      background: "var(--badge-success-bg, rgba(34, 197, 94, 0.12))",
      borderColor: "var(--badge-success-border, rgba(34, 197, 94, 0.35))",
      color: "var(--badge-success-text, #22c55e)",
    },
    archived: {
      background: "var(--bg-hover, rgba(148, 163, 184, 0.12))",
      borderColor: "var(--border, rgba(148, 163, 184, 0.3))",
      color: "var(--text-muted, #94a3b8)",
    },
    count: {
      background: "var(--badge-count-bg, rgba(37, 99, 235, 0.14))",
      borderColor: "var(--badge-count-border, rgba(96, 165, 250, 0.32))",
      color: "var(--badge-count-text, #60a5fa)",
    },
    warning: {
      background: "var(--badge-warning-bg, rgba(245, 158, 11, 0.14))",
      borderColor: "var(--badge-warning-border, rgba(245, 158, 11, 0.35))",
      color: "var(--badge-warning-text, #f59e0b)",
    },
    danger: {
      background: "var(--badge-danger-bg, rgba(239, 68, 68, 0.14))",
      borderColor: "var(--badge-danger-border, rgba(239, 68, 68, 0.35))",
      color: "var(--badge-danger-text, #ef4444)",
    },
    info: {
      background: "var(--badge-info-bg, rgba(6, 182, 212, 0.14))",
      borderColor: "var(--badge-info-border, rgba(6, 182, 212, 0.35))",
      color: "var(--badge-info-text, #06b6d4)",
    },
  };

  const sizeStyles = {
    sm: { padding: "2px 8px", fontSize: "11px", height: "20px" },
    md: { padding: "3px 10px", fontSize: "12px", height: "24px" },
  };

  const shouldShowDot = dot !== null ? dot : ["active", "success", "warning", "danger", "info"].includes(variant);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-full, 9999px)",
        border: "1px solid",
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        letterSpacing: "0.2px",
        transition: "all 0.15s ease",
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
    >
      {shouldShowDot && (
        <span
          aria-hidden="true"
          style={{
            width: size === "sm" ? "5px" : "6px",
            height: size === "sm" ? "5px" : "6px",
            borderRadius: "50%",
            backgroundColor: "currentColor",
            boxShadow: "0 0 6px currentColor",
            opacity: 0.9,
            marginRight: "6px",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
