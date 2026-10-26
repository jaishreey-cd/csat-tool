export default function Logo({ size = "md", showText = true, className = "" }) {
  const sizes = {
    sm: { imgSize: "22px", fontSize: "16px", letterSpacing: "1px", dotSize: "5px", gap: "8px" },
    md: { imgSize: "28px", fontSize: "20px", letterSpacing: "1.2px", dotSize: "7px", gap: "10px" },
    lg: { imgSize: "52px", fontSize: "28px", letterSpacing: "2px", dotSize: "9px", gap: "14px" },
  };

  const current = sizes[size] || sizes.md;

  return (
    <div
      className={`csat-logo ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: current.gap,
        userSelect: "none",
      }}
      aria-label="CSAT"
    >
      {/* Cloud Destinations (CD) Logo */}
      <img
        src="/image.png"
        alt="Cloud Destinations"
        style={{
          width: current.imgSize,
          height: current.imgSize,
          objectFit: "contain",
          filter: "drop-shadow(0 2px 8px rgba(37, 99, 235, 0.3))",
          flexShrink: 0,
        }}
      />

      {showText && (
        <div style={{ display: "inline-flex", alignItems: "center" }}>
          <span
            style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontWeight: 800,
              fontSize: current.fontSize,
              letterSpacing: current.letterSpacing,
              color: "var(--text-white, #ffffff)",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            CSAT
          </span>
        </div>
      )}
    </div>
  );
}
