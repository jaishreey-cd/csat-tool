import { createContext, useContext, useState, useEffect, useCallback } from "react";
import authApi from "../api/authApi";
import clientsApi from "../api/clientsApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("csat_token") || null);
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("csat_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  // Loading is only true if we have a token but no cached user profile in localStorage
  const [loading, setLoading] = useState(() => {
    const storedToken = localStorage.getItem("csat_token");
    const storedUser = localStorage.getItem("csat_user");
    return !!storedToken && !storedUser;
  });

  // Verify / refresh session via /auth/me silently in the background on mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem("csat_token");
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const me = await authApi.getMe();
        setUser(me);
        localStorage.setItem("csat_user", JSON.stringify(me));
      } catch (err) {
        // If 401 unauthorized, token has expired
        if (err?.response?.status === 401) {
          localStorage.removeItem("csat_token");
          localStorage.removeItem("csat_user");
          setToken(null);
          setUser(null);
        }
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
    clientsApi.invalidateCache();
    setToken(data.access_token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("csat_token");
    localStorage.removeItem("csat_user");
    clientsApi.invalidateCache();
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
