import { useState } from "react";

/**
 * CategoryBarChart - Professional SVG Column / Bar Chart
 * Displays actual client feedback ratings across standard question bank categories.
 * No synthetic benchmark lines - purely data-driven from stakeholder submissions.
 */
export default function CategoryBarChart({ categories = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!categories || categories.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
        No category ratings found in client responses.
      </div>
    );
  }

  // Dimensions
  const totalWidth = 880;
  const height = 340;
  const padding = { top: 35, right: 30, bottom: 80, left: 50 };
  const chartHeight = height - padding.top - padding.bottom;
  const maxScore = 5.0;

  // Calculate Y coordinate from score (0 - 5.0)
  const getY = (score) => {
    return padding.top + chartHeight - (score / maxScore) * chartHeight;
  };

  const gridTicks = [1.0, 2.0, 3.0, 4.0, 5.0];

  // Helper to split category name into 2 clean lines for readable rendering
  const splitCategoryTitle = (name = "") => {
    if (name.includes(" & ")) {
      const parts = name.split(" & ");
      return [parts[0], `& ${parts.slice(1).join(" & ")}`];
    }
    const words = name.split(" ");
    if (words.length > 2) {
      const mid = Math.ceil(words.length / 2);
      return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    }
    return [name, ""];
  };

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* Legend & Scale Indicator */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px", fontSize: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "14px", height: "14px", borderRadius: "3px", background: "linear-gradient(180deg, var(--secondary-accent), var(--primary))" }} />
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Category Average Rating (Client Submissions)</span>
        </div>
        <span style={{ color: "var(--text-muted)" }}>Rating Scale: 1.0 (Low) — 5.0 (Exceptional)</span>
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${totalWidth} ${height}`}
          style={{ width: "100%", minWidth: "640px", height: "auto", display: "block" }}
        >
          <defs>
            <linearGradient id="barGradHigh" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="barGradGood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="barGradWarn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="barGradLow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
            <filter id="barGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#38bdf8" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background Grid Lines & Y-Axis Labels */}
          {gridTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={totalWidth - padding.right}
                  y2={y}
                  stroke="var(--chart-grid)"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 12}
                  y={y + 4}
                  fill="var(--chart-text)"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="inherit"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Category Columns */}
          {categories.map((cat, i) => {
            const availableWidth = totalWidth - padding.left - padding.right;
            const slotWidth = availableWidth / categories.length;
            const barWidth = Math.min(68, slotWidth * 0.5);
            const x = padding.left + i * slotWidth + (slotWidth - barWidth) / 2;

            const score = cat.average_rating != null ? cat.average_rating : 0;
            const barY = getY(score);
            const barHeight = Math.max(0, padding.top + chartHeight - barY);
            const isHovered = hoveredIndex === i;

            // Gradient selection based on rating
            let gradId = "url(#barGradGood)";
            if (score >= 4.2) gradId = "url(#barGradHigh)";
            else if (score >= 3.8) gradId = "url(#barGradGood)";
            else if (score >= 3.0) gradId = "url(#barGradWarn)";
            else if (score > 0) gradId = "url(#barGradLow)";

            const [titleLine1, titleLine2] = splitCategoryTitle(cat.category_name);

            return (
              <g
                key={cat.section_number}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Hover Background Column Slot */}
                <rect
                  x={padding.left + i * slotWidth}
                  y={padding.top}
                  width={slotWidth}
                  height={chartHeight}
                  fill={isHovered ? "var(--chart-sub-bg)" : "transparent"}
                  rx="8"
                  style={{ transition: "fill 0.15s ease" }}
                />

                {/* Score Tag Above Bar */}
                {score > 0 ? (
                  <g>
                    <rect
                      x={x + barWidth / 2 - 30}
                      y={barY - 26}
                      width="60"
                      height="20"
                      rx="5"
                      fill={isHovered ? "var(--primary)" : "var(--chart-tooltip-bg)"}
                      stroke={isHovered ? "var(--primary)" : "var(--chart-tooltip-border)"}
                      strokeWidth="1"
                    />
                    <text
                      x={x + barWidth / 2}
                      y={barY - 12}
                      textAnchor="middle"
                      fill={isHovered ? "#ffffff" : "var(--chart-text-strong)"}
                      fontSize="12"
                      fontWeight="700"
                      fontFamily="inherit"
                    >
                      ★ {score.toFixed(2)}
                    </text>
                  </g>
                ) : (
                  <text
                    x={x + barWidth / 2}
                    y={getY(0.2)}
                    textAnchor="middle"
                    fill="var(--chart-text)"
                    fontSize="11"
                    fontStyle="italic"
                    fontFamily="inherit"
                  >
                    No ratings
                  </text>
                )}

                {/* Main Bar */}
                {score > 0 && (
                  <rect
                    x={x}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    rx="6"
                    fill={gradId}
                    filter={isHovered ? "url(#barGlow)" : "none"}
                    stroke={isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.25)"}
                    strokeWidth={isHovered ? "2" : "0.5"}
                    style={{ transition: "all 0.2s ease" }}
                  />
                )}

                {/* Category Label (Wrapped into 2 clean lines) */}
                <text
                  x={x + barWidth / 2}
                  y={padding.top + chartHeight + 18}
                  textAnchor="middle"
                  fill={isHovered ? "var(--primary)" : "var(--chart-text-strong)"}
                  fontSize="12"
                  fontWeight={isHovered ? "700" : "600"}
                  fontFamily="inherit"
                >
                  <tspan x={x + barWidth / 2} dy="0">{titleLine1}</tspan>
                  {titleLine2 && (
                    <tspan x={x + barWidth / 2} dy="16" fill={isHovered ? "var(--primary)" : "var(--chart-text)"}>{titleLine2}</tspan>
                  )}
                </text>

                {/* Subtitle / Response Count */}
                <text
                  x={x + barWidth / 2}
                  y={padding.top + chartHeight + (titleLine2 ? 48 : 34)}
                  textAnchor="middle"
                  fill="var(--chart-text)"
                  fontSize="11"
                  fontFamily="inherit"
                >
                  {cat.total_ratings} response{cat.total_ratings === 1 ? "" : "s"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover Distribution Card */}
      {hoveredIndex !== null && categories[hoveredIndex] && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "10px 16px",
            fontSize: "12px",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-card)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: "13px" }}>
            {categories[hoveredIndex].category_name}
          </div>
          <div style={{ display: "flex", gap: "12px", color: "var(--text-secondary)" }}>
            <span>Average Rating: <strong>★ {categories[hoveredIndex].average_rating?.toFixed(2) ?? "—"} / 5.0</strong></span>
            <span>Total Responses: <strong>{categories[hoveredIndex].total_ratings}</strong></span>
          </div>
          {categories[hoveredIndex].rating_distribution && (
            <div style={{ display: "flex", gap: "8px", marginTop: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
              <span>5★: {categories[hoveredIndex].rating_distribution["5"] || 0}</span>
              <span>4★: {categories[hoveredIndex].rating_distribution["4"] || 0}</span>
              <span>3★: {categories[hoveredIndex].rating_distribution["3"] || 0}</span>
              <span>2★: {categories[hoveredIndex].rating_distribution["2"] || 0}</span>
              <span>1★: {categories[hoveredIndex].rating_distribution["1"] || 0}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
