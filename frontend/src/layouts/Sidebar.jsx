import { NavLink } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({ isOpen = true, onClose = null }) {
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "Admin";

  const navItems = isAdmin
    ? [
        {
          to: "/surveys/new",
          label: "Create Survey",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          ),
        },
        {
          to: "/dashboard",
          label: "Dashboard",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9"></rect>
              <rect x="14" y="3" width="7" height="5"></rect>
              <rect x="14" y="12" width="7" height="9"></rect>
              <rect x="3" y="16" width="7" height="5"></rect>
            </svg>
          ),
        },
        {
          to: "/question-bank",
          label: "Question Bank",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              <circle cx="12" cy="11" r="0.75" fill="currentColor"></circle>
              <path d="M10 8.5a2 2 0 1 1 3.5 1.4c-.8.8-1.5 1.3-1.5 2.6"></path>
            </svg>
          ),
        },
        {
          to: "/permissions",
          label: "Permissions",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          ),
        },
      ]
    : [
        {
          to: "/surveys/new",
          label: "Create Survey",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          ),
        },
        {
          to: "/dashboard",
          label: "Dashboard",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9"></rect>
              <rect x="14" y="3" width="7" height="5"></rect>
              <rect x="14" y="12" width="7" height="9"></rect>
              <rect x="3" y="16" width="7" height="5"></rect>
            </svg>
          ),
        },
        {
          to: "/results",
          label: "Results",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          ),
        },
      ];

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
    <>
      {/* Mobile backdrop */}
      <div
        className="mobile-backdrop"
        onClick={onClose}
        style={{
          display: isOpen ? "block" : "none",
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          zIndex: 40,
        }}
      />

      <aside
        className={`app-sidebar ${isOpen ? "open" : ""}`}
        style={{
          width: "var(--sidebar-w, 260px)",
          height: "100vh",
          background: "var(--bg-surface, #0d1b2a)",
          borderRight: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 50,
          transition: "transform 0.25s ease",
        }}
      >
        {/* Brand Header: CSAT only */}
        <div
          style={{
            height: "var(--topbar-h, 68px)",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
          }}
        >
          <Logo size="md" />

          {/* Close button for mobile drawer */}
          <button
            type="button"
            className="mobile-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
            style={{
              display: "none",
              background: "transparent",
              border: "none",
              color: "var(--text-muted, #94a3b8)",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            &times;
          </button>
        </div>

        {/* Navigation Items (Create Survey, Dashboard, Drafts, Permissions) */}
        <nav
          style={{
            flex: 1,
            padding: "20px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            overflowY: "auto",
          }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => {
                if (window.innerWidth <= 768 && onClose) onClose();
              }}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "var(--radius-md, 10px)",
                fontSize: "14px",
                fontWeight: isActive ? 700 : 500,
                color: isActive
                  ? "var(--text-white, #ffffff)"
                  : "var(--text-muted, #94a3b8)",
                background: isActive
                  ? "linear-gradient(90deg, rgba(37, 99, 235, 0.22) 0%, rgba(37, 99, 235, 0.06) 100%)"
                  : "transparent",
                border: isActive
                  ? "1px solid var(--border-strong, rgba(96, 165, 250, 0.35))"
                  : "1px solid transparent",
                borderLeft: isActive
                  ? "3px solid var(--primary-lt, #60a5fa)"
                  : "3px solid transparent",
                boxShadow: isActive
                  ? "0 2px 12px rgba(37, 99, 235, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
                  : "none",
                textDecoration: "none",
                transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: isActive ? "var(--primary-lt, #60a5fa)" : "currentColor",
                      transition: "color 0.15s ease",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Section: Account Info & Sign Out */}
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
            background: "linear-gradient(180deg, rgba(13, 27, 42, 0.6) 0%, rgba(10, 20, 36, 0.95) 100%)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* User Profile Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "rgba(14, 28, 48, 0.6)",
              border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent, #06b6d4), var(--primary, #2563eb))",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
              }}
            >
              {getInitials(user?.full_name, user?.email)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-white, #ffffff)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.full_name || "Authorized User"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "10px",
                    fontWeight: 700,
                    background: user?.role === "Admin" ? "rgba(34, 197, 94, 0.15)" : "rgba(37, 99, 235, 0.15)",
                    color: user?.role === "Admin" ? "var(--success, #22c55e)" : "var(--primary-lt, #60a5fa)",
                    padding: "1px 6px",
                    borderRadius: "9999px",
                    border: `1px solid ${user?.role === "Admin" ? "rgba(34, 197, 94, 0.3)" : "rgba(37, 99, 235, 0.3)"}`,
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                  }}
                >
                  <span
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      backgroundColor: "currentColor",
                      boxShadow: "0 0 4px currentColor",
                    }}
                  />
                  {user?.role || "Admin"}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-dim, #64748b)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user?.email}
                </span>
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={logout}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.22)",
              background: "rgba(239, 68, 68, 0.06)",
              color: "var(--danger, #ef4444)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.16)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.45)";
              e.currentTarget.style.boxShadow = "0 2px 10px rgba(239, 68, 68, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.06)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.22)";
              e.currentTarget.style.boxShadow = "none";
            }}
            title="Sign out of CSAT"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .app-sidebar {
            transform: translateX(-100%);
          }
          .app-sidebar.open {
            transform: translateX(0);
          }
          .mobile-close-btn {
            display: block !important;
          }
          .mobile-backdrop {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-backdrop {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
