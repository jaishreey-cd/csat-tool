import { useState, useEffect } from "react";
import clientsApi from "../api/clientsApi";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";

export default function ClientsProjectsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  // Modals state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ id: null, client_code: "", name: "" });

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    id: null,
    client_id: null,
    project_code: "",
    name: "",
    team_name: "",
    status: "Active",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await clientsApi.getClients({ search, includeArchived, forceRefresh: true });
      setClients(res.clients || []);
    } catch (err) {
      setToast({ message: "Failed to load clients and projects.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, includeArchived]);

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!clientForm.client_code || !clientForm.name) {
      setToast({ message: "Client code and name are required.", type: "error" });
      return;
    }
    try {
      if (clientForm.id) {
        await clientsApi.updateClient(clientForm.id, {
          client_code: clientForm.client_code,
          name: clientForm.name,
        });
        setToast({ message: "Client updated successfully.", type: "success" });
      } else {
        await clientsApi.createClient({
          client_code: clientForm.client_code,
          name: clientForm.name,
        });
        setToast({ message: "Client created successfully.", type: "success" });
      }
      setIsClientModalOpen(false);
      loadData();
    } catch (err) {
      setToast({ message: err.response?.data?.detail || "Failed to save client.", type: "error" });
    }
  };

  const handleArchiveClient = async (client) => {
    if (!window.confirm(`Are you sure you want to archive client ${client.name}?`)) return;
    try {
      await clientsApi.archiveClient(client.id);
      setToast({ message: `Client ${client.name} archived.`, type: "success" });
      loadData();
    } catch (err) {
      setToast({ message: err.response?.data?.detail || "Failed to archive client.", type: "error" });
    }
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!projectForm.project_code || !projectForm.name || !projectForm.client_id) {
      setToast({ message: "Project code and name are required.", type: "error" });
      return;
    }
    try {
      if (projectForm.id) {
        await clientsApi.updateProject(projectForm.id, {
          project_code: projectForm.project_code,
          name: projectForm.name,
          team_name: projectForm.team_name,
          status: projectForm.status,
        });
        setToast({ message: "Project updated successfully.", type: "success" });
      } else {
        await clientsApi.createProject({
          client_id: projectForm.client_id,
          project_code: projectForm.project_code,
          name: projectForm.name,
          team_name: projectForm.team_name,
          status: projectForm.status,
        });
        setToast({ message: "Project created successfully.", type: "success" });
      }
      setIsProjectModalOpen(false);
      loadData();
    } catch (err) {
      setToast({ message: err.response?.data?.detail || "Failed to save project.", type: "error" });
    }
  };

  const handleArchiveProject = async (proj) => {
    if (!window.confirm(`Are you sure you want to archive project ${proj.name}?`)) return;
    try {
      await clientsApi.archiveProject(proj.id);
      setToast({ message: `Project ${proj.name} archived.`, type: "success" });
      loadData();
    } catch (err) {
      setToast({ message: err.response?.data?.detail || "Failed to archive project.", type: "error" });
    }
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
            Clients & Projects Management
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>
            View and manage authorized clients, project allocations, and survey links across your enterprise portfolio.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setClientForm({ id: null, client_code: "", name: "" });
            setIsClientModalOpen(true);
          }}
        >
          + Add Client
        </Button>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "center",
          marginBottom: "24px",
          background: "var(--bg-surface, #0d1b2a)",
          padding: "14px 20px",
          borderRadius: "10px",
          border: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
        }}
      >
        <input
          type="text"
          placeholder="Search by client or project name / code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 14px",
            borderRadius: "6px",
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.2))",
            color: "var(--text-main, #e2e8f0)",
            fontSize: "13px",
          }}
        />

        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-muted, #94a3b8)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include Archived
        </label>
      </div>

      {/* Clients & Projects Accordion/List */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center" }}><Spinner size="lg" /></div>
      ) : clients.length === 0 ? (
        <div style={{ padding: "50px", textAlign: "center", background: "var(--bg-surface, #0d1b2a)", borderRadius: "12px", border: "1px solid var(--border, rgba(96, 165, 250, 0.1))" }}>
          <p style={{ color: "var(--text-muted, #94a3b8)", margin: 0 }}>No clients or projects matched your search.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {clients.map((c) => (
            <div
              key={c.id}
              style={{
                background: "var(--bg-surface, #0d1b2a)",
                borderRadius: "12px",
                border: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
                overflow: "hidden",
              }}
            >
              {/* Client Header */}
              <div
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(15, 23, 42, 0.5)",
                  borderBottom: c.projects?.length > 0 ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#60a5fa",
                      background: "rgba(37, 99, 235, 0.15)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      border: "1px solid rgba(59, 130, 246, 0.25)",
                    }}
                  >
                    {c.client_code}
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-white, #ffffff)" }}>
                    {c.name}
                  </span>
                  <Badge variant={c.is_active ? "success" : "neutral"}>
                    {c.is_active ? "Active" : "Archived"}
                  </Badge>
                  <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                    ({c.projects?.length || 0} Projects)
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setProjectForm({
                        id: null,
                        client_id: c.id,
                        project_code: "",
                        name: "",
                        team_name: "",
                        status: "Active",
                      });
                      setIsProjectModalOpen(true);
                    }}
                  >
                    + Add Project
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setClientForm({ id: c.id, client_code: c.client_code, name: c.name });
                      setIsClientModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  {c.is_active && (
                    <button
                      type="button"
                      onClick={() => handleArchiveClient(c)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        background: "rgba(239, 68, 68, 0.12)",
                        color: "#f87171",
                        border: "1px solid rgba(239, 68, 68, 0.25)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>

              {/* Projects Table */}
              {c.projects?.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "var(--text-dim, #64748b)", background: "rgba(10, 18, 30, 0.4)" }}>
                        <th style={{ padding: "10px 20px" }}>Project Code</th>
                        <th style={{ padding: "10px 14px" }}>Project Name</th>
                        <th style={{ padding: "10px 14px" }}>Assigned Team</th>
                        <th style={{ padding: "10px 14px" }}>Status</th>
                        <th style={{ padding: "10px 14px" }}>Survey Status</th>
                        <th style={{ padding: "10px 20px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.projects.map((p) => (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                            color: "var(--text-main, #e2e8f0)",
                          }}
                        >
                          <td style={{ padding: "12px 20px", fontWeight: 700, color: "#93c5fd" }}>
                            {p.project_code}
                          </td>
                          <td style={{ padding: "12px 14px", fontWeight: 600 }}>{p.name}</td>
                          <td style={{ padding: "12px 14px", color: "var(--text-muted, #94a3b8)" }}>
                            {p.team_name || "—"}
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <Badge variant={p.is_active ? "info" : "neutral"}>
                              {p.status || (p.is_active ? "Active" : "Archived")}
                            </Badge>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <Badge
                              variant={
                                p.survey_status === "Completed"
                                  ? "success"
                                  : p.survey_status === "Sent"
                                  ? "info"
                                  : "neutral"
                              }
                            >
                              {p.survey_status}
                            </Badge>
                          </td>
                          <td style={{ padding: "12px 20px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "8px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setProjectForm({
                                    id: p.id,
                                    client_id: c.id,
                                    project_code: p.project_code,
                                    name: p.name,
                                    team_name: p.team_name || "",
                                    status: p.status || "Active",
                                  });
                                  setIsProjectModalOpen(true);
                                }}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#60a5fa",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                Edit
                              </button>
                              {p.is_active && (
                                <button
                                  type="button"
                                  onClick={() => handleArchiveProject(p)}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#f87171",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  Archive
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: "16px 20px", fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
                  No projects under this client. Click "+ Add Project" to allocate one.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Client Modal */}
      {isClientModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(96, 165, 250, 0.2)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "460px",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff", margin: "0 0 16px 0" }}>
              {clientForm.id ? "Edit Client" : "Add New Client"}
            </h3>
            <form onSubmit={handleSaveClient}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Client Code (e.g. ACME)
                </label>
                <input
                  type="text"
                  value={clientForm.client_code}
                  onChange={(e) => setClientForm({ ...clientForm, client_code: e.target.value.toUpperCase() })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "#1e293b", border: "1px solid #334155", color: "#ffffff" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Client Name
                </label>
                <input
                  type="text"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "#1e293b", border: "1px solid #334155", color: "#ffffff" }}
                  required
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button variant="secondary" onClick={() => setIsClientModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Client
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {isProjectModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(96, 165, 250, 0.2)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff", margin: "0 0 16px 0" }}>
              {projectForm.id ? "Edit Project" : "Add Project"}
            </h3>
            <form onSubmit={handleSaveProject}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Project Code (e.g. PRJ-001)
                </label>
                <input
                  type="text"
                  value={projectForm.project_code}
                  onChange={(e) => setProjectForm({ ...projectForm, project_code: e.target.value.toUpperCase() })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "#1e293b", border: "1px solid #334155", color: "#ffffff" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "#1e293b", border: "1px solid #334155", color: "#ffffff" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Team Name
                </label>
                <input
                  type="text"
                  value={projectForm.team_name}
                  onChange={(e) => setProjectForm({ ...projectForm, team_name: e.target.value })}
                  placeholder="e.g. Core Engineering"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "#1e293b", border: "1px solid #334155", color: "#ffffff" }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Status
                </label>
                <select
                  value={projectForm.status}
                  onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "#1e293b", border: "1px solid #334155", color: "#ffffff" }}
                >
                  <option value="Active">Active</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button variant="secondary" onClick={() => setIsProjectModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Project
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "info" })}
        />
      )}
    </div>
  );
}
