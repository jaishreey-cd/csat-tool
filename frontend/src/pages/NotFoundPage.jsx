import { Link } from "react-router-dom";
import Button from "../components/Button";

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-deep, #0a1628)",
        color: "var(--text-main, #e2e8f0)",
        padding: "20px",
        textAlign: "center",
        gap: "16px",
      }}
    >
      <div style={{ fontSize: "56px" }}>🔍</div>
      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
        404 - Page Not Found
      </h1>
      <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", maxWidth: "420px", margin: 0 }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <div style={{ marginTop: "12px" }}>
        <Link to="/dashboard">
          <Button variant="primary" size="md">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
