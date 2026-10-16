import { useState, useEffect } from "react";
import authApi from "../api/authApi";
import Button from "../components/Button";
import Input from "../components/Input";
import Select from "../components/Select";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";

export default function PermissionsPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("PMO");
  const [granting, setGranting] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [adminCountInfo, setAdminCountInfo] = useState({
    active_admin_count: 0,
    max_admins: 3,
    is_limit_reached: false,
  });

  const calculateActiveAdmins = (userList) => {
    return (userList || []).filter(
      (u) => (u.role || "").trim().toLowerCase() === "admin" && Boolean(u.is_active)
    ).length;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [usersResult, countResult] = await Promise.allSettled([
        authApi.getUsers(),
        authApi.getAdminCount(),
      ]);

      const resolvedUsers = usersResult.status === "fulfilled" ? usersResult.value || [] : [];
      setUsers(resolvedUsers);

      if (countResult.status === "fulfilled" && countResult.value) {
        setAdminCountInfo(countResult.value);
      } else {
        const count = calculateActiveAdmins(resolvedUsers);
        setAdminCountInfo({
          active_admin_count: count,
          max_admins: 3,
          is_limit_reached: count >= 3,
        });
      }
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

  const handleGrantAccess = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setToast({ message: "Please enter a valid user email address.", type: "warning" });
      return;
    }

    const currentAdmins = calculateActiveAdmins(users);
    const existingUser = users.find((u) => u.email?.trim().toLowerCase() === trimmedEmail);
    const isAlreadyActiveAdmin =
      existingUser &&
      (existingUser.role || "").trim().toLowerCase() === "admin" &&
      Boolean(existingUser.is_active);

    // Enforce 3-Admin limit on granting access
    if (role.trim().toLowerCase() === "admin" && !isAlreadyActiveAdmin && currentAdmins >= 3) {
      setToast({
        message:
          "Maximum of 3 Admins reached. Revoke access from an existing Admin before granting Admin access to another user.",
        type: "danger",
      });
      return;
    }

    setGranting(true);
    try {
      await authApi.grantUserAccess({ email: trimmedEmail, role });
      setToast({ message: `Access successfully granted to ${trimmedEmail} (${role})!`, type: "success" });
      setEmail("");
      setRole("PMO");
      await fetchUsers();
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


  const handleToggleStatus = async (userId, currentActive, userRole) => {
    const isActivatingAdmin =
      !currentActive && (userRole || "").trim().toLowerCase() === "admin";
    const currentAdmins = calculateActiveAdmins(users);

    if (isActivatingAdmin && currentAdmins >= 3) {
      setToast({
        message:
          "Maximum of 3 Admins reached. Revoke access from an existing Admin before granting Admin access to another user.",
        type: "danger",
      });
      return;
    }

    try {
      await authApi.updateUserRole(userId, userRole, !currentActive);
      setToast({
        message: !currentActive ? "User access activated." : "User access suspended/revoked.",
        type: "success",
      });
      await fetchUsers();
    } catch (err) {
      console.error("Failed to toggle status:", err);
      setToast({
        message: err.response?.data?.detail || "Failed to update access status.",
        type: "danger",
      });
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

      {/* Header with Active Admin count badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-white, #ffffff)", margin: 0, letterSpacing: "-0.4px" }}>
            User Permissions & Access Control
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
            Administrators can allow users by entering their email address and assigning their permission role.
          </p>
        </div>

        {/* Live Admin Slot Counter Badge */}
        <div
          id="adminSlotCounter"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            background: adminCountInfo.active_admin_count >= 3 ? "rgba(239, 68, 68, 0.12)" : "rgba(37, 99, 235, 0.12)",
            border: `1px solid ${adminCountInfo.active_admin_count >= 3 ? "rgba(239, 68, 68, 0.35)" : "rgba(59, 130, 246, 0.35)"}`,
            borderRadius: "24px",
            padding: "8px 16px",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: adminCountInfo.active_admin_count >= 3 ? "#ef4444" : "#22c55e",
              boxShadow: `0 0 8px ${adminCountInfo.active_admin_count >= 3 ? "#ef4444" : "#22c55e"}`,
            }}
          />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.2px" }}>
            Active Admins: <span style={{ color: adminCountInfo.active_admin_count >= 3 ? "#f87171" : "#60a5fa" }}>{adminCountInfo.active_admin_count}</span> / 3
          </span>
          {adminCountInfo.active_admin_count >= 3 ? (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "12px",
                background: "rgba(239, 68, 68, 0.25)",
                color: "#fca5a5",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Limit Reached
            </span>
          ) : (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "12px",
                background: "rgba(34, 197, 94, 0.15)",
                color: "#86efac",
              }}
            >
              {3 - adminCountInfo.active_admin_count} slot{3 - adminCountInfo.active_admin_count !== 1 ? "s" : ""} open
            </span>
          )}
        </div>
      </div>

      {/* Grant Access Card (Email + Role + Grant Access) */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "24px 28px",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
        }}
      >
        <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: "0 0 6px 0" }}>
          Grant Access to User
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "0 0 18px 0" }}>
          Enter the colleague's organization email and choose their permission role (PMO or Admin) to grant access.
        </p>

        <form onSubmit={handleGrantAccess} style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: "260px" }}>
            <Input
              id="userEmailInput"
              label="User Email *"
              type="email"
              placeholder="colleague@organization.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ flex: 1, minWidth: "180px" }}>
            <Select
              id="userRoleSelect"
              label="Role *"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={[
                { value: "PMO", label: "PMO (Surveys & Analytics)" },
                { value: "Admin", label: "Admin (Full Control)" },
              ]}
            />
          </div>

          <div style={{ paddingBottom: "2px" }}>
            <Button variant="primary" size="md" type="submit" disabled={granting || !email.trim()}>
              {granting ? "Granting Access..." : "Grant Access"}
            </Button>
          </div>
        </form>

        {/* Warning banner if Admin role selected while limit is reached */}
        {role === "Admin" && adminCountInfo.active_admin_count >= 3 && (
          <div
            id="adminLimitAlert"
            style={{
              marginTop: "16px",
              padding: "12px 16px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: "#fca5a5",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "16px" }}>⚠️</span>
            <span>
              <strong>Maximum of 3 Admins reached.</strong> Revoke access from an existing Admin before granting Admin access to another user.
            </span>
          </div>
        )}
      </div>

      {/* Authorized Users List Table */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
          borderRadius: "var(--radius-lg, 12px)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <h4 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
            Authorized Users ({users.length})
          </h4>
          <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
            Active Admins: <strong style={{ color: adminCountInfo.active_admin_count >= 3 ? "#f87171" : "#60a5fa" }}>{adminCountInfo.active_admin_count}/3</strong> • PMO: <strong style={{ color: "#ffffff" }}>{users.filter(u => (u.role || "").toLowerCase() === "pmo" && u.is_active).length}</strong>
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "50px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <Spinner size="lg" />
            <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>Loading authorized users...</span>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim, #64748b)" }}>
            No users found.
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
                  <th style={{ padding: "14px 20px", fontWeight: 700 }}>Access Status</th>
                  <th style={{ padding: "14px 20px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
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
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "4px",
                          background: (u.role || "").toLowerCase() === "admin" ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.15)",
                          color: (u.role || "").toLowerCase() === "admin" ? "#f59e0b" : "#60a5fa",
                          border: `1px solid ${(u.role || "").toLowerCase() === "admin" ? "rgba(245, 158, 11, 0.35)" : "rgba(59, 130, 246, 0.3)"}`,
                          letterSpacing: "0.3px",
                        }}
                      >
                        {u.role || "PMO"}
                      </span>
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
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u.id, u.is_active, u.role)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(148, 163, 184, 0.2)",
                          color: u.is_active ? "#f87171" : "#4ade80",
                          padding: "4px 10px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {u.is_active ? "Revoke Access" : "Grant Access"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
