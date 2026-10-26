import { useState } from "react";

/**
 * CategoryRadarChart - Professional 5-Axis Spider / Radar Chart
 * Displays actual client feedback ratings across standard question bank categories.
 * No synthetic benchmark lines - purely data-driven from stakeholder submissions.
 */
export default function CategoryRadarChart({ categories = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!categories || categories.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
        No category data available for radar mapping.
      </div>
    );
  }

  // Dimensions with ample margin for full category labels
  const width = 640;
  const height = 480;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 135; // max radius for score 5.0
  const maxScore = 5.0;
  const totalAxes = categories.length;

  // Helper to calculate (x, y) given angle and score (0 to 5)
  const getCoordinates = (index, score) => {
    // Start at top (-PI/2) and rotate clockwise
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = (score / maxScore) * radius;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    return { x, y, angle };
  };

  // Helper to split category name into 2 clean lines
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

  // Grid level polygons (1.0, 2.0, 3.0, 4.0, 5.0)
  const gridLevels = [1.0, 2.0, 3.0, 4.0, 5.0];

  // Polygon points for actual data
  const dataPoints = categories.map((cat, i) => {
    const score = cat.average_rating != null ? cat.average_rating : 0;
    return getCoordinates(i, score);
  });
  const dataPolygonString = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", position: "relative" }}>
      {/* Legend & Summary */}
      <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "8px", flexWrap: "wrap", fontSize: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--primary-badge-bg)", border: "2px solid var(--primary)" }} />
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Actual CSAT Rating from Client Responses</span>
        </div>
        <span style={{ color: "var(--text-muted)" }}>Scale: 1.0 (Low) — 5.0 (Exceptional)</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", maxWidth: "640px", height: "auto", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="radarAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.15" />
          </linearGradient>
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Circular / Web Grid Levels */}
        {gridLevels.map((lvl) => {
          const points = categories.map((_, i) => getCoordinates(i, lvl));
          const polyStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          return (
            <g key={lvl}>
              <polygon
                points={polyStr}
                fill={lvl === 5.0 ? "var(--chart-sub-bg)" : "none"}
                stroke="var(--chart-grid)"
                strokeWidth={lvl === 5.0 ? "1.5" : "1"}
              />
              {/* Level indicator on the vertical top axis */}
              <text
                x={centerX + 6}
                y={centerY - (lvl / maxScore) * radius + 4}
                fill="var(--chart-text)"
                fontSize="10"
                fontFamily="inherit"
                fontWeight="500"
              >
                {lvl.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Axes rays radiating from center */}
        {categories.map((_, i) => {
          const outer = getCoordinates(i, maxScore);
          return (
            <line
              key={i}
              x1={centerX}
              y1={centerY}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--chart-grid)"
              strokeWidth="1"
            />
          );
        })}

        {/* Actual Data Filled Area */}
        <polygon
          points={dataPolygonString}
          fill="url(#radarAreaGradient)"
          stroke="#38bdf8"
          strokeWidth="2.5"
          filter="url(#radarGlow)"
        />

        {/* Data points / Vertex dots */}
        {dataPoints.map((pt, i) => {
          const cat = categories[i];
          const isHovered = hoveredIndex === i;
          const score = cat.average_rating != null ? cat.average_rating : 0;
          return (
            <g key={i}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 7 : 5}
                fill={score >= 4.0 ? "#22c55e" : score >= 3.0 ? "#fbbf24" : "#ef4444"}
                stroke="#ffffff"
                strokeWidth={isHovered ? "2.5" : "1.5"}
                style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          );
        })}

        {/* Outer Labels for Question Bank Categories */}
        {categories.map((cat, i) => {
          // Push labels out slightly beyond radius
          const angle = (Math.PI * 2 / totalAxes) * i - Math.PI / 2;
          const labelDist = radius + 36;
          const lx = centerX + labelDist * Math.cos(angle);
          const ly = centerY + labelDist * Math.sin(angle);

          // Anchor based on quadrant
          let textAnchor = "middle";
          if (Math.cos(angle) > 0.3) textAnchor = "start";
          else if (Math.cos(angle) < -0.3) textAnchor = "end";

          const isHovered = hoveredIndex === i;
          const score = cat.average_rating != null ? cat.average_rating.toFixed(2) : "—";
          const [line1, line2] = splitCategoryTitle(cat.category_name);

          return (
            <g
              key={cat.section_number}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: "pointer" }}
            >
              <text
                x={lx}
                y={ly - (line2 ? 10 : 4)}
                textAnchor={textAnchor}
                fill={isHovered ? "var(--primary)" : "var(--chart-text-strong)"}
                fontSize="11"
                fontWeight={isHovered ? "700" : "600"}
                fontFamily="inherit"
              >
                <tspan x={lx} dy="0">{line1}</tspan>
                {line2 && <tspan x={lx} dy="14" fill={isHovered ? "var(--primary)" : "var(--chart-text)"}>{line2}</tspan>}
              </text>
              <text
                x={lx}
                y={ly + (line2 ? 18 : 12)}
                textAnchor={textAnchor}
                fill={cat.average_rating >= 4.0 ? "#22c55e" : cat.average_rating >= 3.0 ? "#fbbf24" : "#ef4444"}
                fontSize="11"
                fontWeight="700"
                fontFamily="inherit"
              >
                ★ {score}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover Card for selected vertex */}
      {hoveredIndex !== null && categories[hoveredIndex] && (
        <div
          style={{
            position: "absolute",
            bottom: "0px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "12px",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>{categories[hoveredIndex].category_name}</span>
          <span>Average Rating: <strong>★ {categories[hoveredIndex].average_rating?.toFixed(2) ?? "—"} / 5.0</strong></span>
          <span>Responses: <strong>{categories[hoveredIndex].total_ratings}</strong></span>
        </div>
      )}
    </div>
  );
}
