import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import Input from "../components/Input";
import ThemeToggle from "../components/ThemeToggle";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { login, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Target destination after successful authentication: direct to Create Survey
  const redirectTarget = searchParams.get("from") || "/surveys/new";

  // Feature flag: SSO with Entra ID (In development)
  const isSsoEnabled = false;

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [networkError, setNetworkError] = useState("");

  // Handle explicit logout query parameter
  useEffect(() => {
    if (searchParams.get("logout") === "true") {
      logout();
    }
  }, [searchParams, logout]);

  // Only auto-redirect if user arrived with an explicit 'from' target (e.g. from a protected route)
  useEffect(() => {
    if (isAuthenticated && searchParams.get("from")) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget, searchParams]);

  // Validation rules
  const validateEmail = (val) => {
    const trimmed = val.trim();
    if (!trimmed) return "Email address is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return "Please enter a valid email address";
    return "";
  };

  const validatePassword = (val) => {
    if (!val) return "Password is required";
    if (val.length < 8) return "Password must be at least 8 characters";
    return "";
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "email") {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
    } else if (field === "password") {
      setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }));
    }
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (touched.email) {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(val) }));
    }
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    if (touched.password) {
      setFieldErrors((prev) => ({ ...prev, password: validatePassword(val) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setNetworkError("");

    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    setTouched({ email: true, password: true });
    setFieldErrors({ email: emailErr, password: passErr });

    if (emailErr || passErr) {
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      if (err?.response?.status === 403) {
        setAuthError(
          err.response.data?.detail ||
          "Access denied. Only users authorized by the administrator can access the CSAT tool."
        );
      } else if (err?.response?.status === 401) {
        setAuthError("Invalid email or password");
      } else {
        setNetworkError(
          err?.response?.data?.detail ||
          "Unable to connect to the server. Please check your network connection and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Integration stub: Microsoft Entra ID (MSAL) SSO
  const handleMicrosoftSso = async () => {
    if (!isSsoEnabled) return;
    // INTEGRATION STUB: Entra ID / MSAL authentication flow
    // When VITE_SSO_ENABLED=true and organizational approval is granted:
    // 1. Call msalInstance.loginPopup({ scopes: ["user.read"] }) or loginRedirect()
    // 2. Exchange Entra ID authorization token with backend POST /api/auth/sso/azure
    // 3. Receive CSAT session JWT and update AuthContext
    console.info("[SSO] Entra ID flow triggered (Stub: organization approval pending)");
  };

  return (
    <div className={styles.page}>
      {/* Top Header */}
      <header className={styles.topNav}>
        <div className={styles.brand}>
          <Logo size="sm" />
        </div>
        <ThemeToggle />
      </header>

      {/* Main Centered Content */}
      <main className={styles.mainContent}>
        <div className={styles.loginCard}>
          <div className={styles.heroLogo}>
            <Logo size="lg" />
          </div>

          <h1 className={styles.title}>Sign In</h1>
          <p className={styles.subtitle}>
            Authorized Access Only — Enter your approved credentials
          </p>

          {/* Microsoft SSO Notice (In development with dev team) */}
          <div className={styles.ssoNotice}>
            🔒 <strong>Enterprise SSO:</strong> Currently in progress with the dev team. Please sign in with your administrator-approved account credentials below.
          </div>

          {/* Active Session Notification if already authenticated */}
          {isAuthenticated && user && (
            <div
              style={{
                background: "rgba(37, 99, 235, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "16px",
                fontSize: "12px",
                color: "var(--primary-lt, #60a5fa)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span>Currently signed in as <strong>{user.email}</strong> ({user.role})</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => navigate(redirectTarget)}
                  style={{
                    background: "rgba(37, 99, 235, 0.25)",
                    border: "1px solid rgba(59, 130, 246, 0.5)",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "11px",
                  }}
                >
                  Go to App →
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#f87171",
                    cursor: "pointer",
                    fontWeight: 600,
                    textDecoration: "underline",
                    fontSize: "11px",
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Temporary Email + Password Form */}
          <form className={styles.loginForm} onSubmit={handleSubmit} noValidate>
            <Input
              id="emailInput"
              name="email"
              type="email"
              label="Email Address"
              placeholder="user@example.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={() => handleBlur("email")}
              error={touched.email ? fieldErrors.email : ""}
              disabled={loading}
              autoComplete="email"
              required
            />

            <Input
              id="passwordInput"
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••••••"
              value={password}
              onChange={handlePasswordChange}
              onBlur={() => handleBlur("password")}
              error={touched.password ? fieldErrors.password : ""}
              disabled={loading}
              autoComplete="current-password"
              required
            />

            <button
              id="loginSubmitBtn"
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* 401 Invalid Credentials Banner */}
          {authError && (
            <div className={`${styles.errorBanner} ${styles.authError}`} role="alert" id="authErrorBanner">
              <span>⚠</span>
              <span>{authError}</span>
            </div>
          )}

          {/* Network / Server Error Banner */}
          {networkError && (
            <div className={`${styles.errorBanner} ${styles.networkError}`} role="alert" id="networkErrorBanner">
              <span>⚠</span>
              <span>{networkError}</span>
            </div>
          )}
        </div>
      </main>

      {/* Layered Fluid Waves at Bottom */}
      <div className={styles.wavesContainer}>
        <svg
          className={styles.waveSvg}
          viewBox="0 0 1440 180"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className={styles.wavePath1}
            d="M0,60 C260,110 440,30 760,85 C1080,140 1280,60 1440,75 L1440,180 L0,180 Z"
          />
          <path
            className={styles.wavePath2}
            d="M0,95 C220,55 480,135 840,85 C1120,45 1320,110 1440,95 L1440,180 L0,180 Z"
          />
          <path
            className={styles.wavePath3}
            d="M0,130 C300,90 560,155 920,115 C1180,85 1340,135 1440,120 L1440,180 L0,180 Z"
          />
        </svg>
      </div>
    </div>
  );
}
