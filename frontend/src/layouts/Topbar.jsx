import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

export default function Topbar({ onToggleSidebar }) {
  const location = useLocation();
  const { user } = useAuth();

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

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return "U";
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

      {/* Right Top Corner: Theme Toggle (Bright & Dark) & User Role info */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {user && (
          <div
            className="topbar-user-badge"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 10px 4px 5px",
              borderRadius: "9999px",
              background: "var(--bg-hover, rgba(14, 30, 50, 0.6))",
              border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            }}
            title={`Logged in as ${user.full_name || user.email} (${user.role})`}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent, #06b6d4), var(--primary, #2563eb))",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {getInitials(user.full_name, user.email)}
            </div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-main, #e2e8f0)",
              }}
            >
              {user.role}
            </span>
          </div>
        )}

        {/* Theme Toggle (Bright & Dark) */}
        <ThemeToggle />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-hamburger-btn {
            display: block !important;
          }
        }
        @media (max-width: 600px) {
          .topbar-user-badge {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
