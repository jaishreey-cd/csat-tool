export default function Spinner({ size = "md", className = "" }) {
  const sizeMap = {
    sm: 16,
    md: 22,
    lg: 32,
  };
  const dimension = sizeMap[size] || 22;

  return (
    <span
      className={className}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: "var(--radius-full, 9999px)",
        border: "2px solid rgba(255, 255, 255, 0.2)",
        borderTopColor: "var(--primary-lt, #60a5fa)",
        display: "inline-block",
        animation: "spin 0.75s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}
