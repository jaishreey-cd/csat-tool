import { useState } from "react";

export default function Input({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  helperText,
  required = false,
  disabled = false,
  autoComplete,
  className = "",
  style = {},
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === "password";
  const actualType = isPasswordType ? (showPassword ? "text" : "password") : type;

  const inputId = id || name || `input-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div
      className={`input-container ${className}`}
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
          htmlFor={inputId}
          style={{
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: error ? "var(--danger, #ef4444)" : "var(--text-secondary, #475569)",
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

      <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
        <input
          id={inputId}
          name={name}
          type={actualType}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          style={{
            width: "100%",
            height: "44px",
            padding: isPasswordType ? "0 44px 0 14px" : "0 14px",
            background: "var(--bg-elevated, #F8FAFF)",
            border: `1px solid ${
              error
                ? "var(--danger, #ef4444)"
                : "var(--border, #D8E1EF)"
            }`,
            borderRadius: "var(--radius-md, 9px)",
            color: "var(--text-primary, #172033)",
            fontSize: "14px",
            outline: "none",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? "not-allowed" : "text",
          }}
          onFocus={(e) => {
            if (!error) {
              e.target.style.borderColor = "var(--primary, #2563eb)";
              e.target.style.boxShadow = "0 0 0 3px var(--primary-badge-bg, rgba(37, 99, 235, 0.2))";
            }
          }}
          onBlurCapture={(e) => {
            e.target.style.borderColor = error
              ? "var(--danger, #ef4444)"
              : "var(--border, #D8E1EF)";
            e.target.style.boxShadow = "none";
          }}
          {...props}
        />

        {isPasswordType && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
            style={{
              position: "absolute",
              right: "10px",
              background: "transparent",
              border: "none",
              color: "var(--text-secondary, #64748b)",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              borderRadius: "4px",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary, #64748b)")}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        )}
      </div>

      {error ? (
        <span
          id={`${inputId}-error`}
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
          id={`${inputId}-helper`}
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
