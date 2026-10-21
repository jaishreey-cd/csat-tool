import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Topbar({ onToggleSidebar }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const titleMap = {
    "/dashboard": "CSAT Dashboard",
    "/surveys/new": "Create Survey",
    "/surveys": "CSAT Dashboard",
    "/data-import": "Data Import & Synchronization",
    "/clients-projects": "Clients & Projects Management",
    "/categories": "Feedback Categories",
    "/question-bank": "Question Bank",
    "/permissions": "User Permissions & PMO Access",
    "/audit": "System Audit Log",
    "/results": "Survey Results & Analytics",
  };

  let currentTitle = titleMap[location.pathname];
  if (!currentTitle) {
    if (location.pathname.startsWith("/projects/")) {
      currentTitle = "Project Analytics Dashboard";
    } else {
      currentTitle = "CSAT Portal";
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

      {/* Right: Header Role Badge and User Pill */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Prominent Header Role Badge */}
        <div
          id="headerRoleBadge"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            background: isAdmin
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.25))"
              : "linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(6, 182, 212, 0.25))",
            color: isAdmin ? "#34d399" : "#60a5fa",
            border: `1px solid ${isAdmin ? "rgba(16, 185, 129, 0.4)" : "rgba(96, 165, 250, 0.4)"}`,
            boxShadow: isAdmin
              ? "0 0 12px rgba(16, 185, 129, 0.15)"
              : "0 0 12px rgba(37, 99, 235, 0.15)",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: isAdmin ? "#10b981" : "#3b82f6",
              boxShadow: `0 0 6px ${isAdmin ? "#10b981" : "#3b82f6"}`,
            }}
          />
          <span>{isAdmin ? "PMO ADMIN" : "PMO USER"}</span>
        </div>

        {/* User identification */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 10px",
            borderRadius: "8px",
            background: "rgba(15, 23, 42, 0.5)",
            border: "1px solid rgba(148, 163, 184, 0.12)",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-main, #cbd5e1)",
            }}
          >
            {user?.email || "user"}
          </span>
        </div>
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
