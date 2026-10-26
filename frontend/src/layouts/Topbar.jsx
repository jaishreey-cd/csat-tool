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
      className="app-topbar"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        left: "var(--sidebar-w, 260px)",
        height: "var(--topbar-h, 68px)",
        background: "var(--bg-header, #172235)",
        borderBottom: "1px solid var(--border, #33465f)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        zIndex: 40,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        transition: "left 0.25s ease, background 0.25s ease, border-color 0.25s ease",
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
            color: "var(--text-primary, #f1f5f9)",
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
            fontSize: "17px",
            fontWeight: 700,
            color: "var(--text-primary, #ffffff)",
            margin: 0,
            letterSpacing: "-0.3px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent, #38bdf8), var(--primary, #60a5fa))",
              boxShadow: "0 0 8px rgba(37, 99, 235, 0.6)",
              flexShrink: 0,
            }}
          />
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
              background: "var(--bg-elevated, #22334A)",
              border: "1px solid var(--border, #33465f)",
            }}
            title={`Logged in as ${user.full_name || user.email} (${user.role})`}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent, #38bdf8), var(--primary, #60a5fa))",
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
                color: "var(--text-secondary, #b7c4d8)",
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
          .app-topbar {
            left: 0 !important;
          }
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
