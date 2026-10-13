import { useState, useEffect, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { useAuth } from "../context/AuthContext";
import { dataApi, authApi } from "../api";
import styles from "./DashboardPage.module.css";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { instance } = useMsal();

  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [statsLoading, setStatsLoading] = useState(true);
  const [terminalOutput, setTerminalOutput] = useState("// PMO Admin console ready. Live Neon PostgreSQL connected.");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStats = useCallback(async () => {
    try {
      const s = await dataApi.getStats();
      setStats(s);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async (q = "") => {
    try {
      const data = await dataApi.getProjects(q, 0, 80);
      setProjects(Array.isArray(data) ? data : data.projects || []);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchProjects();
  }, [fetchStats, fetchProjects]);

  useEffect(() => {
    const t = setTimeout(() => fetchProjects(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchProjects]);

  const handleLogout = () => {
    logout();
    try {
      instance.logoutSilent();
    } catch {
      /* silent */
    }
  };

  const runApiTest = async (label, fn) => {
    setActionLoading(true);
    setTerminalOutput(`// Executing: ${label}...`);
    try {
      const res = await fn();
      setTerminalOutput(JSON.stringify(res, null, 2));
      showToast(`${label} completed successfully ✓`, "success");
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Execution error";
      setTerminalOutput(`// Error: ${msg}`);
      showToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReimport = async () => {
    showToast("Re-importing Utiliza dataset...", "info");
    try {
      const res = await dataApi.reimport();
      showToast(`Dataset synchronized: ${res.projects_created ?? 0} projects registered`, "success");
      fetchStats();
      fetchProjects(search);
    } catch (err) {
      showToast(err?.response?.data?.detail || "Re-import failed", "error");
    }
  };

  const avatarChar = (user?.full_name || user?.username || "A")[0].toUpperCase();

  return (
    <div className={styles.page}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/image.png" alt="Utiliza" style={{ width: 28, height: 28, objectFit: "contain" }} />
          <div className={styles.brandInfo}>
            <span className={styles.brandTitle}>PMO Tool · CSAT Survey System</span>
            <span className={styles.brandSub}>Connected to Utiliza & Neon PostgreSQL</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.statusPill}>
            <span className={styles.statusDot} />
            <span>Database Live</span>
          </div>

          <div className={styles.profilePill}>
            <div className={styles.avatar}>{avatarChar}</div>
            <span className={styles.userName}>{user?.full_name || user?.username}</span>
            <span className={styles.adminBadge}>Admin</span>
          </div>

          <button id="logoutBtn" className={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* KPI Stats Grid */}
        <section className={styles.statsGrid}>
          <StatCard
            label="Total Clients"
            value={statsLoading ? "…" : stats?.total_clients ?? "--"}
            sub="Imported from Utiliza"
          />
          <StatCard
            label="Total Projects"
            value={statsLoading ? "…" : stats?.total_projects ?? "--"}
            sub="Registered in Neon PostgreSQL"
          />
          <StatCard
            label="In Progress"
            value={statsLoading ? "…" : stats?.in_progress_projects ?? "--"}
            sub="Active Engagements"
            color="#60a5fa"
          />
          <StatCard
            label="Completed"
            value={statsLoading ? "…" : stats?.completed_projects ?? "--"}
            sub="Ready for CSAT Survey"
            color="#34d399"
          />
        </section>

        {/* Projects Table Panel */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>
              📁 Projects & CSAT Engagement Pipeline
            </h2>
            <div className={styles.panelActions}>
              <input
                id="projectSearchInput"
                type="text"
                placeholder="Search project, client, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
              <button
                id="btnReimportCsv"
                className={styles.primaryBtn}
                onClick={handleReimport}
              >
                🔄 Re-sync Utiliza Data
              </button>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Project Manager</th>
                  <th>Resources</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                      No matching projects found.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id || p.project_id}>
                      <td>
                        <span className={styles.codeCell}>{p.project_id}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: "#ffffff" }}>{p.project_name}</td>
                      <td>{p.client_name || "—"}</td>
                      <td>
                        <span className={`${styles.statusPillTable} ${getStatusClass(p.status, styles)}`}>
                          {p.status || "—"}
                        </span>
                      </td>
                      <td>{p.project_manager_name || "—"}</td>
                      <td>{p.resource_count ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Admin Tools Panel */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>
              ⚙️ PMO Administrative Controls & Live API Inspector
            </h2>
          </div>

          <div className={styles.adminToolsGrid}>
            <div className={styles.toolBox}>
              <div className={styles.toolTitle}>Active Session Details</div>
              <div className={styles.toolDesc}>
                All authenticated users have full PMO Admin privileges. You can verify your live JWT and permissions below.
              </div>
              <div className={styles.toolBtnRow}>
                <button
                  id="btnTestMeRoute"
                  className={styles.actionBtn}
                  onClick={() => runApiTest("Inspect Profile (GET /api/auth/me)", authApi.getMe)}
                  disabled={actionLoading}
                >
                  Verify JWT Profile
                </button>
                <button
                  id="btnTestAdminRoute"
                  className={styles.actionBtn}
                  onClick={() => runApiTest("Test Admin Route (GET /api/auth/admin-only)", authApi.testAdminRoute)}
                  disabled={actionLoading}
                >
                  Test Admin Route
                </button>
              </div>
            </div>

            <div className={styles.toolBox}>
              <div className={styles.toolTitle}>Live Terminal Output</div>
              <pre className={styles.terminal}>{terminalOutput}</pre>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Toast */}
      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} style={color ? { color } : {}}>
        {value}
      </span>
      <span className={styles.statSub}>{sub}</span>
    </div>
  );
}

function getStatusClass(status, styles) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s.includes("progress")) return styles.statusProgress;
  if (s.includes("complete") || s.includes("done")) return styles.statusDone;
  if (s.includes("hold")) return styles.statusHold;
  return "";
}
