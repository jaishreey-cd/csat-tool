import Spinner from "./Spinner";

export default function Button({
  children,
  variant = "primary", // 'primary' | 'secondary' | 'danger' | 'ghost'
  size = "md", // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  icon = null,
  type = "button",
  onClick,
  className = "",
  style = {},
  ...props
}) {
  const sizeStyles = {
    sm: { padding: "6px 12px", fontSize: "13px", height: "32px", gap: "6px" },
    md: { padding: "8px 16px", fontSize: "14px", height: "40px", gap: "8px" },
    lg: { padding: "12px 22px", fontSize: "15px", height: "46px", gap: "10px" },
  };

  const variantStyles = {
    primary: {
      background: "var(--primary, #2563eb)",
      color: "var(--text-white, #ffffff)",
      border: "1px solid transparent",
      boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
    },
    secondary: {
      background: "transparent",
      color: "var(--text-main, #e2e8f0)",
      border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
    },
    danger: {
      background: "var(--danger, #ef4444)",
      color: "var(--text-white, #ffffff)",
      border: "1px solid transparent",
      boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-muted, #94a3b8)",
      border: "1px solid transparent",
    },
  };

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-md, 9px)",
    fontWeight: 500,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.65 : 1,
    transition: "all 0.15s ease",
    userSelect: "none",
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={baseStyle}
      className={className}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : icon}
      <span>{children}</span>
    </button>
  );
}
