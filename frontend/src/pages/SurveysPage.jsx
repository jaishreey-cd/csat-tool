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
import { ResendMailButton, ExportCsvButton } from "../components/SurveyActionButtons";
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

export default function SurveysPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const cachedSurveys = surveysApi.getCachedSurveys();
  const cachedClients = clientsApi.getCachedClients();
  const [surveys, setSurveys] = useState(() => cachedSurveys?.surveys || []);
  const [clients, setClients] = useState(() => cachedClients?.clients || []);
  const [loading, setLoading] = useState(() => !cachedSurveys);
  const [error, setError] = useState("");

  // Filters for Existing Survey Registry (Unchanged)
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedPhase, setSelectedPhase] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedClientFilter, setSelectedClientFilter] = useState("ALL");

  // Response Follow-up Modal State (Unchanged)
  const [followupModalSurvey, setFollowupModalSurvey] = useState(null);
  const [followupMessage, setFollowupMessage] = useState("");
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [copiedSurveyId, setCopiedSurveyId] = useState(null);

  // Export state per survey (Unchanged)
  const [exportingSurveyId, setExportingSurveyId] = useState(null);
  const [resendingSurveyId, setResendingSurveyId] = useState(null);

  // Hover state for Responded popover (Unchanged)
  const [hoveredSurveyId, setHoveredSurveyId] = useState(null);

  // ── Analytics State (Added to Dashboard) ───────────────────────────────────
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsDatePreset, setAnalyticsDatePreset] = useState("ALL");
  const [categoryChartView, setCategoryChartView] = useState("BAR");
  const [projectAttentionFilter, setProjectAttentionFilter] = useState("ALL");

  // Fetch Dashboard Analytics from PostgreSQL
  const fetchAnalytics = useCallback(async (preset = analyticsDatePreset) => {
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
      const data = await analyticsApi.getDashboardAnalytics(params);
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load dashboard analytics:", err);
      setAnalyticsError("Could not load analytics metrics from database.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDatePreset]);

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

  // Handle Export per individual survey (Original logic preserved)
  const handleExportSingleSurvey = async (survey, format = "xlsx") => {
    setExportingSurveyId(survey.id);
    const projectName = survey.project?.name || "Survey";
    const safeName = sanitizeFilename(projectName);
    const downloadFilename = `${safeName}.csv`;
    try {
      await analyticsApi.exportSurveysRegistry({ survey_id: survey.id }, "csv", downloadFilename);
      setToast({
        message: `Successfully exported survey as ${downloadFilename}`,
        type: "success",
      });
    } catch (err) {
      console.error("Export failed:", err);
      setToast({ message: "Failed to export survey. Please try again.", type: "danger" });
    } finally {
      setExportingSurveyId(null);
    }
  };

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

  // Filtered surveys for Main Surveys Table (Original logic preserved)
  const filteredSurveys = useMemo(() => {
    return activeSurveys.filter((s) => {
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
  }, [activeSurveys, selectedStatus, selectedPhase, selectedClientFilter, searchQuery]);

  // Project-wise analytics list
  const projectMetricsList = useMemo(() => {
    const list = analytics?.projects || [];
    if (projectAttentionFilter === "ATTENTION") {
      return list.filter((p) => p.has_low_rating || p.has_pending);
    }
    return list;
  }, [analytics, projectAttentionFilter]);

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
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-white, #ffffff)", margin: 0, letterSpacing: "-0.4px" }}>
            CSAT Dashboard & Analytics
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
            Real-time portfolio CSAT metrics, category ratings, and project satisfaction performance.
          </p>
        </div>

        {/* Date Filter Tabs for Analytics */}
        <div
          style={{
            display: "inline-flex",
            background: "rgba(13, 27, 42, 0.85)",
            border: "1px solid rgba(96, 165, 250, 0.2)",
            borderRadius: "10px",
            padding: "4px",
            gap: "4px",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
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
                  fetchAnalytics(tab.id);
                }}
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: active ? 700 : 500,
                  borderRadius: "7px",
                  border: "none",
                  cursor: "pointer",
                  background: active ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "transparent",
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

      {/* ── Summary Cards (Added Analytics) ──────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Overall CSAT Score */}
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "linear-gradient(180deg, rgba(14, 28, 48, 0.85) 0%, rgba(10, 20, 36, 0.95) 100%)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.22))",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "22px 20px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
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
              Overall CSAT Score
            </span>
            <span style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 600 }}>Ratings ≥ 4 / 5</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "2px" }}>
            <span style={{ fontSize: "32px", fontWeight: 800, color: "#60a5fa", letterSpacing: "-0.5px" }}>
              {overallCsatPercentage != null ? `${overallCsatPercentage}%` : "—"}
            </span>
            {overallCsatAvg != null && (
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#fbbf24" }}>
                ★ {overallCsatAvg.toFixed(2)} / 5.0
              </span>
            )}
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
            Calculated from valid submitted client ratings
          </span>
        </div>

        {/* Total Surveys Dispatched */}
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "linear-gradient(180deg, rgba(14, 28, 48, 0.85) 0%, rgba(10, 20, 36, 0.95) 100%)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.16))",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "22px 20px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
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
            Total Surveys Dispatched
          </span>
          <span style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-white, #ffffff)", marginTop: "2px", letterSpacing: "-0.5px" }}>
            {totalSurveysDispatched}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
            Total invitations sent to stakeholders
          </span>
        </div>

        {/* Responded Surveys */}
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "linear-gradient(180deg, rgba(14, 28, 48, 0.85) 0%, rgba(10, 20, 36, 0.95) 100%)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.16))",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "22px 20px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
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
          <span style={{ fontSize: "32px", fontWeight: 800, color: "var(--success, #22c55e)", marginTop: "2px", letterSpacing: "-0.5px" }}>
            {totalResponded}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
            Valid final client submissions received
          </span>
        </div>

        {/* Awaiting Response */}
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "linear-gradient(180deg, rgba(14, 28, 48, 0.85) 0%, rgba(10, 20, 36, 0.95) 100%)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.16))",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "22px 20px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
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
          <span style={{ fontSize: "32px", fontWeight: 800, color: "#f59e0b", marginTop: "2px", letterSpacing: "-0.5px" }}>
            {totalAwaiting}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
            Dispatched surveys pending client response
          </span>
        </div>
      </div>

      {/* ── Category-wise Analytics (Professional Multi-Chart Suite) ────── */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          boxShadow: "0 6px 24px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Header with Title and Chart View Switcher */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>Category-wise Analytics</span>
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
              Multi-dimensional evaluation across configured feedback categories derived from PostgreSQL responses.
            </p>
          </div>

          {/* Interactive Chart Type Switcher */}
          <div
            style={{
              display: "inline-flex",
              background: "rgba(10, 22, 40, 0.8)",
              border: "1px solid rgba(96, 165, 250, 0.2)",
              borderRadius: "8px",
              padding: "3px",
              gap: "2px",
              flexWrap: "wrap",
            }}
          >
            {[
              { id: "BAR", label: "📊 Bar Chart" },
              { id: "RADAR", label: "🕸 Radar Chart" },
              { id: "DISTRIBUTION", label: "📶 Rating Distribution" },
              { id: "GAUGES", label: "⭕ Circular Gauges" },
            ].map((tab) => {
              const active = categoryChartView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryChartView(tab.id)}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: active ? 700 : 500,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: active ? "var(--primary, #2563eb)" : "transparent",
                    color: active ? "#ffffff" : "var(--text-muted, #94a3b8)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {analyticsLoading ? (
          <div style={{ padding: "50px", display: "flex", justifyContent: "center", alignItems: "center", gap: "12px" }}>
            <Spinner size="md" />
            <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>Loading category analytics...</span>
          </div>
        ) : analyticsError ? (
          <div style={{ padding: "24px", color: "#fca5a5", fontSize: "13px", textAlign: "center" }}>
            {analyticsError}
          </div>
        ) : !analytics?.categories || analytics.categories.length === 0 ? (
          <div style={{ padding: "36px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "13px" }}>
            No configured survey categories found.
          </div>
        ) : (
          <div>
            {/* View: Bar Chart */}
            {categoryChartView === "BAR" && (
              <div style={{ background: "rgba(10, 22, 40, 0.4)", border: "1px solid rgba(96, 165, 250, 0.12)", borderRadius: "10px", padding: "24px" }}>
                <CategoryBarChart categories={analytics.categories} />
              </div>
            )}

            {/* View: Radar Chart */}
            {categoryChartView === "RADAR" && (
              <div style={{ background: "rgba(10, 22, 40, 0.4)", border: "1px solid rgba(96, 165, 250, 0.12)", borderRadius: "10px", padding: "24px", display: "flex", justifyContent: "center" }}>
                <CategoryRadarChart categories={analytics.categories} />
              </div>
            )}

            {/* View: Rating Distribution */}
            {categoryChartView === "DISTRIBUTION" && (
              <div style={{ background: "rgba(10, 22, 40, 0.4)", border: "1px solid rgba(96, 165, 250, 0.12)", borderRadius: "10px", padding: "22px" }}>
                <CategoryDistributionChart categories={analytics.categories} />
              </div>
            )}

            {/* View: Circular Gauges */}
            {categoryChartView === "GAUGES" && (
              <div style={{ background: "rgba(10, 22, 40, 0.4)", border: "1px solid rgba(96, 165, 250, 0.12)", borderRadius: "10px", padding: "24px" }}>
                <CategoryRadialGauges categories={analytics.categories} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Project-wise Analytics (Added Section D) ────────────────────── */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          boxShadow: "0 4px 18px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
              Project-wise CSAT Performance
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
              Response rates and average satisfaction ratings calculated from completed stakeholder surveys.
            </p>
          </div>

          <div style={{ display: "inline-flex", background: "rgba(10, 22, 40, 0.6)", borderRadius: "8px", padding: "3px" }}>
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
                background: projectAttentionFilter === "ALL" ? "rgba(37, 99, 235, 0.3)" : "transparent",
                color: projectAttentionFilter === "ALL" ? "#60a5fa" : "var(--text-muted, #94a3b8)",
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
                background: projectAttentionFilter === "ATTENTION" ? "rgba(239, 68, 68, 0.2)" : "transparent",
                color: projectAttentionFilter === "ATTENTION" ? "#fca5a5" : "var(--text-muted, #94a3b8)",
              }}
            >
              Needs Attention ({analytics?.projects?.filter((p) => p.has_low_rating || p.has_pending).length || 0})
            </button>
          </div>
        </div>

        {analyticsLoading ? (
          <div style={{ padding: "40px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
            <Spinner size="md" />
            <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>Loading project analytics...</span>
          </div>
        ) : projectMetricsList.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "13px" }}>
            No project metrics match the current view.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "rgba(10, 22, 40, 0.7)", borderBottom: "1px solid rgba(96, 165, 250, 0.15)", color: "var(--text-dim, #64748b)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Project / Client</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Surveys Sent</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Responses</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, minWidth: "160px" }}>Response Rate</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Average CSAT</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectMetricsList.map((p) => {
                  const hasRating = p.average_csat !== null;
                  return (
                    <tr
                      key={p.project_id}
                      style={{ borderBottom: "1px solid rgba(96, 165, 250, 0.08)", transition: "background 0.15s ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(14, 30, 50, 0.35)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <Link
                          to={`/projects/${p.project_id}`}
                          style={{ fontWeight: 600, color: "var(--primary-lt, #60a5fa)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <span>{p.project_name}</span>
                          <span style={{ fontSize: "10px" }}>↗</span>
                        </Link>
                        <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                          {p.client_name}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                        {p.surveys_sent}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontWeight: 600, color: "var(--success, #22c55e)" }}>{p.submitted_responses}</span>
                        {p.awaiting_responses > 0 && (
                          <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", marginLeft: "6px" }}>
                            ({p.awaiting_responses} pending)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, minWidth: "36px", color: "#e2e8f0" }}>
                            {p.response_rate}%
                          </span>
                          <div style={{ flex: 1, height: "6px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "3px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${p.response_rate}%`,
                                background: p.response_rate >= 70 ? "#22c55e" : p.response_rate >= 40 ? "#38bdf8" : "#f59e0b",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
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
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION E: EXACT ORIGINAL SURVEY REGISTRY (100% UNCHANGED) ──── */}
      {/* Filter and Search Bar */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(14, 28, 48, 0.8) 0%, rgba(10, 20, 36, 0.9) 100%)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.22))",
          borderRadius: "var(--radius-lg, 14px)",
          padding: "16px 20px",
          display: "flex",
          gap: "14px",
          alignItems: "center",
          flexWrap: "wrap",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
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
      <div
        style={{
          background: "linear-gradient(180deg, rgba(13, 27, 42, 0.95) 0%, rgba(10, 20, 36, 0.98) 100%)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.22))",
          borderRadius: "var(--radius-lg, 14px)",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
        }}
      >
        {loading ? (
          <div style={{ padding: "60px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <Spinner size="lg" />
            <span style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)" }}>Loading surveys...</span>
          </div>
        ) : error ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#fca5a5" }}>
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={() => fetchSurveys(true)} style={{ marginTop: "12px" }}>
              Retry
            </Button>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
            <div style={{ fontSize: "36px", opacity: 0.5 }}>📋</div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-white, #ffffff)", margin: 0 }}>
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
                    background: "rgba(10, 22, 40, 0.95)",
                    borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.18))",
                    color: "var(--text-dim, #64748b)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Client & Project</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Phase</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Client Contact</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Sent Date</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>RESPONSE STATUS</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSurveys.map((survey) => {
                  const isCompleted = survey.status === "Completed";
                  const isResponded = survey.response_status === "responded" || (isCompleted && Boolean(survey.completed_at));
                  const isExportingThis = exportingSurveyId === survey.id;
                  const surveyStatus = getSurveyStatus(survey);
                  const fullUrl = `${window.location.origin}/s/${survey.unique_token}`;
                  const shortDisplayUrl = `.../s/${survey.unique_token.substring(0, 8)}...`;

                  return (
                    <tr
                      key={survey.id}
                      style={{
                        borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.08))",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(96, 165, 250, 0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Client & Project with role-guarded link to inside project analytics */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                          {survey.client?.name || "Client"}
                        </div>
                        {survey.project ? (
                          user?.role === "Admin" ? (
                            <Link
                              to={`/projects/${survey.project.id}`}
                              style={{
                                fontSize: "12px",
                                color: "var(--primary-lt, #60a5fa)",
                                marginTop: "2px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                textDecoration: "none",
                                fontWeight: 500,
                              }}
                              title="View project analytics dashboard"
                            >
                              <span>{survey.project.name}</span>
                              <span style={{ fontSize: "10px" }}>↗</span>
                            </Link>
                          ) : (
                            <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                              {survey.project.name}
                            </div>
                          )
                        ) : (
                          <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>—</div>
                        )}
                      </td>

                      {/* Phase */}
                      <td style={{ padding: "14px 18px" }}>
                        <Badge variant="count">{survey.phase}</Badge>
                      </td>

                      {/* Single Unified Status */}
                      <td style={{ padding: "14px 18px" }}>
                        <Badge variant={surveyStatus.variant}>
                          {surveyStatus.label}
                        </Badge>
                      </td>

                      {/* Client Contact */}
                      <td style={{ padding: "14px 18px" }}>
                        {survey.client_contact_name ? (
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text-white, #fff)", fontSize: "12px" }}>
                              {survey.client_contact_name}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
                              {survey.client_contact_email}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", fontStyle: "italic" }}>
                            —
                          </span>
                        )}
                      </td>

                      {/* Sent Date */}
                      <td style={{ padding: "14px 18px", color: "var(--text-muted, #94a3b8)", fontSize: "12px", whiteSpace: "nowrap" }}>
                        {survey.sent_at ? new Date(survey.sent_at).toLocaleDateString() : new Date(survey.created_at).toLocaleDateString()}
                      </td>

                      {/* Response Status (Replaced CSAT Rating) */}
                      <td style={{ padding: "14px 18px" }}>
                        {isResponded ? (
                          <div
                            style={{ position: "relative", display: "inline-block" }}
                            onMouseEnter={() => setHoveredSurveyId(survey.id)}
                            onMouseLeave={() => setHoveredSurveyId(null)}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                padding: "4px 10px",
                                borderRadius: "6px",
                                background: "rgba(34, 197, 94, 0.15)",
                                color: "#22c55e",
                                border: "1px solid rgba(34, 197, 94, 0.35)",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }} />
                              Responded
                            </span>

                            {/* Hover Tooltip / Popover with accessible navigation link */}
                            {hoveredSurveyId === survey.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "calc(100% + 6px)",
                                  left: "0",
                                  background: "#0f172a",
                                  border: "1px solid rgba(96, 165, 250, 0.35)",
                                  borderRadius: "8px",
                                  padding: "8px 12px",
                                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 0 15px rgba(59, 130, 246, 0.2)",
                                  zIndex: 100,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Link
                                  to={`/responses/${survey.response_id || survey.id}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    color: "#60a5fa",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    textDecoration: "none",
                                  }}
                                  title="Open client feedback evaluation response"
                                  aria-label="View Client Response"
                                >
                                  <span>👁 View Client Response</span>
                                  <span style={{ fontSize: "11px" }}>↗</span>
                                </Link>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              padding: "4px 10px",
                              borderRadius: "6px",
                              background: "rgba(148, 163, 184, 0.1)",
                              color: "var(--text-dim, #64748b)",
                              border: "1px solid rgba(148, 163, 184, 0.2)",
                            }}
                          >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#64748b" }} />
                            Awaiting Response
                          </span>
                        )}
                      </td>

                      {/* Actions: Shortened URL Link with copy/open + Matching Export CSV Button */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                          {/* Trigger / Resend Email Button */}
                          {survey.client_contact_email && survey.status !== "Completed" && (
                            <ResendMailButton
                              onClick={() => handleResendEmail(survey)}
                              loading={resendingSurveyId === survey.id}
                              title={`Trigger/Resend invitation email to ${survey.client_contact_email}`}
                            />
                          )}

                          {/* Redesigned Export CSV Button */}
                          <ExportCsvButton
                            onClick={() => handleExportSingleSurvey(survey, "csv")}
                            loading={isExportingThis}
                            title={`Export survey results for ${survey.project?.name || "Project"} as CSV`}
                          />

                          {/* Quick preview open in new tab */}
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open client response form in new tab"
                            style={{
                              color: "var(--text-dim, #64748b)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "32px",
                              height: "32px",
                              borderRadius: "6px",
                              border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                              background: "var(--bg-hover, rgba(10, 22, 40, 0.5))",
                              textDecoration: "none",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "var(--primary-lt, #93c5fd)";
                              e.currentTarget.style.borderColor = "var(--border-strong, rgba(96, 165, 250, 0.4))";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--text-dim, #64748b)";
                              e.currentTarget.style.borderColor = "var(--border, rgba(96, 165, 250, 0.15))";
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
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

      {/* Response Follow-up Modal (Original preserved) */}
      {followupModalSurvey && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
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
              background: "#0d1b2a",
              border: "1px solid rgba(96, 165, 250, 0.3)",
              borderRadius: "12px",
              padding: "26px",
              maxWidth: "600px",
              width: "100%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ color: "#ffffff", margin: 0, fontSize: "17px", fontWeight: 700 }}>
                Send Follow-up Email
              </h3>
              <button
                type="button"
                onClick={() => setFollowupModalSurvey(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "20px", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <p style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Send an acknowledgment email to <strong>{followupModalSurvey.client_contact_name}</strong> ({followupModalSurvey.client_contact_email}) regarding their {followupModalSurvey.phase} evaluation.
            </p>

            <textarea
              value={followupMessage}
              onChange={(e) => setFollowupMessage(e.target.value)}
              rows={8}
              style={{
                width: "100%",
                background: "rgba(10, 22, 40, 0.8)",
                border: "1px solid rgba(96, 165, 250, 0.3)",
                borderRadius: "8px",
                color: "#e2e8f0",
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
