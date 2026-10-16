import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import analyticsApi from "../api/analyticsApi";

export default function ProjectAnalyticsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("phases"); // 'phases' | 'overview' | 'feedback' | 'timeline'
  const [commentSearch, setCommentSearch] = useState("");
  const [exportingFormat, setExportingFormat] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = async (format) => {
    setExportingFormat(format);
    setShowExportMenu(false);
    try {
      await analyticsApi.exportProjectAnalytics(projectId, format);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to download export report. Please try again.");
    } finally {
      setExportingFormat(null);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await analyticsApi.getProjectAnalytics(projectId);
      setData(res);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load project analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchAnalytics();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "360px", gap: "16px" }}>
        <Spinner size="lg" />
        <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "14px" }}>Loading project analytics...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchAnalytics} />;
  }

  if (!data) {
    return (
      <EmptyState
        title="Project Not Found"
        description="The requested project analytics could not be located."
        icon="📁"
      />
    );
  }

  // Render Stars helper
  const renderStars = (score) => {
    const rounded = Math.round(score || 0);
    return (
      <div style={{ display: "inline-flex", gap: "2px", color: "#fbbf24", fontSize: "16px" }} aria-label={`${score} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ opacity: i <= rounded ? 1 : 0.25 }}>
            ★
          </span>
        ))}
      </div>
    );
  };

  // Score color helper
  const getScoreColor = (score) => {
    if (score === null || score === undefined) return "var(--text-muted, #94a3b8)";
    if (score >= 4.0) return "var(--success, #22c55e)";
    if (score >= 3.0) return "var(--warning, #f59e0b)";
    return "var(--danger, #ef4444)";
  };

  // Filter qualitative comments
  const filteredComments = (data.qualitative_comments || []).filter((c) => {
    if (!commentSearch.trim()) return true;
    const q = commentSearch.toLowerCase();
    return (
      c.text_answer?.toLowerCase().includes(q) ||
      c.question_text?.toLowerCase().includes(q) ||
      c.client_contact_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px" }}>
      {/* ── Back Navigation & Action Bar ────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "transparent",
            border: "none",
            color: "var(--primary-lt, #60a5fa)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <span>←</span>
          <span>Back to Dashboard</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
          {/* Export Report Dropdown */}
          <div style={{ position: "relative" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={!!exportingFormat}
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span>{exportingFormat ? "⏳" : "📥"}</span>
              <span>{exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : "Export Report ▾"}</span>
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
                  onClick={() => handleExport("xlsx")}
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
                  onClick={() => handleExport("csv")}
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

          <Link to={`/surveys/new?client=${data.client_id}&project=${data.project_id}`}>
            <Button variant="primary" size="sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span>＋</span>
              <span>Create Survey</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Project Header Card ────────────────────────────────────── */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "20px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <code
              style={{
                color: "var(--accent, #06b6d4)",
                fontSize: "12px",
                fontWeight: 600,
                background: "rgba(6, 182, 212, 0.12)",
                padding: "3px 8px",
                borderRadius: "5px",
                border: "1px solid rgba(6, 182, 212, 0.25)",
              }}
            >
              {data.project_code}
            </code>
            <Badge variant="active" size="sm">
              {data.status || "In Progress"}
            </Badge>
            {data.team_name && (
              <Badge variant="count" size="sm">
                Team: {data.team_name}
              </Badge>
            )}
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0, letterSpacing: "-0.3px" }}>
            {data.project_name}
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "var(--text-muted, #94a3b8)" }}>
            <span>Client:</span>
            <strong style={{ color: "var(--text-white, #ffffff)" }}>{data.client_name}</strong>
          </div>
        </div>

        {/* Big Overall CSAT Badge */}
        <div
          style={{
            background: "rgba(10, 22, 40, 0.8)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.2))",
            borderRadius: "12px",
            padding: "16px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            minWidth: "160px",
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-dim, #64748b)" }}>
            Overall CSAT
          </span>
          <div style={{ fontSize: "32px", fontWeight: 800, color: getScoreColor(data.overall_csat), lineHeight: 1.1 }}>
            {data.overall_csat !== null ? data.overall_csat.toFixed(1) : "—"}
            <span style={{ fontSize: "16px", fontWeight: 500, color: "var(--text-dim, #64748b)" }}> / 5.0</span>
          </div>
          {data.overall_csat_percentage !== undefined && data.overall_csat_percentage !== null && (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#34d399",
                background: "rgba(52, 211, 153, 0.15)",
                padding: "2px 8px",
                borderRadius: "4px",
                margin: "2px 0",
              }}
            >
              {data.overall_csat_percentage.toFixed(0)}% CSAT
            </div>
          )}
          {data.overall_csat !== null && renderStars(data.overall_csat)}
        </div>
      </div>

      {/* ── Key Metrics Cards ───────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Phase Lifecycle Card */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "rgba(59, 130, 246, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            🔄
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Survey Phases
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#60a5fa", marginTop: "2px" }}>
              {data.completed_phases_count || 0} / {data.total_phases || 5} Complete
            </div>
            <div style={{ fontSize: "11px", color: "#34d399", marginTop: "2px", fontWeight: 500 }}>
              Next: {data.next_phase || "Complete"}
            </div>
          </div>
        </div>

        {/* Total Surveys Card */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "rgba(37, 99, 235, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            📋
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Total Surveys
            </div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-white, #ffffff)", marginTop: "2px" }}>
              {data.total_surveys}
            </div>
          </div>
        </div>

        {/* Completed Responses Card */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "rgba(34, 197, 94, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            ✅
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Completed Responses
            </div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-white, #ffffff)", marginTop: "2px" }}>
              {data.completed_surveys}
            </div>
          </div>
        </div>

        {/* Response Rate Card */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "rgba(6, 182, 212, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            📈
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Response Rate
            </div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-white, #ffffff)", marginTop: "2px" }}>
              {data.response_rate}%
            </div>
          </div>
        </div>

        {/* Latest Evaluation Date Card */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "rgba(148, 163, 184, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            🕒
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Latest Evaluation
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-white, #ffffff)", marginTop: "4px" }}>
              {data.latest_response_date || "No responses yet"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
          paddingBottom: "2px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("phases")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "phases" ? "2px solid var(--primary-lt, #60a5fa)" : "2px solid transparent",
            color: activeTab === "phases" ? "#ffffff" : "var(--text-muted, #94a3b8)",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Phase-wise CSAT (%)</span>
          <span
            style={{
              background: "rgba(59, 130, 246, 0.2)",
              color: "#93c5fd",
              padding: "1px 7px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {data.phases?.length || 5} Phases
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "overview" ? "2px solid var(--primary-lt, #60a5fa)" : "2px solid transparent",
            color: activeTab === "overview" ? "#ffffff" : "var(--text-muted, #94a3b8)",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Section Breakdown
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("feedback")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "feedback" ? "2px solid var(--primary-lt, #60a5fa)" : "2px solid transparent",
            color: activeTab === "feedback" ? "#ffffff" : "var(--text-muted, #94a3b8)",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Client Comments</span>
          <span
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              padding: "1px 7px",
              borderRadius: "9999px",
              fontSize: "11px",
            }}
          >
            {data.qualitative_comments?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "timeline" ? "2px solid var(--primary-lt, #60a5fa)" : "2px solid transparent",
            color: activeTab === "timeline" ? "#ffffff" : "var(--text-muted, #94a3b8)",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Survey History</span>
          <span
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              padding: "1px 7px",
              borderRadius: "9999px",
              fontSize: "11px",
            }}
          >
            {data.timeline?.length || 0}
          </span>
        </button>
      </div>

      {/* ── TAB 0: PHASE-WISE CSAT PERCENTAGES ────────────────────────── */}
      {activeTab === "phases" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Phase Workflow Header */}
          <div
            style={{
              background: "var(--bg-surface, #0d1b2a)",
              border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
              borderRadius: "var(--radius-lg, 12px)",
              padding: "18px 22px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                Phase-wise CSAT Performance (% Analysis)
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                Evaluation scores converted to percentage satisfaction across all 5 project milestones.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)" }}>Current Status:</span>
              <Badge variant="info">
                {data.current_phase ? `Active in ${data.current_phase}` : "Ready"}
              </Badge>
            </div>
          </div>

          {/* Phase Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {(data.phases || [
              { phase: "Weekly", display_order: 1, average_score: null, percentage: null, total_responses: 0, status: "Pending" },
              { phase: "Monthly", display_order: 2, average_score: null, percentage: null, total_responses: 0, status: "Pending" },
              { phase: "Mid-Project", display_order: 3, average_score: null, percentage: null, total_responses: 0, status: "Pending" },
              { phase: "Project Completion", display_order: 4, average_score: null, percentage: null, total_responses: 0, status: "Pending" },
              { phase: "Post-Launch", display_order: 5, average_score: null, percentage: null, total_responses: 0, status: "Pending" },
            ]).map((ph) => {
              const hasScore = ph.percentage !== null && ph.percentage !== undefined;
              const pct = hasScore ? ph.percentage : 0;
              const isCurrent = data.current_phase === ph.phase;

              return (
                <div
                  key={ph.phase}
                  style={{
                    background: isCurrent ? "rgba(37, 99, 235, 0.12)" : "var(--bg-surface, #0d1b2a)",
                    border: `1.5px solid ${isCurrent ? "var(--primary-lt, #60a5fa)" : "var(--border, rgba(96, 165, 250, 0.15))"}`,
                    borderRadius: "12px",
                    padding: "20px 22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-lt, #60a5fa)", textTransform: "uppercase" }}>
                        Phase {ph.display_order} of 5
                      </span>
                      <h4 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: "2px 0 0 0" }}>
                        {ph.phase}
                      </h4>
                    </div>

                    <Badge variant={ph.status === "Completed" ? "active" : ph.status === "In Progress" ? "info" : "archived"}>
                      {ph.status}
                    </Badge>
                  </div>

                  {/* Percentage Score Metric */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "32px",
                        fontWeight: 800,
                        color: hasScore ? (pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#f87171") : "var(--text-dim, #64748b)",
                        lineHeight: 1,
                      }}
                    >
                      {hasScore ? `${pct.toFixed(0)}%` : "—"}
                    </span>
                    {hasScore && (
                      <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
                        ({ph.average_score?.toFixed(1)} / 5.0)
                      </span>
                    )}
                  </div>

                  {/* Visual Percentage Bar */}
                  <div
                    style={{
                      height: "8px",
                      background: "rgba(96, 165, 250, 0.12)",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: pct >= 80 ? "linear-gradient(90deg, #10b981, #34d399)" : pct >= 60 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "#ef4444",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>

                  {/* Responses count */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-dim, #64748b)", borderTop: "1px solid rgba(96, 165, 250, 0.08)", paddingTop: "8px" }}>
                    <span>Evaluations:</span>
                    <strong style={{ color: "var(--text-white, #ffffff)" }}>
                      {ph.total_responses} {ph.total_responses === 1 ? "response" : "responses"}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 1: SECTION-BY-SECTION BREAKDOWN ─────────────────────── */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {data.sections.map((sec) => {
            const totalInSec = sec.total_ratings || 0;

            return (
              <div
                key={sec.section_number}
                style={{
                  background: "var(--bg-surface, #0d1b2a)",
                  border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                  borderRadius: "var(--radius-lg, 12px)",
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "rgba(37, 99, 235, 0.15)",
                        border: "1px solid rgba(96, 165, 250, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--primary-lt, #60a5fa)",
                      }}
                    >
                      {sec.section_number}
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                        {sec.section_title}
                      </h3>
                      <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)" }}>
                        {totalInSec} response{totalInSec === 1 ? "" : "s"} evaluated
                      </span>
                    </div>
                  </div>

                  {/* Section Score */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {renderStars(sec.average_score)}
                    <span style={{ fontSize: "20px", fontWeight: 800, color: getScoreColor(sec.average_score) }}>
                      {sec.average_score > 0 ? sec.average_score.toFixed(1) : "—"}
                    </span>
                  </div>
                </div>

                {/* Rating Distribution Bar Histogram */}
                {totalInSec > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingTop: "8px", borderTop: "1px solid rgba(96, 165, 250, 0.08)" }}>
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = sec.rating_distribution?.[String(stars)] || 0;
                      const percent = totalInSec > 0 ? (count / totalInSec) * 100 : 0;

                      return (
                        <div key={stars} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
                          <span style={{ width: "45px", color: "var(--text-dim, #64748b)", fontWeight: 500 }}>
                            {stars} star{stars === 1 ? "" : "s"}
                          </span>

                          <div style={{ flex: 1, height: "7px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "4px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${percent}%`,
                                height: "100%",
                                background: stars >= 4 ? "var(--success, #22c55e)" : stars === 3 ? "var(--warning, #f59e0b)" : "var(--danger, #ef4444)",
                                borderRadius: "4px",
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>

                          <span style={{ width: "30px", textAlign: "right", color: "var(--text-muted, #94a3b8)", fontWeight: 600 }}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 2: QUALITATIVE FEEDBACK (Section 6) ────────────────── */}
      {activeTab === "feedback" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Search Box */}
          <div style={{ maxWidth: "420px" }}>
            <input
              type="text"
              placeholder="Search comments by keyword..."
              value={commentSearch}
              onChange={(e) => setCommentSearch(e.target.value)}
              style={{
                width: "100%",
                height: "38px",
                padding: "0 14px",
                background: "var(--bg-surface, #0d1b2a)",
                border: "1px solid var(--border, rgba(96, 165, 250, 0.2))",
                borderRadius: "var(--radius-md, 8px)",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          {filteredComments.length === 0 ? (
            <div
              style={{
                background: "var(--bg-surface, #0d1b2a)",
                borderRadius: "var(--radius-lg, 12px)",
                border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--text-dim, #64748b)",
              }}
            >
              💬 No qualitative comments recorded for this project yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {filteredComments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    background: "var(--bg-surface, #0d1b2a)",
                    border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
                    borderRadius: "var(--radius-lg, 12px)",
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Badge variant="count" size="sm">
                        Phase: {comment.phase}
                      </Badge>
                      <code style={{ fontSize: "11px", color: "var(--primary-lt, #60a5fa)" }}>{comment.survey_code}</code>
                    </div>

                    <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)" }}>
                      {comment.submitted_at || "Recent"}
                    </span>
                  </div>

                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent, #06b6d4)" }}>
                    Q: {comment.question_text}
                  </div>

                  <blockquote
                    style={{
                      margin: 0,
                      padding: "10px 14px",
                      background: "rgba(10, 22, 40, 0.6)",
                      borderLeft: "3px solid var(--primary-lt, #60a5fa)",
                      borderRadius: "0 8px 8px 0",
                      fontSize: "14px",
                      color: "var(--text-white, #ffffff)",
                      lineHeight: 1.5,
                      fontStyle: "italic",
                    }}
                  >
                    "{comment.text_answer}"
                  </blockquote>

                  {comment.client_contact_name && (
                    <div style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", marginTop: "2px" }}>
                      — {comment.client_contact_name} {comment.client_contact_email ? `(${comment.client_contact_email})` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: SURVEY EVALUATION HISTORY ───────────────────────── */}
      {activeTab === "timeline" && (
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
            borderRadius: "var(--radius-lg, 12px)",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
          }}
        >
          {data.timeline?.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim, #64748b)" }}>
              No surveys created for this project yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(15, 23, 42, 0.85)", borderBottom: "1px solid rgba(96, 165, 250, 0.15)" }}>
                    <th style={{ padding: "12px 18px", color: "var(--text-dim, #64748b)", fontWeight: 600 }}>Survey Code</th>
                    <th style={{ padding: "12px 18px", color: "var(--text-dim, #64748b)", fontWeight: 600 }}>Phase</th>
                    <th style={{ padding: "12px 18px", color: "var(--text-dim, #64748b)", fontWeight: 600 }}>Client Contact</th>
                    <th style={{ padding: "12px 18px", color: "var(--text-dim, #64748b)", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "12px 18px", color: "var(--text-dim, #64748b)", fontWeight: 600 }}>CSAT Score</th>
                    <th style={{ padding: "12px 18px", color: "var(--text-dim, #64748b)", fontWeight: 600 }}>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.timeline.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid rgba(96, 165, 250, 0.06)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <code style={{ color: "var(--accent, #06b6d4)", fontWeight: 600 }}>{s.survey_code}</code>
                      </td>
                      <td style={{ padding: "14px 18px", color: "var(--text-main, #e2e8f0)" }}>{s.phase}</td>
                      <td style={{ padding: "14px 18px", color: "var(--text-main, #e2e8f0)" }}>
                        {s.client_contact_name || s.client_contact_email || "—"}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <Badge variant={s.status === "Completed" ? "active" : s.status === "Sent" ? "info" : "archived"} size="sm">
                          {s.status}
                        </Badge>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {s.average_score !== null ? (
                          <strong style={{ color: getScoreColor(s.average_score) }}>{s.average_score.toFixed(1)} / 5.0</strong>
                        ) : (
                          <span style={{ color: "var(--text-dim, #64748b)" }}>Pending</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px", color: "var(--text-dim, #64748b)", fontSize: "12px" }}>
                        {s.completed_at || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
