import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import surveysApi from "../api/surveysApi";
import clientsApi from "../api/clientsApi";
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

  // Dispatch Modal State
  const [dispatchModalSurvey, setDispatchModalSurvey] = useState(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState("");
  const [dispatchSuccess, setDispatchSuccess] = useState("");
  const [copiedToken, setCopiedToken] = useState(null);

  // Reminder & Follow-up State
  const [remindingId, setRemindingId] = useState(null);
  const [checkingFollowups, setCheckingFollowups] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });

  // Questions Detail Modal State
  const [detailsModalSurvey, setDetailsModalSurvey] = useState(null);

  // Fetch surveys and clients independently with stale-while-revalidate pattern
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

  // Filtered surveys
  const filteredSurveys = useMemo(() => {
    return surveys.filter((s) => {
      // Search
      const searchLower = searchQuery.toLowerCase().trim();
      const codeMatch = s.survey_code?.toLowerCase().includes(searchLower);
      const clientMatch = s.client?.name?.toLowerCase().includes(searchLower);
      const projectMatch = s.project?.name?.toLowerCase().includes(searchLower) || s.project?.project_code?.toLowerCase().includes(searchLower);
      const contactMatch = s.client_contact_name?.toLowerCase().includes(searchLower) || s.client_contact_email?.toLowerCase().includes(searchLower);
      const matchesSearch = !searchLower || codeMatch || clientMatch || projectMatch || contactMatch;

      // Phase
      const matchesPhase = selectedPhase === "ALL" || s.phase === selectedPhase;

      // Status
      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "Ready" && (s.status === "Ready" || s.status === "Draft")) ||
        s.status === selectedStatus;

      // Client
      const matchesClient = selectedClientFilter === "ALL" || String(s.client_id) === String(selectedClientFilter);

      return matchesSearch && matchesPhase && matchesStatus && matchesClient;
    });
  }, [surveys, searchQuery, selectedPhase, selectedStatus, selectedClientFilter]);

  // KPI counts
  const kpis = useMemo(() => {
    const total = surveys.length;
    const ready = surveys.filter((s) => s.status === "Ready" || s.status === "Draft").length;
    const sent = surveys.filter((s) => s.status === "Sent").length;
    const completed = surveys.filter((s) => s.status === "Completed").length;
    const overdue = surveys.filter((s) => {
      if (s.status !== "Sent" || !s.sent_at) return false;
      const days = (Date.now() - new Date(s.sent_at).getTime()) / (1000 * 60 * 60 * 24);
      return days >= 7;
    }).length;
    return { total, ready, sent, completed, overdue };
  }, [surveys]);

  // Send single on-demand reminder email
  const handleSendReminder = async (surveyId) => {
    setRemindingId(surveyId);
    try {
      const updated = await surveysApi.sendReminder(surveyId);
      setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setToast({
        message: `Reminder email successfully dispatched to ${updated.client_contact_email}!`,
        type: "success",
      });
    } catch (err) {
      setToast({
        message: err?.response?.data?.detail || "Failed to send reminder email.",
        type: "error",
      });
    } finally {
      setRemindingId(null);
    }
  };

  // Run automated 7-day follow-up check across all pending surveys
  const handleCheckFollowups = async () => {
    setCheckingFollowups(true);
    try {
      const res = await surveysApi.checkFollowups(7);
      await fetchSurveys(true);
      setToast({
        message: `Follow-up scanner completed: ${res.reminded_count} reminder email(s) dispatched.`,
        type: "success",
      });
    } catch (err) {
      setToast({
        message: err?.response?.data?.detail || "Failed to run automated follow-up scanner.",
        type: "error",
      });
    } finally {
      setCheckingFollowups(false);
    }
  };

  // Open Dispatch Modal
  const openDispatchModal = (survey) => {
    setDispatchModalSurvey(survey);
    setContactName(survey.client_contact_name || "");
    setContactEmail(survey.client_contact_email || "");
    setDispatchError("");
    setDispatchSuccess("");
  };

  // Close Dispatch Modal
  const closeDispatchModal = () => {
    setDispatchModalSurvey(null);
    setContactName("");
    setContactEmail("");
    setDispatchError("");
    setDispatchSuccess("");
  };

  // Submit Dispatch
  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim()) {
      setDispatchError("Please provide both contact name and a valid email address.");
      return;
    }

    setDispatching(true);
    setDispatchError("");
    setDispatchSuccess("");

    try {
      const updated = await surveysApi.dispatchSurvey(dispatchModalSurvey.id, {
        client_contact_name: contactName.trim(),
        client_contact_email: contactEmail.trim(),
      });

      // Update surveys in place
      setSurveys((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      setDispatchModalSurvey(updated);
      setDispatchSuccess(`Survey link successfully dispatched to ${contactEmail.trim()}!`);
    } catch (err) {
      setDispatchError(err?.response?.data?.detail || "Failed to dispatch survey. Please retry.");
    } finally {
      setDispatching(false);
    }
  };

  // Copy survey link to clipboard
  const handleCopyLink = (token) => {
    const publicUrl = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
            Surveys
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
            Manage satisfaction surveys, dispatch client evaluation links, and track live response completion.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            size="md"
            onClick={handleCheckFollowups}
            disabled={checkingFollowups}
            title="Scan all surveys pending >= 7 days and send automated reminder emails"
          >
            {checkingFollowups ? "Scanning..." : "⚡ Scan 7-Day Follow-ups"}
          </Button>

          <Link to="/surveys/new">
            <Button variant="primary" size="md">
              + Create Survey
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 600, textTransform: "uppercase" }}>
            Total Surveys
          </span>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-white, #ffffff)" }}>
            {kpis.total}
          </span>
        </div>

        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 600, textTransform: "uppercase" }}>
            Ready to Dispatch
          </span>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "#f59e0b" }}>
            {kpis.ready}
          </span>
        </div>

        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid rgba(96, 165, 250, 0.3)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--primary-lt, #60a5fa)", fontWeight: 600, textTransform: "uppercase" }}>
            Dispatched (Pending Client)
          </span>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--primary-lt, #60a5fa)" }}>
            {kpis.sent}
          </span>
        </div>

        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--success, #22c55e)", fontWeight: 600, textTransform: "uppercase" }}>
            Completed Evaluations
          </span>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--success, #22c55e)" }}>
            {kpis.completed}
          </span>
        </div>

        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: kpis.overdue > 0 ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--border, rgba(96, 165, 250, 0.15))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "12px", color: kpis.overdue > 0 ? "#f87171" : "var(--text-muted, #94a3b8)", fontWeight: 600, textTransform: "uppercase" }}>
            Overdue (≥ 7 Days)
          </span>
          <span style={{ fontSize: "28px", fontWeight: 800, color: kpis.overdue > 0 ? "#ef4444" : "var(--text-white, #ffffff)" }}>
            {kpis.overdue}
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
            placeholder="Search by code, client, project, or contact..."
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
              { value: "Ready", label: "Ready" },
              { value: "Sent", label: "Sent" },
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
            <Button variant="secondary" size="sm" onClick={fetchSurveys} style={{ marginTop: "12px" }}>
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
                ? "No satisfaction surveys have been created yet. Click '+ Create Survey' to configure your first survey."
                : "No surveys match your current search and filter criteria."}
            </p>
            {surveys.length === 0 && (
              <Link to="/surveys/new">
                <Button variant="primary" size="md">
                  + Create First Survey
                </Button>
              </Link>
            )}
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
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Survey Code</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Client & Project</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Phase</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Questions</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Client Contact</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Created</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSurveys.map((survey) => {
                  const isReady = survey.status === "Ready" || survey.status === "Draft";
                  const isSent = survey.status === "Sent";
                  const isCompleted = survey.status === "Completed";

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
                      {/* Survey Code */}
                      <td style={{ padding: "14px 18px" }}>
                        <code
                          style={{
                            color: "var(--primary-lt, #60a5fa)",
                            fontWeight: 700,
                            fontSize: "12px",
                            background: "rgba(37, 99, 235, 0.12)",
                            padding: "3px 7px",
                            borderRadius: "5px",
                            border: "1px solid rgba(96, 165, 250, 0.2)",
                          }}
                        >
                          {survey.survey_code}
                        </code>
                      </td>

                      {/* Client & Project */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                          {survey.client?.name || "Client"}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                          {survey.project?.name} ({survey.project?.project_code})
                        </div>
                      </td>

                      {/* Phase */}
                      <td style={{ padding: "14px 18px" }}>
                        <Badge variant="count">{survey.phase}</Badge>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        {isReady && <Badge variant="active">Ready</Badge>}
                        {isSent && (
                          <div>
                            {(() => {
                              const daysPending = survey.sent_at
                                ? Math.floor((Date.now() - new Date(survey.sent_at).getTime()) / (1000 * 60 * 60 * 24))
                                : 0;
                              const isOverdue = daysPending >= 7;

                              return (
                                <>
                                  <Badge variant={isOverdue ? "warning" : "info"}>
                                    {isOverdue ? `● Overdue (${daysPending}d)` : `Dispatched (${daysPending}d)`}
                                  </Badge>
                                  {survey.followup_sent_at && (
                                    <span style={{ fontSize: "11px", color: "#fbbf24", display: "block", marginTop: "4px", fontWeight: 500 }}>
                                      🔔 Reminded {new Date(survey.followup_sent_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {isCompleted && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Badge variant="success">Completed</Badge>
                            {survey.average_score && (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24" }}>
                                ★ {survey.average_score}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Questions Count */}
                      <td style={{ padding: "14px 18px" }}>
                        <button
                          type="button"
                          onClick={() => setDetailsModalSurvey(survey)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--primary-lt, #60a5fa)",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "12px",
                            padding: 0,
                            textDecoration: "underline",
                          }}
                        >
                          {survey.questions?.length || 0} Questions
                        </button>
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
                            Not dispatched
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td style={{ padding: "14px 18px", color: "var(--text-muted, #94a3b8)", fontSize: "12px", whiteSpace: "nowrap" }}>
                        {new Date(survey.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                          {isReady && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openDispatchModal(survey)}
                            >
                              Dispatch Link
                            </Button>
                          )}

                          {survey.unique_token && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleCopyLink(survey.unique_token)}
                                title="Copy public response link"
                              >
                                {copiedToken === survey.unique_token ? "✓ Copied" : "Copy Link"}
                              </Button>

                              <a
                                href={`/s/${survey.unique_token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: "none" }}
                              >
                                <Button variant="ghost" size="sm" title="Open client survey portal">
                                  ↗ Open Form
                                </Button>
                              </a>
                            </>
                          )}

                          {isSent && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSendReminder(survey.id)}
                                disabled={remindingId === survey.id}
                                title="Send reminder email to client contact"
                              >
                                {remindingId === survey.id ? "Sending..." : "🔔 Remind"}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDispatchModal(survey)}
                                title="Update client contact details"
                              >
                                Edit Contact
                              </Button>
                            </>
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

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: DISPATCH SURVEY TO CLIENT
         ───────────────────────────────────────────────────────────── */}
      {dispatchModalSurvey && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={closeDispatchModal}
        >
          <div
            style={{
              background: "var(--bg-surface, #0d1b2a)",
              border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
              borderRadius: "var(--radius-lg, 14px)",
              padding: "28px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                Dispatch Survey Link
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                Generate a unique secure link for the client stakeholder to submit their CSAT feedback.
              </p>
            </div>

            {/* Target Survey Pill */}
            <div
              style={{
                background: "rgba(10, 22, 40, 0.6)",
                border: "1px solid rgba(96, 165, 250, 0.15)",
                borderRadius: "var(--radius-md, 8px)",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim, #64748b)" }}>Survey Code:</span>
                <strong style={{ color: "var(--primary-lt, #60a5fa)" }}>{dispatchModalSurvey.survey_code}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim, #64748b)" }}>Project:</span>
                <span style={{ color: "var(--text-white, #ffffff)", fontWeight: 600 }}>
                  {dispatchModalSurvey.project?.name} ({dispatchModalSurvey.phase})
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim, #64748b)" }}>Client:</span>
                <span style={{ color: "var(--text-white, #ffffff)" }}>{dispatchModalSurvey.client?.name}</span>
              </div>
            </div>

            {/* Public Survey Link Box (Shown Here) */}
            {dispatchModalSurvey.unique_token && (
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(13, 27, 42, 0.95) 100%)",
                  border: "1px solid rgba(96, 165, 250, 0.28)",
                  borderRadius: "var(--radius-md, 8px)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-lt, #60a5fa)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    🔗 Public Survey Link
                  </span>
                  <Badge variant={dispatchModalSurvey.status === "Sent" ? "info" : "active"}>
                    {dispatchModalSurvey.status === "Sent" ? "Dispatched" : "Ready"}
                  </Badge>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/s/${dispatchModalSurvey.unique_token}`}
                    style={{
                      flex: 1,
                      background: "rgba(10, 22, 40, 0.8)",
                      border: "1px solid rgba(96, 165, 250, 0.25)",
                      borderRadius: "6px",
                      padding: "7px 10px",
                      color: "#93c5fd",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                    onClick={(e) => e.target.select()}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleCopyLink(dispatchModalSurvey.unique_token)}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {copiedToken === dispatchModalSurvey.unique_token ? "✓ Copied!" : "Copy Link"}
                  </Button>
                  <a
                    href={`/s/${dispatchModalSurvey.unique_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <Button type="button" variant="ghost" size="sm" style={{ whiteSpace: "nowrap" }}>
                      ↗ Open
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* Dispatch Success Alert & Quick Gmail Send */}
            {dispatchSuccess && (
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.35)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--success, #22c55e)", fontSize: "13px", fontWeight: 600 }}>
                  <span>✓</span>
                  <span>{dispatchSuccess}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px" }}>
                  <span style={{ color: "var(--text-muted, #94a3b8)" }}>Open directly in your webmail:</span>
                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contactEmail)}&su=${encodeURIComponent(`Invitation: CSAT Evaluation for ${dispatchModalSurvey.project?.name || "Project"} (${dispatchModalSurvey.phase})`)}&body=${encodeURIComponent(`Dear ${contactName || "Client Stakeholder"},\n\nYou are invited to complete our Customer Satisfaction (CSAT) survey.\n\nPlease submit your feedback using your unique secure link below:\n${window.location.origin}/s/${dispatchModalSurvey.unique_token}\n\nClient: ${dispatchModalSurvey.client?.name || ""}\nProject: ${dispatchModalSurvey.project?.name || ""}\nPhase: ${dispatchModalSurvey.phase}\nSurvey Code: ${dispatchModalSurvey.survey_code}\n\nThank you!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "#93c5fd",
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                  >
                    ✉ Open in Gmail
                  </a>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleDispatchSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Input
                id="contactNameInput"
                label="Client Contact Name"
                placeholder="e.g. Sarah Jenkins"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />

              <Input
                id="contactEmailInput"
                label="Client Contact Email"
                type="email"
                placeholder="e.g. sjenkins@acmeglobal.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
              />

              {dispatchError && (
                <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", padding: "10px 14px", color: "#fca5a5", fontSize: "12px" }}>
                  ⚠ {dispatchError}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <Button variant="secondary" size="md" type="button" disabled={dispatching} onClick={closeDispatchModal}>
                  {dispatchSuccess ? "Done" : "Cancel"}
                </Button>
                <Button variant="primary" size="md" type="submit" loading={dispatching} disabled={dispatching}>
                  {dispatchModalSurvey.status === "Sent" ? "Update & Re-dispatch" : "Generate & Dispatch Link"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: SURVEY QUESTIONS BREAKDOWN
         ───────────────────────────────────────────────────────────── */}
      {detailsModalSurvey && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={() => setDetailsModalSurvey(null)}
        >
          <div
            style={{
              background: "var(--bg-surface, #0d1b2a)",
              border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
              borderRadius: "var(--radius-lg, 14px)",
              padding: "28px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                  Survey Questions Breakdown
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                  {detailsModalSurvey.survey_code} — {detailsModalSurvey.project?.name} ({detailsModalSurvey.phase})
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDetailsModalSurvey(null)}>
                ✕ Close
              </Button>
            </div>

            {/* Questions by Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[1, 2, 3, 4, 5, 6].map((secNum) => {
                const sectionQuestions = (detailsModalSurvey.questions || []).filter(
                  (q) => q.section_number === secNum
                );
                if (sectionQuestions.length === 0) return null;

                const firstQ = sectionQuestions[0];
                return (
                  <div
                    key={secNum}
                    style={{
                      background: "rgba(10, 22, 40, 0.6)",
                      border: "1px solid rgba(96, 165, 250, 0.12)",
                      borderRadius: "var(--radius-md, 8px)",
                      padding: "14px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--primary-lt, #60a5fa)" }}>
                        Section {secNum}: {firstQ.section_title}
                      </span>
                      <Badge variant="count">{sectionQuestions.length} Questions</Badge>
                    </div>

                    <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "13px", color: "var(--text-main, #e2e8f0)", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {sectionQuestions.map((q, idx) => (
                        <li key={idx}>
                          <span>{q.question_text}</span>
                          {q.is_custom && (
                            <span style={{ fontSize: "10px", marginLeft: "6px", color: "var(--accent, #06b6d4)", background: "rgba(6, 182, 212, 0.1)", padding: "1px 4px", borderRadius: "3px" }}>
                              Custom
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "info" })}
      />
    </div>
  );
}
