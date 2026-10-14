import { createContext, useContext, useState, useEffect, useCallback } from "react";
import authApi from "../api/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session via /auth/me on mount
  useEffect(() => {
    const restoreSession = async () => {
      // NOTE: Storing the JWT in localStorage is implemented here as requested.
      // In production, httpOnly Secure SameSite cookies are the recommended more secure future option
      // to guard against XSS token extraction.
      const storedToken = localStorage.getItem("csat_token");
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        setToken(storedToken);
        const me = await authApi.getMe();
        setUser(me);
        localStorage.setItem("csat_user", JSON.stringify(me));
      } catch {
        // Token invalid or expired
        localStorage.removeItem("csat_token");
        localStorage.removeItem("csat_user");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    // Persist JWT and user profile in localStorage
    localStorage.setItem("csat_token", data.access_token);
    localStorage.setItem("csat_user", JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("csat_token");
    localStorage.removeItem("csat_user");
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export default AuthContext;
