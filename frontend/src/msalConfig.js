/**
 * Microsoft MSAL Configuration for Azure AD / Entra ID SSO
 * Replace CLIENT_ID and TENANT_ID with your Azure AD app registration values.
 */
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AAD_CLIENT_ID || "your-azure-client-id",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AAD_TENANT_ID || "common"}`,
    redirectUri: import.meta.env.VITE_AAD_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

/** Scopes requested during login - openid & profile give us the user's name/email */
export const loginRequest = {
  scopes: ["openid", "profile", "User.Read"],
};
