import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to Bright Mode" : "Switch to Dark Mode"}
      title={isDark ? "Switch to Bright Mode" : "Switch to Dark Mode"}
      className={`theme-toggle-btn ${className}`}
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: isDark ? "rgba(15, 23, 42, 0.75)" : "#ffffff",
        border: `1.5px solid ${isDark ? "rgba(96, 165, 250, 0.25)" : "var(--border-strong, #cbd5e1)"}`,
        boxShadow: isDark
          ? "0 2px 8px rgba(0, 0, 0, 0.4)"
          : "0 2px 8px rgba(0, 0, 0, 0.08)",
        cursor: "pointer",
        padding: 0,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        outline: "none",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.08)";
        if (isDark) {
          e.currentTarget.style.borderColor = "rgba(251, 191, 36, 0.6)";
          e.currentTarget.style.boxShadow = "0 0 12px rgba(251, 191, 36, 0.35)";
        } else {
          e.currentTarget.style.borderColor = "var(--primary, #1d4ed8)";
          e.currentTarget.style.boxShadow = "0 0 12px rgba(29, 78, 216, 0.25)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.borderColor = isDark ? "rgba(96, 165, 250, 0.25)" : "var(--border-strong, #cbd5e1)";
        e.currentTarget.style.boxShadow = isDark
          ? "0 2px 8px rgba(0, 0, 0, 0.4)"
          : "0 2px 8px rgba(0, 0, 0, 0.08)";
      }}
    >
      {isDark ? (
        /* Sun Icon for Dark Mode (click to switch to Bright) */
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: "transform 0.3s ease", flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="5" fill="rgba(245, 158, 11, 0.25)" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon Icon for Bright Mode (click to switch to Dark) */
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="rgba(30, 41, 59, 0.15)"
          stroke="#0f172a"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: "transform 0.3s ease", flexShrink: 0 }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
