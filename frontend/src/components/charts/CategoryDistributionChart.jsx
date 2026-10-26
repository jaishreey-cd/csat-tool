import { useState } from "react";

/**
 * CategoryDistributionChart - Stacked Rating Distribution & Sentiment Heatmap
 * Visualizes 1-star to 5-star distribution across all feedback categories.
 */
export default function CategoryDistributionChart({ categories = [] }) {
  const [hoveredRating, setHoveredRating] = useState(null);

  if (!categories || categories.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
        No category distribution data available.
      </div>
    );
  }

  const ratingColors = {
    "5": { bg: "#10b981", label: "5 Stars (Exceptional)" },
    "4": { bg: "#38bdf8", label: "4 Stars (Good)" },
    "3": { bg: "#fbbf24", label: "3 Stars (Average)" },
    "2": { bg: "#f97316", label: "2 Stars (Needs Improvement)" },
    "1": { bg: "#ef4444", label: "1 Star (Unsatisfactory)" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%" }}>
      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", fontSize: "12px" }}>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          {["5", "4", "3", "2", "1"].map((star) => (
            <div key={star} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: ratingColors[star].bg }} />
              <span style={{ color: "var(--text-secondary)" }}>{star}★</span>
            </div>
          ))}
        </div>
        <span style={{ color: "var(--text-muted)" }}>Proportional share of submitted answers</span>
      </div>

      {/* Category Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {categories.map((cat) => {
          const total = cat.total_ratings || 0;
          const dist = cat.rating_distribution || {};

          // Calculate positive CSAT for this category (ratings >= 4)
          const highCount = (dist["4"] || 0) + (dist["5"] || 0);
          const csatPct = total > 0 ? Math.round((highCount / total) * 100) : 0;

          return (
            <div
              key={cat.section_number}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                background: "var(--bg-elevated)",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
              }}
            >
              {/* Category Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {cat.category_name}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    ({total} response{total === 1 ? "" : "s"})
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: csatPct >= 75 ? "var(--success)" : csatPct >= 50 ? "var(--primary)" : "var(--warning)" }}>
                    {csatPct}% CSAT (4-5★)
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: cat.average_rating >= 4.0 ? "var(--success)" : "var(--warning)",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    ★ {cat.average_rating ? cat.average_rating.toFixed(2) : "—"}
                  </span>
                </div>
              </div>

              {/* Stacked Bar Track */}
              {total > 0 ? (
                <div
                  style={{
                    height: "18px",
                    borderRadius: "6px",
                    overflow: "hidden",
                    display: "flex",
                    background: "var(--bg-track)",
                  }}
                >
                  {["5", "4", "3", "2", "1"].map((star) => {
                    const count = dist[star] || 0;
                    if (count === 0) return null;
                    const pct = (count / total) * 100;
                    return (
                      <div
                        key={star}
                        onMouseEnter={() => setHoveredRating({ category: cat.category_name, star, count, pct: pct.toFixed(1) })}
                        onMouseLeave={() => setHoveredRating(null)}
                        style={{
                          width: `${pct}%`,
                          background: ratingColors[star].bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#0a1628",
                          cursor: "pointer",
                          transition: "opacity 0.15s ease",
                        }}
                        title={`${star}★: ${count} (${pct.toFixed(1)}%)`}
                      >
                        {pct > 12 && `${star}★`}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ height: "18px", borderRadius: "6px", background: "var(--bg-track)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Awaiting responses
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hover Information */}
      {hoveredRating && (
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "8px 14px",
            fontSize: "12px",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-card)",
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            alignSelf: "flex-start",
          }}
        >
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>{hoveredRating.category}</span>
          <span>{hoveredRating.star} Stars: <strong>{hoveredRating.count}</strong> responses (<strong>{hoveredRating.pct}%</strong>)</span>
        </div>
      )}
    </div>
  );
}
