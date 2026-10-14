import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const titleMap = {
    "/dashboard": "Dashboard",
    "/surveys/new": "Create Survey",
    "/surveys": "Surveys",
    "/approvals": "Approvals",
  };

  // Determine current page title
  let currentTitle = titleMap[location.pathname];
  if (!currentTitle) {
    if (location.pathname.startsWith("/projects/")) {
      currentTitle = "Project Analytics";
    } else {
      currentTitle = "CSAT";
    }
  }

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return "US";
  };

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

      {/* Right: User Profile & Logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* User Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "var(--bg-card, rgba(14, 30, 50, 0.8))",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
            padding: "4px 12px 4px 6px",
            borderRadius: "var(--radius-full, 9999px)",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent, #06b6d4), var(--primary, #2563eb))",
              color: "var(--text-white, #ffffff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {getInitials(user?.full_name, user?.email)}
          </div>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main, #e2e8f0)" }}>
            {user?.full_name || user?.email || "User"}
          </span>
        </div>

        {/* Logout Button */}
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign Out
        </Button>
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
