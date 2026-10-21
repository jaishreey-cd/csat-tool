import { useLocation } from "react-router-dom";

export default function Topbar({ onToggleSidebar }) {
  const location = useLocation();

  const titleMap = {
    "/dashboard": "CSAT Dashboard",
    "/surveys/new": "Create Survey",
    "/surveys": "CSAT Dashboard",
    "/question-bank": "Question Bank",
    "/questions": "Question Bank",
    "/permissions": "User Permissions",
    "/results": "Survey Results",
  };

  let currentTitle = titleMap[location.pathname];
  if (!currentTitle) {
    if (location.pathname.startsWith("/projects/")) {
      currentTitle = "Project Analytics Dashboard";
    } else {
      currentTitle = "CSAT";
    }
  }

  return (
    <header
      style={{
        height: "var(--topbar-h, 68px)",
        background: "var(--bg-surface, #0d1b2a)",
        borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 30,
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Left: Mobile hamburger & Page Title */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          className="mobile-hamburger-btn"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-main, #e2e8f0)",
            fontSize: "20px",
            cursor: "pointer",
            display: "none",
            padding: "4px",
          }}
        >
          ☰
        </button>

        <h1
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--text-white, #ffffff)",
            margin: 0,
            letterSpacing: "-0.2px",
          }}
        >
          {currentTitle}
        </h1>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-hamburger-btn {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
}
