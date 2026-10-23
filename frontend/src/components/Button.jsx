import { useState } from "react";
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
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const sizeStyles = {
    sm: { padding: "0 12px", fontSize: "13px", height: "34px", gap: "6px" },
    md: { padding: "0 16px", fontSize: "14px", height: "40px", gap: "8px" },
    lg: { padding: "0 22px", fontSize: "15px", height: "46px", gap: "10px" },
  };

  const getVariantStyle = () => {
    switch (variant) {
      case "primary":
        return {
          background: isHovered
            ? "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)"
            : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: isHovered
            ? "0 4px 16px rgba(37, 99, 235, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25)"
            : "0 2px 8px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
          fontWeight: 600,
        };
      case "danger":
        return {
          background: isHovered
            ? "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)"
            : "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: isHovered
            ? "0 4px 16px rgba(239, 68, 68, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25)"
            : "0 2px 8px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
          fontWeight: 600,
        };
      case "secondary":
        return {
          background: isHovered
            ? "rgba(96, 165, 250, 0.12)"
            : "rgba(96, 165, 250, 0.04)",
          color: isHovered ? "var(--text-white, #ffffff)" : "var(--text-main, #e2e8f0)",
          border: isHovered
            ? "1px solid var(--border-glow, rgba(96, 165, 250, 0.5))"
            : "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          backdropFilter: "blur(6px)",
          fontWeight: 600,
        };
      case "ghost":
      default:
        return {
          background: isHovered ? "rgba(96, 165, 250, 0.08)" : "transparent",
          color: isHovered ? "var(--text-white, #ffffff)" : "var(--text-muted, #94a3b8)",
          border: "1px solid transparent",
          fontWeight: 500,
        };
    }
  };

  const isInteractive = !disabled && !loading;

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-md, 10px)",
    cursor: isInteractive ? "pointer" : "not-allowed",
    opacity: isInteractive ? 1 : 0.65,
    transform: isInteractive && isActive ? "scale(0.98)" : isInteractive && isHovered ? "translateY(-1px)" : "none",
    transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
    userSelect: "none",
    outline: "none",
    letterSpacing: "-0.1px",
    ...sizeStyles[size],
    ...getVariantStyle(),
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsActive(false);
      }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={baseStyle}
      className={className}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : icon}
      <span>{children}</span>
    </button>
  );
}
