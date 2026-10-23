/**
 * CategoryRadialGauges - Circular Ring Progress Gauges
 * Displays circular progress meter for each feedback category based purely on client submissions.
 * No synthetic benchmark lines.
 */
export default function CategoryRadialGauges({ categories = [] }) {
  if (!categories || categories.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
        No category ratings found in client responses.
      </div>
    );
  }

  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "18px",
        width: "100%",
      }}
    >
      {categories.map((cat) => {
        const score = cat.average_rating != null ? cat.average_rating : 0;
        const pct = Math.min(100, Math.max(0, (score / 5.0) * 100));
        const strokeDashoffset = circumference - (pct / 100) * circumference;
        const color = score >= 4.0 ? "#22c55e" : score >= 3.0 ? "#fbbf24" : "#ef4444";

        return (
          <div
            key={cat.section_number}
            style={{
              background: "rgba(10, 22, 40, 0.55)",
              border: "1px solid rgba(96, 165, 250, 0.15)",
              borderRadius: "12px",
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              transition: "transform 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "rgba(96, 165, 250, 0.15)";
            }}
          >
            {/* Circular Gauge Ring */}
            <div style={{ position: "relative", width: "100px", height: "100px" }}>
              <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                {/* Track background */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Progress bar from client responses */}
                {score > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke={color}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                )}
              </svg>

              {/* Inside center text */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff" }}>
                  {score > 0 ? `★ ${score.toFixed(1)}` : "—"}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", fontWeight: 600 }}>
                  {score > 0 ? `${Math.round(pct)}%` : "Pending"}
                </span>
              </div>
            </div>

            {/* Category Title */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-white, #ffffff)", lineHeight: 1.35, minHeight: "36px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {cat.category_name}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", marginTop: "4px" }}>
                {cat.total_ratings} client response{cat.total_ratings === 1 ? "" : "s"}
              </div>
            </div>

            {/* Rating Score Badge */}
            {score > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  background: score >= 4.0 ? "rgba(34, 197, 94, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  color: score >= 4.0 ? "#34d399" : "#fbbf24",
                  border: `1px solid ${score >= 4.0 ? "rgba(34, 197, 94, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                }}
              >
                ★ {score.toFixed(2)} / 5.0
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
