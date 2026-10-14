export default function EmptyState({
  title = "No data found",
  description = "There are no records matching your criteria.",
  icon = "📂",
  action = null,
}) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        color: "var(--text-muted, #94a3b8)",
      }}
    >
      <div style={{ fontSize: "36px", opacity: 0.8 }}>{icon}</div>
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--text-main, #e2e8f0)",
          margin: 0,
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: "14px", color: "var(--text-dim, #64748b)", margin: 0, maxWidth: "400px" }}>
        {description}
      </p>
      {action && <div style={{ marginTop: "8px" }}>{action}</div>}
    </div>
  );
}
