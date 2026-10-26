import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import surveysApi from "../api/surveysApi";
import clientsApi from "../api/clientsApi";
import analyticsApi, { sanitizeFilename } from "../api/analyticsApi";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Input from "../components/Input";
import Select from "../components/Select";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";
import { ResendMailButton } from "../components/SurveyActionButtons";
import { SURVEY_PHASES } from "../data/questionBank";
import CategoryRadarChart from "../components/charts/CategoryRadarChart";
import CategoryBarChart from "../components/charts/CategoryBarChart";
import CategoryDistributionChart from "../components/charts/CategoryDistributionChart";
import CategoryRadialGauges from "../components/charts/CategoryRadialGauges";

const getSurveyStatus = (survey) => {
  if (survey.status === "Completed") {
    return { key: "Completed", label: "Completed", variant: "success" };
  }
  if (survey.followup_sent_at) {
    return { key: "Follow-up Sent", label: "Follow-up Sent", variant: "warning" };
  }
  const sentTime = survey.sent_at ? new Date(survey.sent_at).getTime() : new Date(survey.created_at).getTime();
  const hoursSince = (Date.now() - sentTime) / (1000 * 60 * 60);
  if (hoursSince < 24) {
    return { key: "Dispatched", label: "Dispatched", variant: "info" };
  }
  return { key: "Awaiting Response", label: "Awaiting Response", variant: "info" };
};

export default function SurveysPage({ scope = null }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = scope ? scope === "all" : user?.role === "Admin";

  const cachedSurveys = surveysApi.getCachedSurveys();
  const cachedClients = clientsApi.getCachedClients();
  const [surveys, setSurveys] = useState(() => cachedSurveys?.surveys || []);
  const [clients, setClients] = useState(() => cachedClients?.clients || []);
  const [loading, setLoading] = useState(() => !cachedSurveys);
  const [error, setError] = useState("");

  // Role-based Project Switcher & View States
  const [selectedProjectId, setSelectedProjectId] = useState(() => searchParams.get("project") || "ALL");
  const [activeTableTab, setActiveTableTab] = useState("surveys"); // "surveys" | "projects"
  const [showAdvancedCharts, setShowAdvancedCharts] = useState(false);

  // Filters for Existing Survey Registry
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedPhase, setSelectedPhase] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedClientFilter, setSelectedClientFilter] = useState("ALL");

  // Response Follow-up Modal State
  const [followupModalSurvey, setFollowupModalSurvey] = useState(null);
  const [followupMessage, setFollowupMessage] = useState("");
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [copiedSurveyId, setCopiedSurveyId] = useState(null);
  const [resendingSurveyId, setResendingSurveyId] = useState(null);

  // ── Analytics State (Scoped to Role & Selected Project) ───────────────────
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsDatePreset, setAnalyticsDatePreset] = useState("ALL");
  const [categoryChartView, setCategoryChartView] = useState("BAR");
  const [projectAttentionFilter, setProjectAttentionFilter] = useState("ALL");

  // Fetch Dashboard Analytics with role scoping & project filter
  const fetchAnalytics = useCallback(async (preset = analyticsDatePreset, projId = selectedProjectId) => {
    setAnalyticsLoading(true);
    setAnalyticsError("");

    let start_date = null;
    let end_date = null;
    const now = new Date();

    if (preset === "30D") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start_date = past.toISOString().split("T")[0];
      end_date = now.toISOString().split("T")[0];
    } else if (preset === "90D") {
      const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      start_date = past.toISOString().split("T")[0];
      end_date = now.toISOString().split("T")[0];
    } else if (preset === "YTD") {
      start_date = `${now.getFullYear()}-01-01`;
      end_date = now.toISOString().split("T")[0];
    }

    try {
      const params = {};
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
      if (projId && projId !== "ALL") params.project_id = Number(projId);
      const data = await analyticsApi.getDashboardAnalytics(params);
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load dashboard analytics:", err);
      setAnalyticsError(err?.response?.data?.detail || "Could not load analytics metrics from database.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDatePreset, selectedProjectId]);

  // Fetch surveys and clients independently (Original logic preserved)
  const fetchSurveys = async (force = false) => {
    const cached = surveysApi.getCachedSurveys();
    if (cached && !force) {
      setSurveys(cached.surveys || []);
      setLoading(false);
      return;
    }

    if (!cached && surveys.length === 0) {
      setLoading(true);
    }
    setError("");

    try {
      const surveysPromise = surveysApi.getSurveys({}, force).then((res) => {
        setSurveys(res.surveys || []);
      });

      const clientsPromise = clientsApi.getClients({ forceRefresh: force }).then((res) => {
        setClients(res.clients || []);
      }).catch(() => {});

      await surveysPromise;
    } catch (err) {
      console.error("Failed to fetch surveys:", err);
      if (surveys.length === 0) {
        setError("Unable to load surveys. Please verify connection and retry.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
    fetchAnalytics("ALL");
  }, []);



  // Follow-up modal (Original logic preserved)
  const openFollowupModal = (survey) => {
    setFollowupModalSurvey(survey);
    setFollowupMessage(
      `Dear ${survey.client_contact_name || "Client"},\n\nThank you for submitting your evaluation for ${survey.project?.name || "our engagement"} (${survey.phase}).\n\nOur delivery team has reviewed your feedback and is taking action on the insights provided.\n\nWarm regards,\nPMO Team`
    );
  };

  // Re-trigger invitation email to client contact
  const handleResendEmail = async (survey) => {
    if (!survey.client_contact_email) return;
    try {
      setResendingSurveyId(survey.id);
      await surveysApi.dispatchSurvey(survey.id, {
        client_contact_name: survey.client_contact_name || "Client Stakeholder",
        client_contact_email: survey.client_contact_email,
      });
      setToast({
        message: `Survey invitation email successfully sent to ${survey.client_contact_email}!`,
        type: "success",
      });
    } catch (err) {
      console.error("Resend email failed:", err);
      setToast({
        message: err?.response?.data?.detail || "Failed to trigger email to client.",
        type: "danger",
      });
    } finally {
      setResendingSurveyId(null);
    }
  };

  // Filter dispatched and completed surveys (Drafts belong to /drafts) (Original logic preserved)
  const activeSurveys = useMemo(() => {
    return surveys.filter((s) => s.status !== "Draft");
  }, [surveys]);

  // Original fallback KPIs across active surveys
  const kpis = useMemo(() => {
    const total = activeSurveys.length;
    const completedSurveys = activeSurveys.filter((s) => s.status === "Completed");
    const completed = completedSurveys.length;
    const sent = activeSurveys.filter((s) => s.status === "Sent").length;
    const responseRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedWithScores = completedSurveys.filter((s) => s.average_score != null);
    const avgScore = completedWithScores.length > 0
      ? completedWithScores.reduce((acc, curr) => acc + curr.average_score, 0) / completedWithScores.length
      : null;
    const percentageScore = avgScore != null ? Math.round((avgScore / 5.0) * 100) : null;

    return { total, sent, completed, responseRate, avgScore, percentageScore };
  }, [activeSurveys]);

  // Filtered surveys for Main Surveys Table
  const filteredSurveys = useMemo(() => {
    return activeSurveys.filter((s) => {
      if (selectedProjectId !== "ALL" && String(s.project_id) !== String(selectedProjectId)) {
        return false;
      }
      if (selectedStatus !== "ALL") {
        const sStatus = getSurveyStatus(s);
        if (sStatus.key !== selectedStatus) {
          return false;
        }
      }
      if (selectedPhase !== "ALL" && s.phase !== selectedPhase) {
        return false;
      }
      if (selectedClientFilter !== "ALL" && String(s.client_id) !== selectedClientFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const clientMatch = s.client?.name?.toLowerCase().includes(q);
        const projectMatch = s.project?.name?.toLowerCase().includes(q);
        const contactMatch = s.client_contact_name?.toLowerCase().includes(q) || s.client_contact_email?.toLowerCase().includes(q);
        if (!clientMatch && !projectMatch && !contactMatch) return false;
      }
      return true;
    });
  }, [activeSurveys, selectedStatus, selectedPhase, selectedClientFilter, searchQuery, selectedProjectId]);

  // Available projects list scoped by backend role queries
  const availableProjects = useMemo(() => {
    if (analytics?.projects && analytics.projects.length > 0) {
      return analytics.projects;
    }
    const map = new Map();
    for (const s of surveys) {
      if (s.project && !map.has(s.project_id)) {
        map.set(s.project_id, {
          project_id: s.project_id,
          project_name: s.project.name,
          client_name: s.client?.name || "Client",
        });
      }
    }
    return Array.from(map.values());
  }, [analytics?.projects, surveys]);

  const selectedProjectObj = useMemo(() => {
    if (selectedProjectId === "ALL") return null;
    return availableProjects.find((p) => String(p.project_id) === String(selectedProjectId));
  }, [availableProjects, selectedProjectId]);

  // Project-wise analytics list
  const projectMetricsList = useMemo(() => {
    let list = analytics?.projects || [];
    if (selectedProjectId !== "ALL") {
      list = list.filter((p) => String(p.project_id) === String(selectedProjectId));
    }
    if (projectAttentionFilter === "ATTENTION") {
      return list.filter((p) => p.has_low_rating || p.has_pending);
    }
    return list;
  }, [analytics, projectAttentionFilter, selectedProjectId]);

  // Metrics resolution
  const totalSurveysDispatched = analytics?.total_surveys ?? kpis.total;
  const totalResponded = analytics?.responded_surveys ?? kpis.completed;
  const totalAwaiting = analytics?.awaiting_response_surveys ?? kpis.sent;
  const overallCsatPercentage = analytics?.overall_csat_percentage ?? kpis.percentageScore;
  const overallCsatAvg = analytics?.overall_csat ?? kpis.avgScore;
  const responseRate = analytics?.response_rate ?? kpis.responseRate;

  return (
    <div style={{ padding: "28px", maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Toast Notification (Original preserved) */}
      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "info" })}
        />
      )}

      {/* ── Main Header & Analytics Controls ─────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary, #ffffff)", margin: 0, letterSpacing: "-0.4px" }}>
            CSAT Dashboard & Analytics
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
            {isAdmin
              ? "Portfolio-wide CSAT performance, category benchmarks, and project satisfaction metrics."
              : "Project satisfaction performance, category ratings, and dispatched surveys for your assigned projects."}
          </p>
        </div>

        {/* Header Controls: Role-based Project Switcher & Date Preset Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Project Switcher */}
          <div style={{ minWidth: "210px" }}>
            <select
              id="projectSwitcher"
              value={selectedProjectId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedProjectId(newId);
                fetchAnalytics(analyticsDatePreset, newId);
              }}
              style={{
                width: "100%",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 600,
                borderRadius: "9px",
                background: "var(--bg-card, #18263B)",
                border: "1px solid var(--border, #33465f)",
                color: "var(--text-primary, #ffffff)",
                cursor: "pointer",
                outline: "none",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <option value="ALL">
                {isAdmin ? "🌐 All Projects (Portfolio)" : "📁 All My Projects"}
              </option>
              {availableProjects.map((p) => (
                <option key={p.project_id} value={String(p.project_id)}>
                  {p.project_name} ({p.client_name})
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Tabs for Analytics */}
          <div
            style={{
              display: "inline-flex",
              background: "var(--bg-card, #18263B)",
              border: "1px solid var(--border, #33465f)",
              borderRadius: "10px",
              padding: "4px",
              gap: "4px",
              backdropFilter: "blur(8px)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {[
              { id: "ALL", label: "All Time" },
              { id: "30D", label: "Last 30 Days" },
              { id: "90D", label: "Last 90 Days" },
              { id: "YTD", label: "Year to Date" },
            ].map((tab) => {
              const active = analyticsDatePreset === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setAnalyticsDatePreset(tab.id);
                    fetchAnalytics(tab.id, selectedProjectId);
                  }}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: active ? 700 : 500,
                    borderRadius: "7px",
                    border: "none",
                    cursor: "pointer",
                    background: active ? "linear-gradient(135deg, var(--primary), var(--primary-hover))" : "transparent",
                    color: active ? "#ffffff" : "var(--text-muted, #94a3b8)",
                    boxShadow: active ? "0 2px 8px rgba(37, 99, 235, 0.4)" : "none",
                    transition: "all 0.18s ease",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scoped Project Banner (when a specific project is selected) */}
      {selectedProjectId !== "ALL" && selectedProjectObj && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            background: "rgba(37, 99, 235, 0.12)",
            border: "1px solid rgba(59, 130, 246, 0.35)",
            borderRadius: "10px",
            padding: "12px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>🎯</span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #ffffff)" }}>
                Viewing Scoped Analytics: {selectedProjectObj.project_name}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>
                Client: {selectedProjectObj.client_name} • Scoped metrics and survey records
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link
              to={`/projects/${selectedProjectId}/analytics`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: "6px",
                background: "var(--primary, #2563eb)",
                color: "#ffffff",
                textDecoration: "none",
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
              }}
            >
              <span>Dedicated Project Analytics</span>
              <span>↗</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId("ALL");
                fetchAnalytics(analyticsDatePreset, "ALL");
              }}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "6px",
                background: "transparent",
                border: "1px solid var(--border, #33465f)",
                color: "var(--text-muted, #94a3b8)",
                cursor: "pointer",
              }}
            >
              Show All Projects
            </button>
          </div>
        </div>
      )}

      {/* ── 5 Key Summary Cards ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Card 1: Overall CSAT Score */}
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "var(--bg-kpi-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Overall CSAT
            </span>
            <span style={{ fontSize: "11px", color: "var(--primary, #60a5fa)", fontWeight: 600 }}>Ratings ≥ 4 / 5</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "2px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--primary, #60a5fa)", letterSpacing: "-0.5px" }}>
              {overallCsatPercentage != null ? `${overallCsatPercentage}%` : "—"}
            </span>
            {overallCsatAvg != null && (
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--warning, #fbbf24)" }}>
                ★ {overallCsatAvg.toFixed(2)} / 5.0
              </span>
            )}
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
            From submitted client evaluations
          </span>
        </div>

        {/* Card 2: Total Surveys Dispatched */}
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "var(--bg-kpi-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #06b6d4 0%, #38bdf8 100%)",
            }}
          />
          <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Surveys Dispatched
          </span>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary, #ffffff)", marginTop: "2px", letterSpacing: "-0.5px" }}>
            {totalSurveysDispatched}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
            Invitations sent to stakeholders
          </span>
        </div>

        {/* Card 3: Responded Surveys */}
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "var(--bg-kpi-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Responded Surveys
            </span>
            <span style={{ fontSize: "12px", color: "var(--success, #22c55e)", fontWeight: 700 }}>
              {responseRate}%
            </span>
          </div>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--success, #22c55e)", marginTop: "2px", letterSpacing: "-0.5px" }}>
            {totalResponded}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
            Completed feedback submissions
          </span>
        </div>

        {/* Card 4: Awaiting Response */}
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "var(--bg-kpi-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
            }}
          />
          <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Awaiting Response
          </span>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--warning, #f59e0b)", marginTop: "2px", letterSpacing: "-0.5px" }}>
            {totalAwaiting}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
            Dispatched surveys pending reply
          </span>
        </div>

        {/* Card 5: Monitored Projects */}
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "var(--bg-kpi-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Monitored Projects
            </span>
            <span style={{ fontSize: "11px", color: "#a78bfa", fontWeight: 600 }}>Active Scope</span>
          </div>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary, #ffffff)", marginTop: "2px", letterSpacing: "-0.5px" }}>
            {availableProjects.length}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
            {isAdmin ? "Total projects in portfolio" : "Projects assigned to your scope"}
          </span>
        </div>
      </div>

      {/* ── Primary Chart: Category CSAT Bar Chart (Decluttered) ──────────── */}
      <div
        style={{
          background: "var(--bg-card, #18263B)",
          border: "1px solid var(--border, #33465f)",
          borderRadius: "var(--radius-lg, 14px)",
          padding: "22px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary, #ffffff)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📊 Category CSAT Performance</span>
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
              Average client satisfaction across feedback evaluation categories.
            </p>
          </div>

          {/* Toggle button to expand/collapse secondary visualization views */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {showAdvancedCharts && (
              <div
                style={{
                  display: "inline-flex",
                  background: "var(--bg-elevated, #22334A)",
                  border: "1px solid var(--border, #33465f)",
                  borderRadius: "8px",
                  padding: "2px",
                  gap: "2px",
                }}
              >
                {[
                  { id: "BAR", label: "Bar" },
                  { id: "RADAR", label: "Radar" },
                  { id: "DISTRIBUTION", label: "Distribution" },
                  { id: "GAUGES", label: "Gauges" },
                ].map((tab) => {
                  const active = categoryChartView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategoryChartView(tab.id)}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: active ? 700 : 500,
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: active ? "var(--primary, #2563eb)" : "transparent",
                        color: active ? "#ffffff" : "var(--text-secondary, #94a3b8)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const nextState = !showAdvancedCharts;
                setShowAdvancedCharts(nextState);
                if (!nextState) setCategoryChartView("BAR");
              }}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #33465f)",
                background: showAdvancedCharts ? "rgba(37, 99, 235, 0.15)" : "var(--bg-elevated, #22334A)",
                color: showAdvancedCharts ? "var(--primary-lt, #60a5fa)" : "var(--text-muted, #94a3b8)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <span>{showAdvancedCharts ? "Hide Secondary Views ▲" : "Explore More Chart Views ▼"}</span>
            </button>
          </div>
        </div>

        {analyticsLoading ? (
          <div style={{ padding: "40px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
            <Spinner size="md" />
            <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>Loading category ratings...</span>
          </div>
        ) : analyticsError ? (
          <div style={{ padding: "20px", color: "var(--danger, #fca5a5)", fontSize: "13px", textAlign: "center" }}>
            {analyticsError}
          </div>
        ) : !analytics?.categories || analytics.categories.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "13px" }}>
            No category evaluation data available.
          </div>
        ) : (
          <div>
            {/* View: Bar Chart (Primary) */}
            {categoryChartView === "BAR" && (
              <div style={{ background: "var(--chart-sub-bg, #F8FAFC)", border: "1px solid var(--border, #33465f)", borderRadius: "10px", padding: "20px" }}>
                <CategoryBarChart categories={analytics.categories} />
              </div>
            )}

            {/* View: Radar Chart (Secondary) */}
            {categoryChartView === "RADAR" && (
              <div style={{ background: "var(--chart-sub-bg, #F8FAFC)", border: "1px solid var(--border, #33465f)", borderRadius: "10px", padding: "20px", display: "flex", justifyContent: "center" }}>
                <CategoryRadarChart categories={analytics.categories} />
              </div>
            )}

            {/* View: Rating Distribution (Secondary) */}
            {categoryChartView === "DISTRIBUTION" && (
              <div style={{ background: "var(--chart-sub-bg, #F8FAFC)", border: "1px solid var(--border, #33465f)", borderRadius: "10px", padding: "20px" }}>
                <CategoryDistributionChart categories={analytics.categories} />
              </div>
            )}

            {/* View: Circular Gauges (Secondary) */}
            {categoryChartView === "GAUGES" && (
              <div style={{ background: "var(--chart-sub-bg, #F8FAFC)", border: "1px solid var(--border, #33465f)", borderRadius: "10px", padding: "20px" }}>
                <CategoryRadialGauges categories={analytics.categories} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Compact Tabbed Table: Projects Performance vs Dispatched Surveys ─ */}
      <div
        style={{
          background: "var(--bg-card, #18263B)",
          border: "1px solid var(--border, #33465f)",
          borderRadius: "var(--radius-lg, 14px)",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
        }}
      >
        {/* Unified Table Header Tabs */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border, #33465f)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            background: "var(--bg-elevated, #1a293f)",
          }}
        >
          {/* Main Tabs */}
          <div style={{ display: "inline-flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setActiveTableTab("surveys")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: activeTableTab === "surveys" ? 700 : 500,
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                background: activeTableTab === "surveys" ? "var(--primary, #2563eb)" : "transparent",
                color: activeTableTab === "surveys" ? "#ffffff" : "var(--text-muted, #94a3b8)",
                boxShadow: activeTableTab === "surveys" ? "0 2px 6px rgba(37, 99, 235, 0.4)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span>✉️ Dispatched Surveys</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: activeTableTab === "surveys" ? "rgba(255,255,255,0.25)" : "var(--bg-card, #18263B)",
                  color: "#ffffff",
                }}
              >
                {filteredSurveys.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTableTab("projects")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: activeTableTab === "projects" ? 700 : 500,
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                background: activeTableTab === "projects" ? "var(--primary, #2563eb)" : "transparent",
                color: activeTableTab === "projects" ? "#ffffff" : "var(--text-muted, #94a3b8)",
                boxShadow: activeTableTab === "projects" ? "0 2px 6px rgba(37, 99, 235, 0.4)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <span>📁 Projects Performance</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: activeTableTab === "projects" ? "rgba(255,255,255,0.25)" : "var(--bg-card, #18263B)",
                  color: "#ffffff",
                }}
              >
                {projectMetricsList.length}
              </span>
            </button>
          </div>

          {/* Sub-filter: Attention switch for Projects Tab */}
          {activeTableTab === "projects" && (
            <div style={{ display: "inline-flex", background: "var(--bg-card, #18263B)", border: "1px solid var(--border, #33465f)", borderRadius: "8px", padding: "3px" }}>
              <button
                type="button"
                onClick={() => setProjectAttentionFilter("ALL")}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: projectAttentionFilter === "ALL" ? "var(--primary-badge-bg)" : "transparent",
                  color: projectAttentionFilter === "ALL" ? "var(--primary)" : "var(--text-muted, #94a3b8)",
                }}
              >
                All Projects ({analytics?.projects?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setProjectAttentionFilter("ATTENTION")}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: projectAttentionFilter === "ATTENTION" ? "var(--badge-danger-bg)" : "transparent",
                  color: projectAttentionFilter === "ATTENTION" ? "var(--danger)" : "var(--text-muted, #94a3b8)",
                }}
              >
                Needs Attention ({analytics?.projects?.filter((p) => p.has_low_rating || p.has_pending).length || 0})
              </button>
            </div>
          )}
        </div>

        {/* ── TAB CONTENT 1: Projects Performance Table ── */}
        {activeTableTab === "projects" && (
          <div>
            {analyticsLoading ? (
              <div style={{ padding: "40px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                <Spinner size="md" />
                <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>Loading project analytics...</span>
              </div>
            ) : projectMetricsList.length === 0 ? (
              <div style={{ padding: "36px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "13px" }}>
                No project performance metrics match your current scope or filters.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-table-header)", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      <th style={{ padding: "12px 18px", fontWeight: 700 }}>Project / Client</th>
                      <th style={{ padding: "12px 18px", fontWeight: 700 }}>Surveys Sent</th>
                      <th style={{ padding: "12px 18px", fontWeight: 700 }}>Responses</th>
                      <th style={{ padding: "12px 18px", fontWeight: 700, minWidth: "160px" }}>Response Rate</th>
                      <th style={{ padding: "12px 18px", fontWeight: 700 }}>Average CSAT</th>
                      <th style={{ padding: "12px 18px", fontWeight: 700 }}>Status</th>
                      <th style={{ padding: "12px 18px", fontWeight: 700, textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectMetricsList.map((p) => {
                      const hasRating = p.average_csat !== null;
                      return (
                        <tr
                          key={p.project_id}
                          style={{ borderBottom: "1px solid var(--table-row-border)", transition: "background 0.15s ease" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-table-row-hover)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "12px 18px" }}>
                            <div style={{ fontWeight: 600, color: "var(--text-primary, #ffffff)" }}>
                              {p.project_name}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                              {p.client_name}
                            </div>
                          </td>
                          <td style={{ padding: "12px 18px", fontWeight: 600, color: "var(--text-primary, #ffffff)" }}>
                            {p.surveys_sent}
                          </td>
                          <td style={{ padding: "12px 18px" }}>
                            <span style={{ fontWeight: 600, color: "var(--success, #22c55e)" }}>{p.submitted_responses}</span>
                            {p.awaiting_responses > 0 && (
                              <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", marginLeft: "6px" }}>
                                ({p.awaiting_responses} pending)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "12px", fontWeight: 700, minWidth: "36px", color: "var(--text-primary)" }}>
                                {p.response_rate}%
                              </span>
                              <div style={{ flex: 1, height: "6px", background: "var(--bg-track)", borderRadius: "3px", overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${p.response_rate}%`,
                                    background: p.response_rate >= 70 ? "var(--success, #22c55e)" : p.response_rate >= 40 ? "var(--primary, #38bdf8)" : "var(--warning, #f59e0b)",
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px 18px" }}>
                            {hasRating ? (
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  background: p.average_csat >= 4.0 ? "rgba(34, 197, 94, 0.15)" : p.average_csat >= 3.0 ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                  color: p.average_csat >= 4.0 ? "#22c55e" : p.average_csat >= 3.0 ? "#fbbf24" : "#ef4444",
                                  border: `1px solid ${p.average_csat >= 4.0 ? "rgba(34, 197, 94, 0.3)" : p.average_csat >= 3.0 ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                                }}
                              >
                                ★ {p.average_csat.toFixed(2)}
                              </span>
                            ) : (
                              <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", fontStyle: "italic" }}>
                                No ratings yet
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 18px" }}>
                            {p.has_low_rating ? (
                              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.15)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                                ⚠️ Low CSAT
                              </span>
                            ) : p.has_pending ? (
                              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.15)", color: "#fcd34d", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                                ⏳ {p.awaiting_responses} Pending
                              </span>
                            ) : (
                              <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", background: "rgba(34, 197, 94, 0.1)", color: "#86efac" }}>
                                ✓ Healthy
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right" }}>
                            <Link
                              to={`/projects/${p.project_id}/analytics`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "12px",
                                fontWeight: 600,
                                padding: "4px 10px",
                                borderRadius: "6px",
                                background: "rgba(37, 99, 235, 0.1)",
                                border: "1px solid rgba(37, 99, 235, 0.25)",
                                color: "var(--primary-lt, #60a5fa)",
                                textDecoration: "none",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <span>Analytics</span>
                              <span style={{ fontSize: "10px" }}>↗</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT 2: Dispatched Surveys ── */}
        {activeTableTab === "surveys" && (
          <div>
            {/* Filter and Search Bar */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border, #33465f)",
                display: "flex",
                gap: "14px",
                alignItems: "center",
                flexWrap: "wrap",
                background: "var(--bg-card, #18263B)",
              }}
            >
              <div style={{ flex: 1, minWidth: "220px" }}>
                <Input
                  id="surveySearch"
                  placeholder="Search by client, project, or contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ width: "175px" }}>
                <Select
                  id="statusFilter"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  options={[
                    { value: "ALL", label: "All Statuses" },
                    { value: "Dispatched", label: "Dispatched" },
                    { value: "Awaiting Response", label: "Awaiting Response" },
                    { value: "Follow-up Sent", label: "Follow-up Sent" },
                    { value: "Completed", label: "Completed" },
                  ]}
                />
              </div>

              <div style={{ width: "160px" }}>
                <Select
                  id="phaseFilter"
                  value={selectedPhase}
                  onChange={(e) => setSelectedPhase(e.target.value)}
                  options={[
                    { value: "ALL", label: "All Phases" },
                    ...SURVEY_PHASES.map((p) => ({ value: p.value, label: p.label })),
                  ]}
                />
              </div>

              <div style={{ width: "180px" }}>
                <Select
                  id="clientFilter"
                  value={selectedClientFilter}
                  onChange={(e) => setSelectedClientFilter(e.target.value)}
                  options={[
                    { value: "ALL", label: "All Clients" },
                    ...clients.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </div>

              {(searchQuery || selectedPhase !== "ALL" || selectedStatus !== "ALL" || selectedClientFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedPhase("ALL");
                    setSelectedStatus("ALL");
                    setSelectedClientFilter("ALL");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Main Surveys Table */}
            {loading ? (
              <div style={{ padding: "60px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                <Spinner size="lg" />
                <span style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)" }}>Loading surveys...</span>
              </div>
            ) : error ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--danger, #fca5a5)" }}>
                <p>{error}</p>
                <Button variant="secondary" size="sm" onClick={() => fetchSurveys(true)} style={{ marginTop: "12px" }}>
                  Retry
                </Button>
              </div>
            ) : filteredSurveys.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
                <div style={{ fontSize: "36px", opacity: 0.5 }}>📋</div>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary, #ffffff)", margin: 0 }}>
                  No surveys found
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", maxWidth: "400px", margin: 0 }}>
                  {surveys.length === 0
                    ? "No satisfaction surveys have been dispatched yet. Go to Create Survey to launch your first survey."
                    : "No surveys match your current search and filter criteria."}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    fontSize: "13px",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "var(--bg-table-header)",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                      }}
                    >
                      <th style={{ padding: "14px 18px", fontWeight: 700 }}>Client</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700 }}>Project</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700 }}>Phase</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700 }}>Status</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700 }}>Average CSAT</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700 }}>Client Contact</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700 }}>Sent Date</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSurveys.map((survey) => {
                      return (
                        <tr
                          key={survey.id}
                          style={{
                            borderBottom: "1px solid var(--table-row-border)",
                            transition: "background 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-table-row-hover)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          {/* Client */}
                          <td style={{ padding: "14px 18px", fontWeight: 600, color: "var(--text-primary, #ffffff)" }}>
                            {survey.client?.name || "—"}
                          </td>

                          {/* Project */}
                          <td style={{ padding: "14px 18px" }}>
                            {survey.project ? (
                              <Link
                                to={`/projects/${survey.project.id}/analytics`}
                                style={{
                                  fontSize: "13px",
                                  color: "var(--primary-lt, #60a5fa)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  textDecoration: "none",
                                  fontWeight: 500,
                                }}
                                title="View dedicated project analytics dashboard"
                              >
                                <span>{survey.project.name}</span>
                                <span style={{ fontSize: "10px" }}>↗</span>
                              </Link>
                            ) : (
                              <span style={{ color: "var(--text-muted, #94a3b8)" }}>—</span>
                            )}
                          </td>

                          {/* Phase */}
                          <td style={{ padding: "14px 18px" }}>
                            <Badge variant="count">{survey.phase}</Badge>
                          </td>

                          {/* Status */}
                          <td style={{ padding: "14px 18px" }}>
                            <Badge variant={survey.status === "Completed" ? "success" : survey.status === "Sent" ? "info" : "neutral"}>
                              {survey.status}
                            </Badge>
                          </td>

                          {/* Average CSAT */}
                          <td style={{ padding: "14px 18px", fontWeight: 700, color: survey.average_score ? "var(--success, #22c55e)" : "var(--text-muted, #94a3b8)" }}>
                            {survey.average_score ? `${Number(survey.average_score).toFixed(2)} ★` : "—"}
                          </td>

                          {/* Client Contact */}
                          <td style={{ padding: "14px 18px", color: "var(--text-secondary, #94a3b8)", fontSize: "12px" }}>
                            {survey.client_contact_email || "—"}
                          </td>

                          {/* Sent Date */}
                          <td style={{ padding: "14px 18px", color: "var(--text-secondary, #94a3b8)", fontSize: "12px", whiteSpace: "nowrap" }}>
                            {survey.sent_at ? new Date(survey.sent_at).toLocaleDateString() : (survey.created_at ? new Date(survey.created_at).toLocaleDateString() : "—")}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "14px 18px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                              {survey.client_contact_email && survey.status !== "Completed" && (
                                <ResendMailButton
                                  onClick={() => handleResendEmail(survey)}
                                  loading={resendingSurveyId === survey.id}
                                  title={`Trigger/Resend invitation email to ${survey.client_contact_email}`}
                                />
                              )}

                              {survey.status === "Completed" && (
                                <Link
                                  to={`/responses/${survey.id}`}
                                  title="View submitted client response details"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "var(--primary)",
                                    textDecoration: "none",
                                    padding: "0 10px",
                                    height: "32px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--border)",
                                    background: "var(--primary-badge-bg)",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                  <span>View Response</span>
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Response Follow-up Modal (Original preserved) */}
      {followupModalSurvey && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={() => setFollowupModalSurvey(null)}
        >
          <div
            style={{
              background: "var(--bg-card, #0d1b2a)",
              border: "1px solid var(--border, rgba(96, 165, 250, 0.3))",
              borderRadius: "12px",
              padding: "26px",
              maxWidth: "600px",
              width: "100%",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ color: "var(--text-primary, #ffffff)", margin: 0, fontSize: "17px", fontWeight: 700 }}>
                Send Follow-up Email
              </h3>
              <button
                type="button"
                onClick={() => setFollowupModalSurvey(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted, #94a3b8)", fontSize: "20px", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: "13px", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Send an acknowledgment email to <strong>{followupModalSurvey.client_contact_name}</strong> ({followupModalSurvey.client_contact_email}) regarding their {followupModalSurvey.phase} evaluation.
            </p>

            <textarea
              value={followupMessage}
              onChange={(e) => setFollowupMessage(e.target.value)}
              rows={8}
              style={{
                width: "100%",
                background: "var(--bg-elevated, #22334A)",
                border: "1px solid var(--border, #33465f)",
                borderRadius: "8px",
                color: "var(--text-primary, #e2e8f0)",
                fontSize: "13px",
                padding: "12px",
                outline: "none",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
                marginBottom: "18px",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="ghost" size="sm" onClick={() => setFollowupModalSurvey(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={sendingFollowup} onClick={handleSendFollowup}>
                {sendingFollowup ? "Sending..." : "Send Follow-up"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
