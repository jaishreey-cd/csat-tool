import { useState, useEffect, useMemo } from "react";
import authApi from "../api/authApi";
import clientsApi from "../api/clientsApi";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Input from "../components/Input";
import Select from "../components/Select";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";

const SUPER_ADMIN_EMAILS = [
  "admin@csat.local",
  "mythilip@clouddestinations.com",
  "shanmugarajb@clouddestinations.com",
];

const isSuperAdmin = (u) =>
  (u.role || "").toLowerCase().includes("super") ||
  SUPER_ADMIN_EMAILS.includes((u.email || "").toLowerCase());

export default function PermissionsPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("current"); // "current" | "old"
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("User");
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [granting, setGranting] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [adminCountInfo, setAdminCountInfo] = useState({
    active_admin_count: 0,
    max_admins: 3,
    is_limit_reached: false,
  });

  // Assign Projects Modal State
  const [editingProjectsUser, setEditingProjectsUser] = useState(null);
  const [editModalProjectIds, setEditModalProjectIds] = useState([]);
  const [savingProjects, setSavingProjects] = useState(false);

  const calculateActiveAdmins = (userList) => {
    return (userList || []).filter(
      (u) => (u.role || "").trim().toLowerCase() === "admin" && Boolean(u.is_active)
    ).length;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [usersResult, countResult, clientsResult] = await Promise.allSettled([
        authApi.getUsers(),
        authApi.getAdminCount(),
        clientsApi.getClients(),
      ]);

      const resolvedUsers = usersResult.status === "fulfilled" ? usersResult.value || [] : [];
      setUsers(resolvedUsers);

      if (clientsResult.status === "fulfilled" && clientsResult.value) {
        setClients(clientsResult.value.clients || clientsResult.value || []);
      }

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
      console.error("Failed to fetch users or clients:", err);
      setToast({ message: "Failed to load permissions and project data.", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Extract flat list of projects
  const allProjects = useMemo(() => {
    return (clients || []).flatMap((c) =>
      (c.projects || []).map((p) => ({
        id: p.id,
        name: p.name,
        project_code: p.project_code,
        client_name: c.name,
      }))
    );
  }, [clients]);

  // Compute PMO limit: Super Admin can add up to 3 PMOs as Admin; Users ('n') are unlimited
  const isAdminLimitReached = adminCountInfo.active_admin_count >= 3;

  const currentUsers = useMemo(() => users.filter((u) => u.is_active), [users]);
  const oldUsers = useMemo(() => users.filter((u) => !u.is_active), [users]);
  const displayedUsers = userFilter === "current" ? currentUsers : oldUsers;

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

    // Enforce 3-Admin limit on granting Admin access
    if (role.trim().toLowerCase() === "admin" && !isAlreadyActiveAdmin && currentAdmins >= 3) {
      setToast({
        message:
          "Maximum of 3 PMO Admins reached. Select 'User' role or revoke access from an existing Admin first.",
        type: "danger",
      });
      return;
    }

    setGranting(true);
    try {
      await authApi.grantUserAccess({
        email: trimmedEmail,
        role,
        project_ids: selectedProjectIds,
      });
      setToast({ message: `Access successfully granted to ${trimmedEmail} (${role})!`, type: "success" });
      setEmail("");
      setRole("User");
      setSelectedProjectIds([]);
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
          "Maximum of 3 PMO Admins reached. Revoke access from an existing Admin before reactivating another Admin.",
        type: "danger",
      });
      return;
    }

    const nextActive = !currentActive;

    // Optimistic update
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === userId ? { ...u, is_active: nextActive } : u))
    );

    try {
      await authApi.updateUserRole(userId, userRole, nextActive);
      setToast({
        message: nextActive ? "User access activated." : "User access suspended/revoked.",
        type: "success",
      });
      await fetchUsers();
    } catch (err) {
      console.error("Failed to toggle status:", err);
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === userId ? { ...u, is_active: currentActive } : u))
      );
      setToast({
        message: err.response?.data?.detail || "Failed to update access status.",
        type: "danger",
      });
    }
  };

  const openEditProjectsModal = (u) => {
    setEditingProjectsUser(u);
    const existingIds = (u.assigned_projects || []).map((p) => p.id) || (u.assigned_project_ids || []);
    setEditModalProjectIds(existingIds);
  };

  const handleSaveUserProjects = async () => {
    if (!editingProjectsUser) return;
    setSavingProjects(true);
    try {
      await authApi.assignUserProjects(editingProjectsUser.id, editModalProjectIds);
      setToast({
        message: `Projects updated for ${editingProjectsUser.email}!`,
        type: "success",
      });
      setEditingProjectsUser(null);
      await fetchUsers();
    } catch (err) {
      console.error("Failed to assign projects:", err);
      setToast({
        message: err.response?.data?.detail || "Failed to update project assignments.",
        type: "danger",
      });
    } finally {
      setSavingProjects(false);
    }
  };

  return (
    <div style={{ padding: "28px", maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>
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
            Super Admin can add up to 3 PMOs as Admin, and PMO Users can be unlimited. Assign projects directly to members upon invitation.
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
            PMO Admins: <span style={{ color: adminCountInfo.active_admin_count >= 3 ? "#f87171" : "#60a5fa" }}>{adminCountInfo.active_admin_count}</span> / 3
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
              Admins Full
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
              {3 - adminCountInfo.active_admin_count} Admin slot{3 - adminCountInfo.active_admin_count !== 1 ? "s" : ""} open
            </span>
          )}
        </div>
      </div>

      {/* Grant Access Card */}
      <div
        className="glass-panel"
        style={{
          borderRadius: "var(--radius-lg, 12px)",
          padding: "26px 28px",
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)",
          border: "1px solid rgba(96, 165, 250, 0.22)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
              Grant Access to PMO Member
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
              Invite a user or admin to CSAT and select their responsible project assignments.
            </p>
          </div>
        </div>

        <form onSubmit={handleGrantAccess} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: "260px" }}>
              <Input
                id="userEmailInput"
                label="PMO Email *"
                type="email"
                placeholder="colleague@clouddestinations.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={granting}
                required
              />
            </div>

            <div style={{ flex: 1, minWidth: "220px" }}>
              <Select
                id="userRoleSelect"
                label="Role Assignment *"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={granting}
                options={[
                  { value: "User", label: "User (PMO - Unlimited)" },
                  { value: "Admin", label: `Admin (PMO Lead - Max 3, ${adminCountInfo.active_admin_count}/3 used)` },
                ]}
              />
            </div>

            <div style={{ paddingBottom: "2px" }}>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={granting || !email.trim() || (role === "Admin" && isAdminLimitReached)}
              >
                {granting ? "Granting Access..." : "Grant Access"}
              </Button>
            </div>
          </div>

          {/* Project Assignment Section */}
          <div style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary, #cbd5e1)" }}>
                Assign Projects (Optional) — {selectedProjectIds.length} selected
              </label>
              {selectedProjectIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedProjectIds([])}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--primary-lt, #60a5fa)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                maxHeight: "140px",
                overflowY: "auto",
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--bg-elevated, #22334A)",
                border: "1px solid var(--border, #33465f)",
              }}
            >
              {allProjects.length === 0 ? (
                <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                  Loading available projects...
                </span>
              ) : (
                allProjects.map((p) => {
                  const isSelected = selectedProjectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProjectIds((prev) =>
                          isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        );
                      }}
                      style={{
                        padding: "5px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        border: `1px solid ${isSelected ? "rgba(59, 130, 246, 0.7)" : "var(--border, #33465f)"}`,
                        background: isSelected ? "rgba(37, 99, 235, 0.28)" : "transparent",
                        color: isSelected ? "#ffffff" : "var(--text-secondary, #94a3b8)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "10px" }}>{isSelected ? "✓" : "+"}</span>
                      <span>{p.client_name ? `${p.client_name} - ` : ""}{p.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </form>

        {/* Warning banner if Admin role selected while limit is reached */}
        {role === "Admin" && isAdminLimitReached && (
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
              <strong>Maximum of 3 PMO Admins reached.</strong> You can grant access as a <strong>User</strong> (unlimited) or revoke access from an existing Admin below.
            </span>
          </div>
        )}
      </div>

      {/* Authorized PMOs & Users Table */}
      <div
        className="glass-panel"
        style={{
          borderRadius: "var(--radius-lg, 12px)",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h4 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Authorized Users ({users.length})
            </h4>

            {/* User Filter Controls (Current Users vs Old Users) */}
            <div
              style={{
                display: "inline-flex",
                background: "var(--bg-elevated)",
                borderRadius: "8px",
                padding: "3px",
                border: "1px solid var(--border)",
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
                  background: userFilter === "current" ? "var(--primary-badge-bg)" : "transparent",
                  color: userFilter === "current" ? "var(--primary)" : "var(--text-muted)",
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
                    background: userFilter === "current" ? "var(--primary)" : "var(--border)",
                    color: userFilter === "current" ? "#ffffff" : "var(--text-secondary)",
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
                  background: userFilter === "old" ? "var(--badge-danger-bg)" : "transparent",
                  color: userFilter === "old" ? "var(--danger)" : "var(--text-muted)",
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
                    background: userFilter === "old" ? "var(--danger)" : "var(--border)",
                    color: userFilter === "old" ? "#ffffff" : "var(--text-secondary)",
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

          <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
            PMO Admins: <strong style={{ color: adminCountInfo.active_admin_count >= 3 ? "#f87171" : "#60a5fa" }}>{adminCountInfo.active_admin_count}/3</strong> • PMO Users: <strong style={{ color: "#ffffff" }}>{users.filter(u => (u.role || "").toLowerCase() === "user" && u.is_active).length}</strong>
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
                    background: "var(--bg-hover, rgba(10, 22, 40, 0.8))",
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
                  <th style={{ padding: "14px 20px", fontWeight: 700 }}>Assigned Projects</th>
                  <th style={{ padding: "14px 20px", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "14px 20px", fontWeight: 700, textAlign: "right", minWidth: "160px", whiteSpace: "nowrap" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((u) => {
                  const superAdmin = isSuperAdmin(u);

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.08))",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover, rgba(14, 30, 50, 0.45))")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 20px", color: "var(--primary-lt, #1d4ed8)", fontFamily: "monospace", fontWeight: 600 }}>
                        {u.email}
                      </td>

                      <td style={{ padding: "14px 20px", color: "var(--text-white, #ffffff)", fontWeight: 500 }}>
                        {u.full_name || "—"}
                      </td>

                      <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: "4px",
                            whiteSpace: "nowrap",
                            background: superAdmin
                              ? "rgba(168, 85, 247, 0.15)"
                              : (u.role || "").toLowerCase() === "admin"
                              ? "rgba(245, 158, 11, 0.15)"
                              : "rgba(59, 130, 246, 0.15)",
                            color: superAdmin
                              ? "#c084fc"
                              : (u.role || "").toLowerCase() === "admin"
                              ? "#f59e0b"
                              : "#60a5fa",
                            border: `1px solid ${
                              superAdmin
                                ? "rgba(168, 85, 247, 0.35)"
                                : (u.role || "").toLowerCase() === "admin"
                                ? "rgba(245, 158, 11, 0.35)"
                                : "rgba(59, 130, 246, 0.3)"
                            }`,
                            letterSpacing: "0.3px",
                          }}
                        >
                          {superAdmin ? "Super Admin" : u.role || "User"}
                        </span>
                      </td>

                      {/* Assigned Projects */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", maxWidth: "320px" }}>
                          {u.assigned_projects && u.assigned_projects.length > 0 ? (
                            u.assigned_projects.map((p) => (
                              <span
                                key={p.id}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  background: "rgba(37, 99, 235, 0.15)",
                                  border: "1px solid rgba(59, 130, 246, 0.35)",
                                  color: "var(--primary-lt, #60a5fa)",
                                  whiteSpace: "nowrap",
                                }}
                                title={p.name}
                              >
                                {p.name}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", fontStyle: "italic" }}>
                              No projects
                            </span>
                          )}
                          {!superAdmin && (
                            <button
                              type="button"
                              onClick={() => openEditProjectsModal(u)}
                              style={{
                                background: "transparent",
                                border: "1px dashed var(--border-strong, rgba(96, 165, 250, 0.4))",
                                color: "var(--text-muted, #94a3b8)",
                                fontSize: "11px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                              }}
                              title="Assign or edit projects for this user"
                            >
                              {u.assigned_projects && u.assigned_projects.length > 0 ? "Edit" : "+ Assign"}
                            </button>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "4px",
                            whiteSpace: "nowrap",
                            background: u.is_active ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: u.is_active ? "#22c55e" : "#ef4444",
                            border: `1px solid ${u.is_active ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          }}
                        >
                          {u.is_active ? "● Authorized" : "✕ Suspended"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 20px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {superAdmin ? (
                          <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", fontStyle: "italic" }}>
                            Permanent Super Admin
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u.id, u.is_active, u.role)}
                            disabled={!u.is_active && (u.role || "").trim().toLowerCase() === "admin" && isAdminLimitReached}
                            title={!u.is_active && (u.role || "").trim().toLowerCase() === "admin" && isAdminLimitReached ? "3-Admin limit reached. Revoke another Admin first." : undefined}
                            style={{
                              background: u.is_active ? "rgba(239, 68, 68, 0.08)" : "rgba(34, 197, 94, 0.08)",
                              border: `1px solid ${u.is_active ? "rgba(248, 113, 113, 0.35)" : "rgba(74, 222, 128, 0.35)"}`,
                              color: u.is_active ? "#f87171" : "#4ade80",
                              opacity: !u.is_active && (u.role || "").trim().toLowerCase() === "admin" && isAdminLimitReached ? 0.5 : 1,
                              padding: "0 12px",
                              height: "32px",
                              minWidth: "120px",
                              whiteSpace: "nowrap",
                              boxSizing: "border-box",
                              lineHeight: "1",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "6px",
                              fontSize: "12px",
                              cursor: !u.is_active && (u.role || "").trim().toLowerCase() === "admin" && isAdminLimitReached ? "not-allowed" : "pointer",
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

      {/* Reassign Projects Modal */}
      {editingProjectsUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingProjectsUser(null);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface, #0d1b2a)",
              border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.35))",
              borderRadius: "14px",
              padding: "24px 28px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                  Assign Projects to User
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                  {editingProjectsUser.full_name || editingProjectsUser.email} ({editingProjectsUser.role})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProjectsUser(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted, #94a3b8)",
                  fontSize: "20px",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "var(--text-secondary, #cbd5e1)", marginBottom: "14px", lineHeight: 1.5 }}>
              Check the projects this team member is responsible for managing:
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "260px",
                overflowY: "auto",
                padding: "8px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                marginBottom: "20px",
              }}
            >
              {allProjects.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "12px" }}>
                  No projects available.
                </div>
              ) : (
                allProjects.map((p) => {
                  const checked = editModalProjectIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        background: checked ? "rgba(37, 99, 235, 0.18)" : "transparent",
                        border: `1px solid ${checked ? "rgba(59, 130, 246, 0.35)" : "transparent"}`,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setEditModalProjectIds((prev) =>
                            checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          );
                        }}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>
                          {p.client_name} {p.project_code ? `(${p.project_code})` : ""}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", alignItems: "center" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingProjectsUser(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={savingProjects}
                onClick={handleSaveUserProjects}
              >
                Save Project Assignments
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
