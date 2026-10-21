import { useState, useEffect, useMemo } from "react";
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
import { SURVEY_PHASES } from "../data/questionBank";

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

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedPhase, setSelectedPhase] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedClientFilter, setSelectedClientFilter] = useState("ALL");

  const [toast, setToast] = useState({ message: "", type: "info" });
  const [copiedSurveyId, setCopiedSurveyId] = useState(null);

  // Export state per survey
  const [exportingSurveyId, setExportingSurveyId] = useState(null);

  // Fetch surveys and clients independently
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
  }, []);

  // Handle Export per individual survey (CSV format named <projectName>.csv)
  const handleExportSingleSurvey = async (survey, format = "csv") => {
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

  // Copy full survey response URL to clipboard
  const handleCopySurveyUrl = async (survey) => {
    const fullUrl = `${window.location.origin}/s/${survey.unique_token}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        const input = document.createElement("input");
        input.value = fullUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopiedSurveyId(survey.id);
      setTimeout(() => setCopiedSurveyId(null), 2500);
      setToast({ message: "Survey link copied to clipboard!", type: "success" });
    } catch (err) {
      console.error("Failed to copy link:", err);
      setToast({ message: "Unable to copy link to clipboard.", type: "danger" });
    }
  };

  // Filter dispatched and completed surveys (Drafts belong to /drafts)
  const activeSurveys = useMemo(() => {
    return surveys.filter((s) => s.status !== "Draft");
  }, [surveys]);

  // KPIs across active surveys
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

  // Filtered surveys
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

  return (
    <div style={{ padding: "28px", maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Toast Notification */}
      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "info" })}
        />
      )}

      {/* Main Header */}
      <div>
        <h2 style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-white, #ffffff)", margin: 0, letterSpacing: "-0.4px" }}>
          CSAT Dashboard & Analytics
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
          Team-wide customer satisfaction evaluations, performance tracking, and responses.
        </p>
      </div>

      {/* Team-wide Analytics Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Overall CSAT Score */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 600, textTransform: "uppercase" }}>
            Overall CSAT Score
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <span style={{ fontSize: "32px", fontWeight: 800, color: "#60a5fa" }}>
              {kpis.percentageScore != null ? `${kpis.percentageScore}%` : "—"}
            </span>
            {kpis.avgScore != null && (
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#fbbf24" }}>
                ★ {kpis.avgScore.toFixed(2)} / 5.0
              </span>
            )}
          </div>
        </div>

        {/* Total Dispatched */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 600, textTransform: "uppercase" }}>
            Dispatched Surveys
          </span>
          <span style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-white, #ffffff)" }}>
            {kpis.total}
          </span>
        </div>

        {/* Responses Completed */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 600, textTransform: "uppercase" }}>
            Completed Responses
          </span>
          <span style={{ fontSize: "32px", fontWeight: 800, color: "var(--success, #22c55e)" }}>
            {kpis.completed}
          </span>
        </div>

        {/* Response Rate */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 600, textTransform: "uppercase" }}>
            Response Rate
          </span>
          <span style={{ fontSize: "32px", fontWeight: 800, color: "#38bdf8" }}>
            {kpis.responseRate}%
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "16px 20px",
          display: "flex",
          gap: "14px",
          alignItems: "center",
          flexWrap: "wrap",
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
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
          borderRadius: "var(--radius-lg, 12px)",
          overflow: "hidden",
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
                    background: "rgba(10, 22, 40, 0.8)",
                    borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
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
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>CSAT Rating</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSurveys.map((survey) => {
                  const isCompleted = survey.status === "Completed";
                  const isExportingThis = exportingSurveyId === survey.id;
                  const surveyStatus = getSurveyStatus(survey);
                  const fullUrl = `${window.location.origin}/s/${survey.unique_token}`;
                  const shortDisplayUrl = `.../s/${survey.unique_token.substring(0, 8)}...`;

                  return (
                    <tr
                      key={survey.id}
                      style={{
                        borderBottom: "1px solid rgba(96, 165, 250, 0.08)",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(14, 30, 50, 0.45)")}
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

                      {/* CSAT Rating */}
                      <td style={{ padding: "14px 18px" }}>
                        {isCompleted && survey.average_score != null ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#fbbf24" }}>
                              ★ {survey.average_score.toFixed(1)}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
                              ({Math.round((survey.average_score / 5.0) * 100)}%)
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: "13px", color: "var(--text-dim, #64748b)" }}>
                            —
                          </span>
                        )}
                      </td>

                      {/* Actions: Shortened URL Link with copy/open + Matching Export CSV Button */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", justifyContent: "flex-end" }}>
                          {/* Truncated URL with tooltip hover, copy and open actions */}
                          <div
                            title={fullUrl}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              background: "rgba(10, 22, 40, 0.7)",
                              border: "1px solid rgba(96, 165, 250, 0.2)",
                              borderRadius: "6px",
                              padding: "4px 8px",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: "11px",
                                color: "#93c5fd",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {shortDisplayUrl}
                            </span>

                            {/* Copy full URL */}
                            <button
                              type="button"
                              onClick={() => handleCopySurveyUrl(survey)}
                              title={`Copy full URL: ${fullUrl}`}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: copiedSurveyId === survey.id ? "#34d399" : "#60a5fa",
                                cursor: "pointer",
                                padding: "2px",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              {copiedSurveyId === survey.id ? (
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#34d399" }}>✓</span>
                              ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                              )}
                            </button>

                            {/* Open in new tab */}
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open client response form in new tab"
                              style={{
                                color: "#94a3b8",
                                display: "flex",
                                alignItems: "center",
                                textDecoration: "none",
                                padding: "2px",
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </a>
                          </div>

                          {/* Redesigned Export CSV Button */}
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isExportingThis}
                            onClick={() => handleExportSingleSurvey(survey, "csv")}
                            title={`Export survey results for ${survey.project?.name || "Project"} as CSV`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>{isExportingThis ? "Exporting..." : "Export CSV"}</span>
                          </Button>
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
    </div>
  );
}
