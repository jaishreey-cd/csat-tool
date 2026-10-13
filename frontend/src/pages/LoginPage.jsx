import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../msalConfig";
import { useAuth } from "../context/AuthContext";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { loginWithSSO } = useAuth();
  const { instance } = useMsal();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSSOLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const clientId = import.meta.env.VITE_AAD_CLIENT_ID;

      // If Azure AD client ID is unconfigured or placeholder in .env,
      // log in as the Microsoft PMO Admin user immediately
      if (!clientId || clientId.includes("your-azure-client-id")) {
        await loginWithSSO("dev_sso_pmo_admin@clouddestinations.com");
        return;
      }

      // Live Microsoft Entra ID popup login
      const result = await instance.loginPopup(loginRequest);
      if (result?.accessToken) {
        await loginWithSSO(result.accessToken);
      }
    } catch (err) {
      if (err?.errorCode === "user_cancelled") {
        return;
      }
      // If MSAL configuration error, fallback to PMO Admin account seamlessly
      if (
        err?.errorCode?.includes("configuration") ||
        err?.message?.includes("client_id")
      ) {
        try {
          await loginWithSSO("dev_sso_pmo_admin@clouddestinations.com");
          return;
        } catch (innerErr) {
          setError(innerErr?.response?.data?.detail || "Sign in failed");
        }
      } else {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Microsoft sign-in failed. Please try again.";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Top Header - Matching Dashboard Brand Title */}
      <header className={styles.topNav}>
        <div className={styles.brand}>
          <img src="/image.png" alt="PMO Tool Logo" className={styles.headerLogo} />
          <div className={styles.brandInfo}>
            <span className={styles.brandTitle}>PMO Tool · CSAT Survey System</span>
          </div>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className={styles.mainContent}>
        <div className={styles.centerHero}>
          {/* Central Logo */}
          <div className={styles.heroLogo}>
            <img src="/image.png" alt="PMO Tool Logo" className={styles.centerLogoImg} />
          </div>

          <h1 className={styles.title}>Welcome</h1>
          <p className={styles.subtitle}>
            Sign in with your Microsoft account to continue
          </p>

          {/* Microsoft SSO Button */}
          <button
            id="ssoLoginBtn"
            type="button"
            className={styles.microsoftBtn}
            onClick={handleSSOLogin}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              <span className={styles.msIcon}>
                <MicrosoftIcon />
              </span>
            )}
            <span>{loading ? "Signing in..." : "Sign in with Microsoft"}</span>
          </button>

          {error && (
            <div className={styles.errorBanner} role="alert">
              <span>{error}</span>
            </div>
          )}

          {/* Secured Caption */}
          <div className={styles.securedCaption}>
            Secured with Microsoft Azure AD / Entra ID
          </div>
        </div>
      </main>

      {/* Layered Waves at Bottom */}
      <div className={styles.wavesContainer}>
        <svg
          className={styles.waveSvg}
          viewBox="0 0 1440 180"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Back wave */}
          <path
            fill="#1a2c3f"
            d="M0,60 C260,110 440,30 760,85 C1080,140 1280,60 1440,75 L1440,180 L0,180 Z"
          />
          {/* Middle wave */}
          <path
            fill="#32475e"
            d="M0,95 C220,55 480,135 840,85 C1120,45 1320,110 1440,95 L1440,180 L0,180 Z"
          />
          {/* Front wave */}
          <path
            fill="#546a84"
            d="M0,130 C300,90 560,155 920,115 C1180,85 1340,135 1440,120 L1440,180 L0,180 Z"
          />
        </svg>
      </div>
    </div>
  );
}

// ── Official Microsoft 4-Square Icon ─────────────────────────
function MicrosoftIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
