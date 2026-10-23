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
              <span style={{ color: "#cbd5e1" }}>{star}★</span>
            </div>
          ))}
        </div>
        <span style={{ color: "var(--text-dim, #64748b)" }}>Proportional share of submitted answers</span>
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
                background: "rgba(10, 22, 40, 0.5)",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(96, 165, 250, 0.1)",
              }}
            >
              {/* Category Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                    {cat.category_name}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
                    ({total} response{total === 1 ? "" : "s"})
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: csatPct >= 75 ? "#34d399" : csatPct >= 50 ? "#38bdf8" : "#fbbf24" }}>
                    {csatPct}% CSAT (4-5★)
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: cat.average_rating >= 4.0 ? "#22c55e" : "#fbbf24",
                      background: "rgba(255, 255, 255, 0.06)",
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
                    background: "rgba(255, 255, 255, 0.05)",
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
                <div style={{ height: "18px", borderRadius: "6px", background: "rgba(255, 255, 255, 0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "var(--text-dim, #64748b)", fontStyle: "italic" }}>
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
            background: "#091424",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "6px",
            padding: "8px 14px",
            fontSize: "12px",
            color: "#ffffff",
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            alignSelf: "flex-start",
          }}
        >
          <span style={{ fontWeight: 700, color: "#38bdf8" }}>{hoveredRating.category}</span>
          <span>{hoveredRating.star} Stars: <strong>{hoveredRating.count}</strong> responses (<strong>{hoveredRating.pct}%</strong>)</span>
        </div>
      )}
    </div>
  );
}
