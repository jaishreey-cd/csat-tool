import { useState, useEffect, useCallback } from "react";
import Badge from "../components/Badge";
import ClientProjectList from "../components/ClientProjectList";
import clientsApi from "../api/clientsApi";

export default function DashboardPage() {
  const initialCached = clientsApi.getCachedClients({ search: "", includeArchived: false });
  const [clients, setClients] = useState(() => initialCached?.clients || []);
  const [totalClients, setTotalClients] = useState(() => initialCached?.total_clients || 0);
  const [totalProjects, setTotalProjects] = useState(() => initialCached?.total_projects || 0);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  const [loading, setLoading] = useState(() => !initialCached);
  const [error, setError] = useState("");

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch clients from API with stale-while-revalidate pattern
  const fetchClients = useCallback(async (search = "", includeArchived = false, force = false) => {
    // If cached data exists for this exact query and not forced, display immediately
    const cached = clientsApi.getCachedClients({ search, includeArchived });
    if (cached && !force) {
      setClients(cached.clients || []);
      setTotalClients(cached.total_clients || 0);
      setTotalProjects(cached.total_projects || 0);
      setLoading(false);
      return;
    }

    // Only show full loading spinner if we don't already have clients rendered
    if (!cached && clients.length === 0) {
      setLoading(true);
    }
    setError("");
    try {
      const data = await clientsApi.getClients({
        search,
        includeArchived,
        forceRefresh: force,
      });
      setClients(data.clients || []);
      setTotalClients(data.total_clients || 0);
      setTotalProjects(data.total_projects || 0);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load clients and projects.");
    } finally {
      setLoading(false);
    }
  }, [clients.length]);

  useEffect(() => {
    fetchClients(debouncedSearch, showArchived);
  }, [fetchClients, debouncedSearch, showArchived]);

  // Average projects per client
  const avgProjects = totalClients > 0 ? (totalProjects / totalClients).toFixed(1) : "0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px" }}>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--text-white, #ffffff)",
              margin: 0,
              letterSpacing: "-0.3px",
            }}
          >
            Clients & Projects
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-muted, #94a3b8)",
              margin: "4px 0 0 0",
            }}
          >
            Directory of active client accounts and associated project engagements
          </p>
        </div>
      </div>

      {/* ── Key Metrics Cards ───────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Total Clients Card */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "var(--radius-md, 9px)",
              background: "rgba(37, 99, 235, 0.15)",
              border: "1px solid rgba(96, 165, 250, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              color: "var(--primary-lt, #60a5fa)",
            }}
          >
            🏢
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Total Clients
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", lineHeight: 1.2, marginTop: "2px" }}>
              {totalClients}
            </div>
          </div>
        </div>

        {/* Total Projects Card */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "var(--radius-md, 9px)",
              background: "rgba(6, 182, 212, 0.15)",
              border: "1px solid rgba(6, 182, 212, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              color: "var(--accent, #06b6d4)",
            }}
          >
            📁
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Active Projects
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", lineHeight: 1.2, marginTop: "2px" }}>
              {totalProjects}
            </div>
          </div>
        </div>

        {/* Avg Projects per Client Card */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "var(--radius-md, 9px)",
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              color: "var(--success, #22c55e)",
            }}
          >
            📊
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Avg. Projects / Client
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", lineHeight: 1.2, marginTop: "2px" }}>
              {avgProjects}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
          background: "var(--bg-surface, #0d1b2a)",
          padding: "14px 18px",
          borderRadius: "var(--radius-lg, 12px)",
          border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
        }}
      >
        {/* Search Input */}
        <div style={{ position: "relative", flex: 1, minWidth: "260px", maxWidth: "480px" }}>
          <input
            type="text"
            placeholder="Search by client or project name / code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              height: "40px",
              padding: "0 34px 0 38px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
              borderRadius: "var(--radius-md, 9px)",
              color: "var(--text-main, #e2e8f0)",
              fontSize: "13px",
              outline: "none",
              transition: "border-color 0.15s ease",
            }}
          />
          {/* Search Icon */}
          <span
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-dim, #64748b)",
              fontSize: "15px",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>

          {/* Clear button */}
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                fontSize: "14px",
                padding: "4px",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Right Controls: View Switcher & Archived Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          {/* View Switcher */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.04)",
              borderRadius: "var(--radius-sm, 6px)",
              padding: "2px",
              border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 500,
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                background: viewMode === "grid" ? "var(--primary, #2563eb)" : "transparent",
                color: viewMode === "grid" ? "#ffffff" : "var(--text-muted, #94a3b8)",
                transition: "all 0.15s ease",
              }}
            >
              ▦ Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 500,
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                background: viewMode === "table" ? "var(--primary, #2563eb)" : "transparent",
                color: viewMode === "table" ? "#ffffff" : "var(--text-muted, #94a3b8)",
                transition: "all 0.15s ease",
              }}
            >
              ☰ Directory
            </button>
          </div>

          {/* Archived Toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "var(--text-muted, #94a3b8)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              style={{
                accentColor: "var(--primary, #2563eb)",
                cursor: "pointer",
                width: "16px",
                height: "16px",
              }}
            />
            <span>Show archived</span>
          </label>
        </div>
      </div>

      {/* ── Client & Project Listing ─────────────────────────────────── */}
      <ClientProjectList
        clients={clients}
        loading={loading}
        error={error}
        viewMode={viewMode}
        searchQuery={debouncedSearch}
        onRetry={() => fetchClients(debouncedSearch, showArchived)}
      />
    </div>
  );
}
