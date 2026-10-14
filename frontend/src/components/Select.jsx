export default function Select({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  options = [],
  placeholder = "Select an option",
  error,
  helperText,
  required = false,
  disabled = false,
  className = "",
  style = {},
  ...props
}) {
  const selectId = id || name || `select-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div
      className={`select-container ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "100%",
        textAlign: "left",
        ...style,
      }}
    >
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: error ? "var(--danger, #ef4444)" : "var(--text-muted, #94a3b8)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>{label}</span>
          {required && (
            <span style={{ color: "var(--danger, #ef4444)" }} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div style={{ position: "relative", width: "100%" }}>
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          style={{
            width: "100%",
            height: "44px",
            padding: "0 36px 0 14px",
            background: "var(--bg-surface, #0d1b2a)",
            border: `1px solid ${
              error
                ? "var(--danger, #ef4444)"
                : "var(--border-strong, rgba(96, 165, 250, 0.25))"
            }`,
            borderRadius: "var(--radius-md, 9px)",
            color: value ? "var(--text-main, #e2e8f0)" : "var(--text-dim, #64748b)",
            fontSize: "14px",
            outline: "none",
            appearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            opacity: disabled ? 0.6 : 1,
          }}
          onFocus={(e) => {
            if (!error) {
              e.target.style.borderColor = "var(--primary-lt, #60a5fa)";
              e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.25)";
            }
          }}
          onBlurCapture={(e) => {
            e.target.style.borderColor = error
              ? "var(--danger, #ef4444)"
              : "var(--border-strong, rgba(96, 165, 250, 0.25))";
            e.target.style.boxShadow = "none";
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled style={{ background: "#0d1b2a", color: "#64748b" }}>
              {placeholder}
            </option>
          )}
          {options.map((opt) => {
            const val = typeof opt === "object" ? opt.value : opt;
            const lbl = typeof opt === "object" ? opt.label : opt;
            const dis = typeof opt === "object" ? opt.disabled : false;
            return (
              <option
                key={val}
                value={val}
                disabled={dis}
                style={{ background: "#0d1b2a", color: "#e2e8f0" }}
              >
                {lbl}
              </option>
            );
          })}
        </select>

        {/* Custom Chevron Down */}
        <div
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "var(--text-muted, #94a3b8)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {error ? (
        <span
          id={`${selectId}-error`}
          style={{
            fontSize: "12px",
            color: "var(--danger, #ef4444)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
          role="alert"
        >
          <span>⚠</span>
          <span>{error}</span>
        </span>
      ) : helperText ? (
        <span
          id={`${selectId}-helper`}
          style={{
            fontSize: "12px",
            color: "var(--text-dim, #64748b)",
          }}
        >
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
