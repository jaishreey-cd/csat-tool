import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import authApi from "../api/authApi";
import clientsApi from "../api/clientsApi";
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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("User");
  const [granting, setGranting] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  // Project Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

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

  // Compute PMO limit metrics
  const grantedPmoUsers = users.filter((u) => u.email.toLowerCase() !== INITIAL_ADMIN_EMAIL);
  const activePmoCount = grantedPmoUsers.filter((u) => u.is_active).length;
  const isLimitReached = activePmoCount >= MAX_PMO_LIMIT;

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

    try {
      await authApi.updateUserRole(userId, userRole, !currentActive);
      setToast({
        message: !currentActive ? "PMO access activated." : "PMO access suspended.",
        type: "success",
      });
      fetchUsers();
    } catch (err) {
      console.error("Failed to toggle status:", err);
      setToast({ message: err.response?.data?.detail || "Failed to update access status.", type: "danger" });
    }
  };

  const openAssignModal = async (targetUser) => {
    try {
      setSelectedUser(targetUser);
      // Fetch user's existing assignments
      const assignRes = await authApi.getAssignments(targetUser.id);
      setSelectedProjectIds(assignRes.project_ids || []);

      // Fetch all clients & projects
      const clientsRes = await clientsApi.getClients({ includeArchived: false, forceRefresh: true });
      const projectsList = [];
      (clientsRes.clients || []).forEach((c) => {
        (c.projects || []).forEach((p) => {
          projectsList.push({
            id: p.id,
            project_code: p.project_code,
            name: p.name,
            client_name: c.name,
          });
        });
      });
      setAllProjects(projectsList);
      setIsAssignModalOpen(true);
    } catch (err) {
      console.error("Failed to load project assignments:", err);
      setToast({ message: "Failed to open project assignments.", type: "danger" });
    }
  };

  const handleSaveAssignments = async () => {
    if (!selectedUser) return;
    try {
      setSavingAssignments(true);
      await authApi.setAssignments(selectedUser.id, selectedProjectIds);
      setToast({
        message: `Updated project allocations for ${selectedUser.email}.`,
        type: "success",
      });
      setIsAssignModalOpen(false);
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || "Failed to save project allocations.",
        type: "danger",
      });
    } finally {
      setSavingAssignments(false);
    }
  };

  const toggleProjectSelection = (pid) => {
    setSelectedProjectIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
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

      {/* Header Banner */}
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
          User Permissions & PMO Access Control
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>
          Authorize PMO teammates (maximum 3 in addition to the initial Administrator) and allocate project-level access.
        </p>
      </div>

      {/* Capacity & Usage Summary Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={{ background: "var(--bg-card, rgba(14, 30, 50, 0.9))", border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))", borderRadius: "10px", padding: "16px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", fontWeight: 700, textTransform: "uppercase" }}>PMO Seats Allocated</div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: isLimitReached ? "#f87171" : "#60a5fa", marginTop: "4px" }}>
            {activePmoCount} <span style={{ fontSize: "16px", color: "var(--text-dim, #64748b)", fontWeight: 500 }}>/ {MAX_PMO_LIMIT} max</span>
          </div>
        </div>

        <div style={{ background: "var(--bg-card, rgba(14, 30, 50, 0.9))", border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))", borderRadius: "10px", padding: "16px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", fontWeight: 700, textTransform: "uppercase" }}>Available PMO Slots</div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: Math.max(0, MAX_PMO_LIMIT - activePmoCount) > 0 ? "#34d399" : "#f87171", marginTop: "4px" }}>
            {Math.max(0, MAX_PMO_LIMIT - activePmoCount)}
          </div>
        </div>

        <div style={{ background: "var(--bg-card, rgba(14, 30, 50, 0.9))", border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))", borderRadius: "10px", padding: "16px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", fontWeight: 700, textTransform: "uppercase" }}>Total System Users</div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-white, #ffffff)", marginTop: "4px" }}>
            {users.length}
          </div>
        </div>
      </div>

      {/* Grant Access Card */}
      <div
        style={{
          background: "var(--bg-card, rgba(14, 30, 50, 0.9))",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: "0 0 8px 0" }}>
          Grant Access to a PMO User
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", marginBottom: "18px" }}>
          Enter the colleague's email to authorize them. They will receive access to dispatch surveys and view results.
        </p>

        {isLimitReached && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.15)",
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
          background: "var(--bg-card, rgba(14, 30, 50, 0.9))",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
              System Users & PMO Permissions
            </h2>
            <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)" }}>
              Changes take effect immediately across all routes and API endpoints.
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchUsers} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}><Spinner size="lg" /></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr
                  style={{
                    background: "rgba(10, 20, 35, 0.6)",
                    borderBottom: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
                    color: "var(--text-muted, #94a3b8)",
                    textAlign: "left",
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
                {users.map((u) => {
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
                          <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                            {u.role !== "Admin" && (
                              <button
                                type="button"
                                onClick={() => openAssignModal(u)}
                                style={{
                                  background: "rgba(59, 130, 246, 0.15)",
                                  border: "1px solid rgba(59, 130, 246, 0.3)",
                                  color: "#93c5fd",
                                  padding: "4px 10px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Allocations
                              </button>
                            )}
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
                              {u.is_active ? "Suspend" : "Activate"}
                            </button>
                          </div>
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

      {/* Project Allocation Modal */}
      {isAssignModalOpen && selectedUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(96, 165, 250, 0.25)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "560px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff", margin: "0 0 6px 0" }}>
              Allocate Projects for {selectedUser.email}
            </h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px 0" }}>
              Select which projects this PMO user is authorized to view, create surveys for, and export results from.
            </p>

            <div style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "12px", marginBottom: "18px" }}>
              {allProjects.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>No active projects found in system.</div>
              ) : (
                allProjects.map((p) => {
                  const isChecked = selectedProjectIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: isChecked ? "rgba(37, 99, 235, 0.15)" : "transparent",
                        cursor: "pointer",
                        marginBottom: "4px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleProjectSelection(p.id)}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, color: "#93c5fd", marginRight: "8px" }}>{p.project_code}</span>
                        <span style={{ color: "#ffffff", fontSize: "13px" }}>{p.name}</span>
                        <span style={{ color: "#64748b", fontSize: "12px", marginLeft: "8px" }}>({p.client_name})</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                {selectedProjectIds.length} project(s) assigned
              </span>
              <div style={{ display: "flex", gap: "10px" }}>
                <Button variant="secondary" onClick={() => setIsAssignModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveAssignments} disabled={savingAssignments}>
                  {savingAssignments ? "Saving..." : "Save Allocations"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
