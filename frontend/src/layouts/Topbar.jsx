import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import authApi from "../api/authApi";
import Button from "../components/Button";

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [userList, setUserList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const titleMap = {
    "/dashboard": "Dashboard",
    "/surveys/new": "Create Survey",
    "/surveys": "Surveys",
    "/questions": "Question Bank",
  };

  // Determine current page title
  let currentTitle = titleMap[location.pathname];
  if (!currentTitle) {
    if (location.pathname.startsWith("/projects/")) {
      currentTitle = "Project Analytics";
    } else {
      currentTitle = "CSAT";
    }
  }

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return "US";
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const data = await authApi.getUsers();
      setUserList(data || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const openPermissionsModal = () => {
    setIsPermissionsOpen(true);
    loadUsers();
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await authApi.updateUserRole(userId, newRole);
      setStatusMsg("Permissions updated successfully!");
      loadUsers();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error("Failed to update role:", err);
      alert("Failed to update user permissions.");
    }
  };

  return (
    <>
      <header
        style={{
          height: "var(--topbar-h, 68px)",
          background: "var(--bg-surface, #0d1b2a)",
          borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          position: "sticky",
          top: 0,
          zIndex: 30,
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Left: Mobile hamburger & Page Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            className="mobile-hamburger-btn"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-main, #e2e8f0)",
              fontSize: "20px",
              cursor: "pointer",
              display: "none",
              padding: "4px",
            }}
          >
            ☰
          </button>

          <h1
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--text-white, #ffffff)",
              margin: 0,
              letterSpacing: "-0.2px",
            }}
          >
            {currentTitle}
          </h1>
        </div>

        {/* Right: User Profile, Role Badge & Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Admin Permissions Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={openPermissionsModal}
            title="Manage user roles and permissions"
          >
            <span style={{ marginRight: "4px" }}>🛡️</span> Permissions
          </Button>

          {/* User Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--bg-card, rgba(14, 30, 50, 0.8))",
              border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
              padding: "4px 12px 4px 6px",
              borderRadius: "var(--radius-full, 9999px)",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent, #06b6d4), var(--primary, #2563eb))",
                color: "var(--text-white, #ffffff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              {getInitials(user?.full_name, user?.email)}
            </div>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main, #e2e8f0)" }}>
              {user?.full_name || user?.email || "User"}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                background: user?.role === "Admin" ? "rgba(16, 185, 129, 0.2)" : "rgba(37, 99, 235, 0.2)",
                color: user?.role === "Admin" ? "#6ee7b7" : "#93c5fd",
                padding: "2px 6px",
                borderRadius: "4px",
                border: `1px solid ${user?.role === "Admin" ? "rgba(16, 185, 129, 0.4)" : "rgba(37, 99, 235, 0.4)"}`,
                textTransform: "uppercase",
              }}
            >
              {user?.role || "Admin"}
            </span>
          </div>

          {/* Logout Button */}
          <Button variant="ghost" size="sm" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Admin Permissions Modal */}
      {isPermissionsOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0d1b2a",
              border: "1px solid rgba(96, 165, 250, 0.3)",
              borderRadius: "12px",
              padding: "24px 28px",
              maxWidth: "680px",
              width: "100%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>🛡️</span>
                <h3 style={{ color: "#ffffff", margin: 0, fontSize: "18px", fontWeight: 700 }}>
                  User Permissions & Access Control
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPermissionsOpen(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "20px", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Administrators can grant or revoke system permissions to manage surveys, question banks, and analytics.
            </p>

            {statusMsg && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#6ee7b7",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  fontSize: "13px",
                }}
              >
                ✓ {statusMsg}
              </div>
            )}

            {loadingUsers ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                Loading user accounts...
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid rgba(96, 165, 250, 0.15)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  marginBottom: "20px",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "rgba(15, 23, 42, 0.8)", borderBottom: "1px solid rgba(96, 165, 250, 0.2)" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>User</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Email</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", color: "#94a3b8", fontWeight: 600 }}>Role / Permission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList.map((u) => (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: "1px solid rgba(96, 165, 250, 0.1)",
                          background: "rgba(13, 27, 42, 0.4)",
                        }}
                      >
                        <td style={{ padding: "12px 14px", color: "#ffffff", fontWeight: 500 }}>
                          {u.full_name}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#cbd5e1", fontFamily: "monospace" }}>
                          {u.email}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <select
                            value={u.role || "Admin"}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{
                              background: "#0b1329",
                              border: "1px solid rgba(96, 165, 250, 0.3)",
                              color: "#60a5fa",
                              borderRadius: "4px",
                              padding: "4px 8px",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            <option value="Admin">Admin (Full Control)</option>
                            <option value="PMO">PMO (Survey & Client Manager)</option>
                            <option value="Viewer">Viewer (Read-only Analytics)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="primary" size="sm" onClick={() => setIsPermissionsOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-hamburger-btn {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
