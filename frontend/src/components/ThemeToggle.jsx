import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ className = "", compact = false }) {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();

  return (
    <div
      className={`theme-toggle-container ${className}`}
      role="group"
      aria-label="Theme mode selector"
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: isDark ? "rgba(10, 22, 40, 0.85)" : "#e2e8f0",
        border: `1px solid ${isDark ? "rgba(96, 165, 250, 0.2)" : "rgba(203, 213, 225, 0.8)"}`,
        borderRadius: "9999px",
        padding: "3px",
        gap: "3px",
        boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
        transition: "all 0.2s ease",
      }}
    >
      {/* Bright / Light Mode Button */}
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Switch to Bright (Light) Mode"
        aria-pressed={!isDark}
        title="Switch to Bright (Light) Mode"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: compact ? "5px 8px" : "5px 11px",
          borderRadius: "9999px",
          border: "none",
          background: !isDark ? "#ffffff" : "transparent",
          color: !isDark ? "#b45309" : "var(--text-muted, #94a3b8)",
          boxShadow: !isDark ? "0 2px 6px rgba(0, 0, 0, 0.12)" : "none",
          fontWeight: !isDark ? 700 : 500,
          fontSize: "12px",
          cursor: "pointer",
          outline: "none",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke={!isDark ? "#f59e0b" : "currentColor"}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: !isDark ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
            flexShrink: 0,
          }}
        >
          <circle cx="12" cy="12" r="5" fill={!isDark ? "rgba(245, 158, 11, 0.2)" : "none"}></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <span className="theme-toggle-text">Bright</span>
      </button>

      {/* Dark Mode Button */}
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Switch to Dark Mode"
        aria-pressed={isDark}
        title="Switch to Dark Mode"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: compact ? "5px 8px" : "5px 11px",
          borderRadius: "9999px",
          border: "none",
          background: isDark ? "rgba(37, 99, 235, 0.3)" : "transparent",
          color: isDark ? "#93c5fd" : "var(--text-muted, #94a3b8)",
          boxShadow: isDark ? "0 0 10px rgba(37, 99, 235, 0.35)" : "none",
          fontWeight: isDark ? 700 : 500,
          fontSize: "12px",
          cursor: "pointer",
          outline: "none",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={isDark ? "rgba(96, 165, 250, 0.2)" : "none"}
          stroke={isDark ? "#60a5fa" : "currentColor"}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isDark ? "rotate(-15deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
            flexShrink: 0,
          }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <span className="theme-toggle-text">Dark</span>
      </button>

      <style>{`
        @media (max-width: 500px) {
          .theme-toggle-text {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
