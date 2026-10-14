import { useParams } from "react-router-dom";
import Logo from "../components/Logo";

export default function PublicSurveyPage() {
  const { token } = useParams();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-deep, #0a1628)",
        color: "var(--text-white, #ffffff)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "36px 32px",
          textAlign: "center",
          boxShadow: "var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.45))",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <Logo size="lg" />
        </div>

        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 10px 0" }}>
          Client Survey
        </h1>

        <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", lineHeight: 1.6, margin: "0 0 20px 0" }}>
          Thank you for providing your feedback. The client survey response interface is currently being prepared.
        </p>

        <div
          style={{
            padding: "10px 14px",
            background: "rgba(37, 99, 235, 0.12)",
            border: "1px solid rgba(96, 165, 250, 0.25)",
            borderRadius: "var(--radius-md, 9px)",
            fontSize: "12px",
            color: "var(--primary-lt, #60a5fa)",
            wordBreak: "break-all",
          }}
        >
          Survey Token: <code>{token}</code>
        </div>
      </div>
    </div>
  );
}
