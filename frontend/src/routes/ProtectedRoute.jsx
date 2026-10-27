import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-deep)",
          color: "var(--text-muted)",
          gap: "12px",
        }}
      >
        <Spinner size="md" />
        <span>Restoring session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve original location in state so user is returned after login
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (requiredRole) {
    const userRole = (user?.role || "").toLowerCase();
    const reqRole = requiredRole.toLowerCase();

    if (reqRole === "admin") {
      // Both Admin and Super Admin have admin access
      if (!userRole.includes("admin")) {
        return <Navigate to="/dashboard" replace />;
      }
    } else if (userRole !== reqRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
