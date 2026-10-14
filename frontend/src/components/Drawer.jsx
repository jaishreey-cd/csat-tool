import { useEffect } from "react";

export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = "right", // 'right' | 'left'
  width = "400px",
  className = "",
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isRight = position === "right";

  return (
    <div
      className={`drawer-root ${className}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: isRight ? "flex-end" : "flex-start",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(4px)",
          animation: "drawerFadeIn 0.2s ease-out",
        }}
      />

      {/* Drawer Panel */}
      <div
        style={{
          position: "relative",
          zIndex: 1001,
          width: "100%",
          maxWidth: width,
          height: "100%",
          background: "var(--bg-surface, #0d1b2a)",
          borderLeft: isRight ? "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))" : "none",
          borderRight: !isRight ? "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))" : "none",
          boxShadow: isRight ? "-8px 0 32px rgba(0, 0, 0, 0.5)" : "8px 0 32px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          animation: isRight ? "drawerSlideLeft 0.25s ease-out" : "drawerSlideRight 0.25s ease-out",
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            id="drawer-title"
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "var(--text-white, #ffffff)",
              margin: 0,
              letterSpacing: "-0.2px",
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted, #94a3b8)",
              cursor: "pointer",
              fontSize: "20px",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-sm, 6px)",
              transition: "color 0.15s ease",
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes drawerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes drawerSlideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes drawerSlideRight {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
