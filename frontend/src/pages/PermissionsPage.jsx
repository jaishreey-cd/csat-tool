import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import authApi from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Input from "../components/Input";
import Select from "../components/Select";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";

const INITIAL_ADMIN_EMAIL = "admin@csat.local";
const MAX_PMO_LIMIT = 3;

export default function PermissionsPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("current"); // "current" | "old"
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("User");
  const [granting, setGranting] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  // Guard: Admin only
  useEffect(() => {
    if (currentUser && currentUser.role !== "Admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [currentUser, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await authApi.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setToast({ message: "Failed to load users list.", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Compute PMO limit metrics and filtered user lists
  const grantedPmoUsers = users.filter((u) => u.email.toLowerCase() !== INITIAL_ADMIN_EMAIL);
  const activePmoCount = grantedPmoUsers.filter((u) => u.is_active).length;
  const isLimitReached = activePmoCount >= MAX_PMO_LIMIT;

  const currentUsers = useMemo(() => users.filter((u) => u.is_active), [users]);
  const oldUsers = useMemo(() => users.filter((u) => !u.is_active), [users]);
  const displayedUsers = userFilter === "current" ? currentUsers : oldUsers;

  const handleGrantAccess = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setToast({ message: "Please enter a valid PMO email address.", type: "warning" });
      return;
    }

    if (isLimitReached) {
      setToast({
        message: `Maximum limit of ${MAX_PMO_LIMIT} PMOs reached. Cannot grant access to more users.`,
        type: "danger",
      });
      return;
    }

    setGranting(true);
    try {
      await authApi.grantUserAccess({ email: trimmedEmail, role });
      setToast({ message: `Access successfully granted to ${trimmedEmail} (${role})!`, type: "success" });
      setEmail("");
      setRole("User");
      fetchUsers();
    } catch (err) {
      console.error("Failed to grant access:", err);
      setToast({
        message: err.response?.data?.detail || "Failed to grant access. Please try again.",
        type: "danger",
      });
    } finally {
      setGranting(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await authApi.updateUserRole(userId, newRole);
      setToast({ message: `User role updated to ${newRole}!`, type: "success" });
      fetchUsers();
    } catch (err) {
      console.error("Failed to update role:", err);
      setToast({ message: err.response?.data?.detail || "Failed to update role.", type: "danger" });
    }
  };

  const handleToggleStatus = async (userId, currentActive, userRole) => {
    if (!currentActive && isLimitReached) {
      setToast({
        message: `Cannot activate user: Maximum limit of ${MAX_PMO_LIMIT} active PMOs is already reached.`,
        type: "danger",
      });
      return;
    }

    const nextActive = !currentActive;

    // Immediately update state optimistically so the user transitions between filters with zero delay
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === userId ? { ...u, is_active: nextActive } : u))
    );

    try {
      await authApi.updateUserRole(userId, userRole, nextActive);
      setToast({
        message: nextActive ? "User access restored." : "User access revoked.",
        type: "success",
      });
      fetchUsers();
    } catch (err) {
      console.error("Failed to toggle status:", err);
      // Revert optimistic update on failure
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === userId ? { ...u, is_active: currentActive } : u))
      );
      setToast({ message: err.response?.data?.detail || "Failed to update access status.", type: "danger" });
    }
  };

  return (
    <div style={{ padding: "28px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>
      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "info" })}
        />
      )}

      {/* Header with 3-PMO Limit Allocation Tracker */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-white, #ffffff)", margin: 0, letterSpacing: "-0.4px" }}>
            User Permissions & Access Control
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
            The initial Admin uses this route to grant access to up to 3 PMOs as either User or Admin.
          </p>
        </div>

        {/* 3-PMO Limit Counter Badge */}
        <div
          style={{
            background: isLimitReached ? "rgba(239, 68, 68, 0.15)" : "rgba(37, 99, 235, 0.15)",
            border: `1px solid ${isLimitReached ? "rgba(239, 68, 68, 0.4)" : "rgba(96, 165, 250, 0.35)"}`,
            borderRadius: "10px",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 600 }}>
            PMO Allocation:
          </span>
          <span
            style={{
              fontSize: "15px",
              fontWeight: 800,
              color: isLimitReached ? "#f87171" : "#60a5fa",
            }}
          >
            {activePmoCount} / {MAX_PMO_LIMIT} PMOs Used
          </span>
        </div>
      </div>

      {/* Grant Access Card */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "24px 28px",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
              Grant Access to PMO
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
              Assign a role (User or Admin) to an organization PMO colleague (maximum of 3 PMOs).
            </p>
          </div>
          {isLimitReached && (
            <Badge variant="warning">
              3-PMO Limit Reached
            </Badge>
          )}
        </div>

        {isLimitReached && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#fbbf24",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠</span>
            <span>
              All 3 PMO slots are currently active. To grant access to a different PMO, suspend or modify an existing PMO in the table below.
            </span>
          </div>
        )}

        <form onSubmit={handleGrantAccess} style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: "260px" }}>
            <Input
              id="userEmailInput"
              label="PMO Email *"
              type="email"
              placeholder="pmo.colleague@organization.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLimitReached || granting}
              required
            />
          </div>

          <div style={{ flex: 1, minWidth: "200px" }}>
            <Select
              id="userRoleSelect"
              label="Role Assignment *"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isLimitReached || granting}
              options={[
                { value: "User", label: "User (Surveys & Dashboard only)" },
                { value: "Admin", label: "Admin (Full system access)" },
              ]}
            />
          </div>

          <div style={{ paddingBottom: "2px" }}>
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={isLimitReached || granting || !email.trim()}
            >
              {granting ? "Granting Access..." : "Grant Access"}
            </Button>
          </div>
        </form>
      </div>

      {/* Authorized PMOs & Users Table */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
          borderRadius: "var(--radius-lg, 12px)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h4 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
              System Access Roster
            </h4>

            {/* User Filter Controls (Current Users vs Old Users) */}
            <div
              style={{
                display: "inline-flex",
                background: "rgba(10, 22, 40, 0.7)",
                borderRadius: "8px",
                padding: "3px",
                border: "1px solid rgba(96, 165, 250, 0.2)",
                gap: "4px",
              }}
            >
              <button
                type="button"
                id="filter-current-users-btn"
                onClick={() => setUserFilter("current")}
                style={{
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  background: userFilter === "current" ? "rgba(37, 99, 235, 0.3)" : "transparent",
                  color: userFilter === "current" ? "#93c5fd" : "var(--text-dim, #64748b)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>Current Users</span>
                <span
                  style={{
                    background: userFilter === "current" ? "#2563eb" : "rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "10px",
                  }}
                >
                  {currentUsers.length}
                </span>
              </button>

              <button
                type="button"
                id="filter-old-users-btn"
                onClick={() => setUserFilter("old")}
                style={{
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  background: userFilter === "old" ? "rgba(239, 68, 68, 0.25)" : "transparent",
                  color: userFilter === "old" ? "#fca5a5" : "var(--text-dim, #64748b)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>Old Users</span>
                <span
                  style={{
                    background: userFilter === "old" ? "#ef4444" : "rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "10px",
                  }}
                >
                  {oldUsers.length}
                </span>
              </button>
            </div>
          </div>

          <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)" }}>
            Initial Admin: 1 | Allocated PMOs: {activePmoCount} / {MAX_PMO_LIMIT}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "50px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <Spinner size="lg" />
            <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>Loading access roster...</span>
          </div>
        ) : displayedUsers.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "14px" }}>
            {userFilter === "current"
              ? "No active users currently found."
              : "No old or revoked users found."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr
                  style={{
                    background: "rgba(10, 22, 40, 0.8)",
                    borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                    color: "var(--text-dim, #64748b)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  <th style={{ padding: "14px 20px", fontWeight: 700 }}>Email Address</th>
                  <th style={{ padding: "14px 20px", fontWeight: 700 }}>Full Name</th>
                  <th style={{ padding: "14px 20px", fontWeight: 700 }}>Role</th>
                  <th style={{ padding: "14px 20px", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "14px 20px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((u) => {
                  const isInitialAdmin = u.email.toLowerCase() === INITIAL_ADMIN_EMAIL;

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid rgba(96, 165, 250, 0.08)",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(14, 30, 50, 0.45)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 20px", color: "#93c5fd", fontFamily: "monospace", fontWeight: 600 }}>
                        {u.email}
                      </td>

                      <td style={{ padding: "14px 20px", color: "var(--text-white, #ffffff)", fontWeight: 500 }}>
                        {u.full_name || "—"}
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        {isInitialAdmin ? (
                          <Badge variant="active">Initial Admin</Badge>
                        ) : (
                          <select
                            value={u.role === "Admin" ? "Admin" : "User"}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{
                              background: "#0b1329",
                              border: "1px solid rgba(96, 165, 250, 0.3)",
                              color: "#60a5fa",
                              borderRadius: "4px",
                              padding: "4px 8px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <option value="User">User</option>
                            <option value="Admin">Admin</option>
                          </select>
                        )}
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: u.is_active ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: u.is_active ? "#22c55e" : "#ef4444",
                            border: `1px solid ${u.is_active ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          }}
                        >
                          {u.is_active ? "● Authorized" : "✕ Suspended"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        {isInitialAdmin ? (
                          <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", fontStyle: "italic" }}>
                            Permanent Owner
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u.id, u.is_active, u.role)}
                            disabled={!u.is_active && isLimitReached}
                            title={!u.is_active && isLimitReached ? "3-PMO limit reached. Suspend another user first." : undefined}
                            style={{
                              background: "transparent",
                              border: `1px solid ${u.is_active ? "rgba(248, 113, 113, 0.3)" : "rgba(74, 222, 128, 0.3)"}`,
                              color: u.is_active ? "#f87171" : "#4ade80",
                              opacity: !u.is_active && isLimitReached ? 0.5 : 1,
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              cursor: !u.is_active && isLimitReached ? "not-allowed" : "pointer",
                              fontWeight: 600,
                              transition: "all 0.15s ease",
                            }}
                          >
                            {u.is_active ? "Revoke Access" : "Restore Access"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
