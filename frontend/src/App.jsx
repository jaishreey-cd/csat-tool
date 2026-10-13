import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { msalConfig } from "./msalConfig";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

// Initialize MSAL once at the module level (not inside a component)
const msalInstance = new PublicClientApplication(msalConfig);

/** Route guard: redirect to login if not authenticated */
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1b2a",
          color: "#64748b",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "0.9rem",
          gap: "0.75rem",
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "2px solid #1e3a5f",
            borderTopColor: "#3b82f6",
            display: "inline-block",
            animation: "spin 0.65s linear infinite",
          }}
        />
        <span>Loading session…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/** Redirect already-authenticated users away from login */
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              }
            />
            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </MsalProvider>
  );
}
