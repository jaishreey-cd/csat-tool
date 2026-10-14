import { Link, useLocation, useParams } from "react-router-dom";
import Button from "../components/Button";
import Badge from "../components/Badge";

export default function ComingSoonPage({ title: customTitle }) {
  const location = useLocation();
  const params = useParams();

  const titleMap = {
    "/surveys/new": "Create Survey",
    "/surveys": "Surveys",
    "/approvals": "Approvals",
    "/dashboard": "Main Analytics Dashboard",
  };

  let title = customTitle || titleMap[location.pathname];
  if (!title) {
    if (params.projectId) {
      title = `Project Analytics (#${params.projectId})`;
    } else {
      title = "Coming Soon";
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 20px",
        textAlign: "center",
        gap: "16px",
      }}
    >
      <div style={{ fontSize: "44px" }}>📋</div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
          {title}
        </h2>
        <Badge variant="count">Planned</Badge>
      </div>
      <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", maxWidth: "480px", lineHeight: 1.6, margin: 0 }}>
        This screen is part of the CSAT workflow. Future tasks will implement full interactive functionality according to <code>docs/FRONTEND_PLAN.md</code>.
      </p>
      <div style={{ marginTop: "12px" }}>
        <Link to="/dashboard">
          <Button variant="secondary" size="md">
            ← Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
