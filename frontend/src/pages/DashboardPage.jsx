import { useState, useEffect, useCallback } from "react";
import ClientProjectList from "../components/ClientProjectList";
import Button from "../components/Button";
import clientsApi from "../api/clientsApi";
import analyticsApi from "../api/analyticsApi";

export default function DashboardPage() {
  const initialCached = clientsApi.getCachedClients({ search: "", includeArchived: false });
  const [clients, setClients] = useState(() => initialCached?.clients || []);
  const [totalClients, setTotalClients] = useState(() => initialCached?.total_clients || 0);
  const [totalProjects, setTotalProjects] = useState(() => initialCached?.total_projects || 0);
  const [overview, setOverview] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [loading, setLoading] = useState(() => !initialCached);
  const [error, setError] = useState("");
  const [exportingFormat, setExportingFormat] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    analyticsApi.getSystemOverview()
      .then((res) => setOverview(res))
      .catch(() => {});
  }, []);

  const handleExportPortfolio = async (format) => {
    setExportingFormat(format);
    setShowExportMenu(false);
    try {
      await analyticsApi.exportOverview(format);
    } catch (err) {
      console.error("Failed to export portfolio overview:", err);
      alert("Failed to export portfolio overview.");
    } finally {
      setExportingFormat(null);
    }
  };

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

        {/* Export Portfolio Dropdown */}
        <div style={{ position: "relative" }}>
          <Button
            variant="secondary"
            size="md"
            disabled={!!exportingFormat}
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span>{exportingFormat ? "⏳" : "📥"}</span>
            <span>{exportingFormat ? `Exporting...` : "Export Portfolio ▾"}</span>
          </Button>

          {showExportMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                background: "var(--bg-surface, #0d1b2a)",
                border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.3))",
                borderRadius: "8px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                padding: "6px",
                zIndex: 50,
                minWidth: "170px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => handleExportPortfolio("xlsx")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  color: "var(--text-white, #ffffff)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(96, 165, 250, 0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ color: "#22c55e", fontWeight: 700 }}>📊</span>
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportPortfolio("csv")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  color: "var(--text-white, #ffffff)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(96, 165, 250, 0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>📄</span>
                <span>CSV (.csv)</span>
              </button>
            </div>
          )}
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
        {/* Overall CSAT Card */}
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
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              color: "#fbbf24",
            }}
          >
            ★
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Overall CSAT
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", lineHeight: 1.2, marginTop: "2px" }}>
              {overview?.overall_csat && overview.overall_csat > 0 ? (
                <>
                  {overview.overall_csat.toFixed(1)}
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-dim, #64748b)" }}> / 5.0</span>
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
        </div>

        {/* Response Rate Card */}
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
            📈
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Response Rate
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", lineHeight: 1.2, marginTop: "2px" }}>
              {overview?.response_rate !== undefined ? `${overview.response_rate}%` : "0%"}
            </div>
          </div>
        </div>

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
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Active Projects
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", lineHeight: 1.2, marginTop: "2px" }}>
              {totalProjects}
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
            placeholder="Search by client or project name..."
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

        {/* Right Controls: Archived Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
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

      {/* ── Client & Project Directory ─────────────────────────────────── */}
      <ClientProjectList
        clients={clients}
        loading={loading}
        error={error}
        searchQuery={debouncedSearch}
        onRetry={() => fetchClients(debouncedSearch, showArchived)}
      />
    </div>
  );
}
