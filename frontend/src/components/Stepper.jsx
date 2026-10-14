export default function Stepper({
  steps = [],
  currentStep = 0,
  onStepClick,
  className = "",
}) {
  return (
    <div
      className={`csat-stepper ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "16px 0",
        position: "relative",
      }}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isUpcoming = index > currentStep;
        const isClickable = onStepClick && isCompleted;

        return (
          <div
            key={step.id || step.label || index}
            style={{
              display: "flex",
              alignItems: "center",
              flex: index < steps.length - 1 ? 1 : "none",
              position: "relative",
            }}
          >
            {/* Step Circle & Label */}
            <div
              onClick={() => isClickable && onStepClick(index)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                cursor: isClickable ? "pointer" : "default",
                userSelect: "none",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                  transition: "all 0.2s ease",
                  background: isCompleted
                    ? "var(--success, #22c55e)"
                    : isCurrent
                    ? "var(--primary, #2563eb)"
                    : "var(--bg-surface, #0d1b2a)",
                  color: isCompleted || isCurrent ? "var(--text-white, #ffffff)" : "var(--text-dim, #64748b)",
                  border: isCompleted
                    ? "2px solid var(--success, #22c55e)"
                    : isCurrent
                    ? "2px solid var(--primary-lt, #60a5fa)"
                    : "2px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
                  boxShadow: isCurrent
                    ? "0 0 12px rgba(37, 99, 235, 0.45)"
                    : "none",
                }}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  index + 1
                )}
              </div>

              <span
                style={{
                  fontSize: "12px",
                  fontWeight: isCurrent ? 600 : 500,
                  color: isCurrent
                    ? "var(--text-white, #ffffff)"
                    : isCompleted
                    ? "var(--text-main, #e2e8f0)"
                    : "var(--text-dim, #64748b)",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting Bar */}
            {index < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: "2px",
                  margin: "0 12px",
                  marginTop: "-20px", // Align with circle center
                  background: isCompleted
                    ? "var(--success, #22c55e)"
                    : "var(--border, rgba(96, 165, 250, 0.15))",
                  transition: "background 0.25s ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
