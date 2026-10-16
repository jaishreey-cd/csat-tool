import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import surveysApi from "../api/surveysApi";
import clientsApi from "../api/clientsApi";
import analyticsApi from "../api/analyticsApi";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Input from "../components/Input";
import Select from "../components/Select";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";
import { SURVEY_PHASES } from "../data/questionBank";

export default function SurveysPage() {
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

  // Response Follow-up Modal State
  const [followupModalSurvey, setFollowupModalSurvey] = useState(null);
  const [followupMessage, setFollowupMessage] = useState("");
  const [sendingFollowup, setSendingFollowup] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  // Export state per survey
  const [exportingSurveyId, setExportingSurveyId] = useState(null);

  // Hover state for Responded popover
  const [hoveredSurveyId, setHoveredSurveyId] = useState(null);

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

  // Handle Export per individual survey
  const handleExportSingleSurvey = async (survey, format = "xlsx") => {
    setExportingSurveyId(survey.id);
    try {
      await analyticsApi.exportSurveysRegistry({ survey_id: survey.id }, format);
      setToast({
        message: `Successfully exported survey for ${survey.project?.name || "Project"} (${format.toUpperCase()})`,
        type: "success",
      });
    } catch (err) {
      console.error("Export failed:", err);
      setToast({ message: "Failed to export survey. Please try again.", type: "danger" });
    } finally {
      setExportingSurveyId(null);
    }
  };

  // Follow-up modal
  const openFollowupModal = (survey) => {
    setFollowupModalSurvey(survey);
    setFollowupMessage(
      `Dear ${survey.client_contact_name || "Client"},\n\nThank you for submitting your evaluation for ${survey.project?.name || "our engagement"} (${survey.phase}).\n\nOur delivery team has reviewed your feedback and is taking action on the insights provided.\n\nWarm regards,\nPMO Team`
    );
  };

  const handleSendFollowup = async () => {
    if (!followupModalSurvey) return;
    setSendingFollowup(true);
    try {
      await surveysApi.sendResponseFollowup(followupModalSurvey.id, followupMessage);
      setToast({ message: "Response follow-up email sent successfully!", type: "success" });
      setFollowupModalSurvey(null);
      fetchSurveys(true);
    } catch (err) {
      console.error("Failed to send follow-up:", err);
      setToast({ message: "Failed to send follow-up email. Please check network.", type: "danger" });
    } finally {
      setSendingFollowup(false);
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
      if (selectedStatus !== "ALL" && s.status !== selectedStatus) {
        return false;
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

        <div style={{ width: "160px" }}>
          <Select
            id="statusFilter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "Sent", label: "Dispatched" },
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
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>RESPONSE STATUS</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSurveys.map((survey) => {
                  const isSent = survey.status === "Sent";
                  const isCompleted = survey.status === "Completed";
                  const isResponded = survey.response_status === "responded" || (isCompleted && Boolean(survey.completed_at));
                  const isExportingThis = exportingSurveyId === survey.id;

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
                      {/* Client & Project with link to inside project analytics */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                          {survey.client?.name || "Client"}
                        </div>
                        {survey.project ? (
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
                          <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>—</div>
                        )}
                      </td>

                      {/* Phase */}
                      <td style={{ padding: "14px 18px" }}>
                        <Badge variant="count">{survey.phase}</Badge>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        {isSent && (
                          <Badge variant="info">
                            Dispatched
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge variant="success">Completed</Badge>
                        )}
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

                      {/* Actions: Export Survey & Follow-up */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                          {/* Export Button inside every survey row */}
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isExportingThis}
                            onClick={() => handleExportSingleSurvey(survey, "xlsx")}
                            title="Export survey data to Excel"
                          >
                            {isExportingThis ? "Exporting..." : "📥 Export"}
                          </Button>

                          {/* Follow-up email for completed surveys */}
                          {isCompleted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openFollowupModal(survey)}
                              title="Send follow-up response email to client stakeholder"
                            >
                              ✉ Follow-up
                            </Button>
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

      {/* Response Follow-up Modal */}
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
