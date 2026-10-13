import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("pmo_token");
    const storedUser = localStorage.getItem("pmo_user");
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("pmo_token");
        localStorage.removeItem("pmo_user");
      }
    }
    setLoading(false);
  }, []);

  const saveSession = (accessToken, userData) => {
    localStorage.setItem("pmo_token", accessToken);
    localStorage.setItem("pmo_user", JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  };

  const login = useCallback(async (usernameOrEmail, password) => {
    const data = await authApi.login(usernameOrEmail, password);
    saveSession(data.access_token, data.user);
    return data;
  }, []);

  const loginWithSSO = useCallback(async (msAccessToken) => {
    const data = await authApi.ssoExchange(msAccessToken);
    saveSession(data.access_token, data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pmo_token");
    localStorage.removeItem("pmo_user");
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, loginWithSSO, logout, isAuthenticated }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
