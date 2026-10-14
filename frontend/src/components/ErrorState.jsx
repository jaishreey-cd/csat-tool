import Button from "./Button";

export default function ErrorState({
  title = "Failed to load data",
  message = "An error occurred while fetching information from the server.",
  onRetry = null,
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
      }}
    >
      <div style={{ fontSize: "36px", color: "var(--danger, #ef4444)" }}>⚠️</div>
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--text-white, #ffffff)",
          margin: 0,
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: 0, maxWidth: "450px" }}>
        {message}
      </p>
      {onRetry && (
        <div style={{ marginTop: "12px" }}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
