import { useState, useRef, useEffect } from "react";

/**
 * Shared Action Button styles ensuring consistent height, padding,
 * border radius, alignment, and hover/active states across all three buttons.
 */
const BASE_BUTTON_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  height: "32px",
  padding: "0 12px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "all 0.15s ease",
  outline: "none",
  userSelect: "none",
};

/**
 * Copy Link Button
 * - Matches the reference pin image design language
 * - On click, copies the URL, toggles to "Copied" with check icon
 * - Automatically reverts after 2 seconds
 * - Clears any existing timeout on repeated clicks
 * - Handles hover states seamlessly in both standard and "Copied" modes
 */
export function CopyLinkButton({
  url,
  onCopy,
  title = "Copy survey response link to clipboard",
  className = "",
  style = {},
}) {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!url) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      if (onCopy) {
        onCopy(url);
      }
    } catch (err) {
      console.error("Failed to copy link:", err);
    }

    // Clear any active timeout so repeated rapid clicks reset the 2s timer cleanly
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setCopied(true);
    timerRef.current = setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, 2000);
  };

  const getStyle = () => {
    if (copied) {
      return {
        ...BASE_BUTTON_STYLE,
        background: isHovered
          ? "rgba(34, 197, 94, 0.22)"
          : "rgba(34, 197, 94, 0.14)",
        border: isHovered
          ? "1px solid rgba(34, 197, 94, 0.65)"
          : "1px solid rgba(34, 197, 94, 0.4)",
        color: isHovered ? "#86efac" : "#4ade80",
        boxShadow: isHovered ? "0 2px 10px rgba(34, 197, 94, 0.25)" : "none",
        ...style,
      };
    }

    return {
      ...BASE_BUTTON_STYLE,
      background: isHovered
        ? "rgba(56, 189, 248, 0.2)"
        : "rgba(56, 189, 248, 0.1)",
      border: isHovered
        ? "1px solid rgba(56, 189, 248, 0.55)"
        : "1px solid rgba(56, 189, 248, 0.28)",
      color: isHovered ? "#7dd3fc" : "#38bdf8",
      boxShadow: isHovered ? "0 2px 10px rgba(56, 189, 248, 0.2)" : "none",
      ...(isFocused ? { ring: "2px solid rgba(56, 189, 248, 0.4)" } : {}),
      ...style,
    };
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      title={copied ? "Link Copied!" : title}
      style={getStyle()}
      className={className}
      aria-label={copied ? "Copied link" : "Copy Link"}
    >
      {copied ? (
        // Checkmark Icon
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        // Interlocking Chain Link Pin Icon matching reference pin image
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )}
      <span>{copied ? "Copied" : "Copy Link"}</span>
    </button>
  );
}

/**
 * Resend Mail Button
 * - Consistent height, padding, border radius, and icon + label alignment
 * - Mail icon for default state
 * - Smooth loading state while mail is sending
 */
export function ResendMailButton({
  loading = false,
  onClick,
  disabled = false,
  title = "Trigger/Resend survey invitation email",
  className = "",
  style = {},
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isDisabled = disabled || loading;

  const getStyle = () => ({
    ...BASE_BUTTON_STYLE,
    background: isDisabled
      ? "rgba(96, 165, 250, 0.05)"
      : isHovered
      ? "rgba(96, 165, 250, 0.2)"
      : "rgba(96, 165, 250, 0.1)",
    border: isDisabled
      ? "1px solid rgba(96, 165, 250, 0.15)"
      : isHovered
      ? "1px solid rgba(96, 165, 250, 0.55)"
      : "1px solid rgba(96, 165, 250, 0.28)",
    color: isDisabled ? "rgba(147, 197, 253, 0.5)" : isHovered ? "#93c5fd" : "#60a5fa",
    boxShadow: isHovered && !isDisabled ? "0 2px 10px rgba(96, 165, 250, 0.2)" : "none",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.7 : 1,
    ...style,
  });

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      title={title}
      style={getStyle()}
      className={className}
      aria-label="Resend Mail"
    >
      {loading ? (
        <svg
          style={{ animation: "spin 1s linear infinite" }}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" fill="none" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeLinecap="round" />
        </svg>
      ) : (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      )}
      <span>{loading ? "Sending..." : "Resend Mail"}</span>
    </button>
  );
}

/**
 * Export CSV Button
 * - Consistent height, padding, border radius, and icon + label alignment
 * - Download tray/arrow icon for default state
 * - Smooth loading state while exporting
 */
export function ExportCsvButton({
  loading = false,
  onClick,
  disabled = false,
  title = "Export survey data as CSV",
  className = "",
  style = {},
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isDisabled = disabled || loading;

  const getStyle = () => ({
    ...BASE_BUTTON_STYLE,
    background: isDisabled
      ? "rgba(16, 185, 129, 0.05)"
      : isHovered
      ? "rgba(16, 185, 129, 0.2)"
      : "rgba(16, 185, 129, 0.1)",
    border: isDisabled
      ? "1px solid rgba(16, 185, 129, 0.15)"
      : isHovered
      ? "1px solid rgba(16, 185, 129, 0.55)"
      : "1px solid rgba(16, 185, 129, 0.28)",
    color: isDisabled ? "rgba(110, 231, 183, 0.5)" : isHovered ? "#6ee7b7" : "#34d399",
    boxShadow: isHovered && !isDisabled ? "0 2px 10px rgba(16, 185, 129, 0.2)" : "none",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.7 : 1,
    ...style,
  });

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      title={title}
      style={getStyle()}
      className={className}
      aria-label="Export CSV"
    >
      {loading ? (
        <svg
          style={{ animation: "spin 1s linear infinite" }}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" fill="none" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeLinecap="round" />
        </svg>
      ) : (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      <span>{loading ? "Exporting..." : "Export CSV"}</span>
    </button>
  );
}
