import { NavLink } from "react-router-dom";
import Logo from "../components/Logo";

export default function Sidebar({ isOpen = true, onClose = null }) {
  const navItems = [
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
      to: "/surveys",
      label: "Surveys",
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

        {/* Navigation Items */}
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
                borderRadius: "var(--radius-md, 9px)",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 500,
                color: isActive
                  ? "var(--text-white, #ffffff)"
                  : "var(--text-muted, #94a3b8)",
                background: isActive
                  ? "var(--bg-active, rgba(37, 99, 235, 0.15))"
                  : "transparent",
                border: isActive
                  ? "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))"
                  : "1px solid transparent",
                textDecoration: "none",
                transition: "all 0.15s ease",
              })}
            >
              <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
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
