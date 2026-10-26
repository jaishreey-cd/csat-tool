import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import surveysApi from "../api/surveysApi";
import analyticsApi, { sanitizeFilename } from "../api/analyticsApi";
import { SURVEY_PHASES } from "../data/questionBank";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";
import { ResendMailButton, ExportCsvButton } from "../components/SurveyActionButtons";

export default function UserResultsPage() {
  const [surveys, setSurveys] = useState(() => {
    const cached = surveysApi.getCachedSurveys();
    return cached?.surveys || [];
  });
  const [loading, setLoading] = useState(() => {
    return !surveysApi.getCachedSurveys();
  });
  const [exportingId, setExportingId] = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [filterPhase, setFilterPhase] = useState("ALL");

  const loadSurveys = async (force = false) => {
    const cached = surveysApi.getCachedSurveys();
    if (cached && !force && surveys.length === 0) {
      setSurveys(cached.surveys || []);
      setLoading(false);
    }

    try {
      if (surveys.length === 0 || force) {
        setLoading(true);
      }
      const res = await surveysApi.getSurveys({}, force);
      setSurveys(res.surveys || []);
    } catch (err) {
      if (surveys.length === 0) {
        setToast({ message: "Failed to load authorized survey results.", type: "danger" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, []);

  const handleResendEmail = async (survey) => {
    if (!survey.client_contact_email) return;
    try {
      setSendingEmailId(survey.id);
      await surveysApi.dispatchSurvey(survey.id, {
        client_contact_name: survey.client_contact_name || "Client Stakeholder",
        client_contact_email: survey.client_contact_email,
      });
      setToast({
        message: `Survey invitation email successfully triggered to ${survey.client_contact_email}!`,
        type: "success",
      });
    } catch (err) {
      setToast({
        message: err?.response?.data?.detail || "Failed to trigger email to client.",
        type: "danger",
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleExportCsv = async (survey) => {
    try {
      setExportingId(survey.id);
      await analyticsApi.exportSurveysRegistry({
        survey_id: survey.id,
        format: "csv",
      });
      const projName = sanitizeFilename(survey.project?.name || "Survey_Results");
      setToast({ message: `Exported ${projName}.csv successfully.`, type: "success" });
    } catch (err) {
      setToast({ message: "Failed to download export file.", type: "danger" });
    } finally {
      setExportingId(null);
    }
  };



  const filteredSurveys = useMemo(() => {
    return surveys.filter((s) => {
      if (filterPhase === "ALL") return true;
      return s.phase === filterPhase;
    });
  }, [surveys, filterPhase]);

  const stats = useMemo(() => {
    const total = surveys.length;
    const completed = surveys.filter((s) => s.status === "Completed").length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [surveys]);

  return (
    <div style={{ padding: "32px 36px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            My Survey Results & Performance
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "6px" }}>
            Real-time CSAT feedback, response rates, and client ratings for your authorized surveys.
          </p>
        </div>
        <Button variant="secondary" onClick={() => loadSurveys(true)} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Results"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "var(--bg-kpi-card)",
            padding: "22px 20px 20px 20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, var(--primary), var(--secondary-accent))" }} />
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Authorized Surveys</div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px", letterSpacing: "-0.5px" }}>{stats.total}</div>
        </div>

        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "var(--bg-kpi-card)",
            padding: "22px 20px 20px 20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #10b981, #34d399)" }} />
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Completed Responses</div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: "var(--success)", marginTop: "4px", letterSpacing: "-0.5px" }}>
            {stats.completed}
          </div>
        </div>

        <div
          className="interactive-card"
          style={{
            position: "relative",
            background: "var(--bg-kpi-card)",
            padding: "22px 20px 20px 20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #f59e0b, #fbbf24)" }} />
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Awaiting Client Feedback</div>
          <div style={{ fontSize: "30px", fontWeight: 800, color: "var(--primary)", marginTop: "4px", letterSpacing: "-0.5px" }}>
            {stats.pending}
          </div>
        </div>
      </div>

      {/* Survey Results Table */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "22px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.2px" }}>
            Survey Registry
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>Filter Phase:</label>
            <select
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value)}
              style={{
                padding: "7px 12px",
                borderRadius: "8px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 500,
                outline: "none",
              }}
            >
              <option value="ALL">All Phases</option>
              {SURVEY_PHASES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && surveys.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}><Spinner size="lg" /></div>
        ) : filteredSurveys.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
            No surveys found. Navigate to "Create Survey" to configure and dispatch your first survey.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--bg-table-header)", borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Client</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Project</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Phase</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Average CSAT</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Client Contact</th>
                  <th style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSurveys.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: "1px solid var(--table-row-border)",
                      color: "var(--text-primary)",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-table-row-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{s.client?.name || "—"}</td>
                    <td style={{ padding: "12px" }}>{s.project?.name || "—"}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: "var(--primary-badge-bg)", color: "var(--primary)" }}>
                        {s.phase}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <Badge variant={s.status === "Completed" ? "success" : s.status === "Sent" ? "info" : "neutral"}>
                        {s.status}
                      </Badge>
                    </td>
                    <td style={{ padding: "12px", fontWeight: 700, color: s.average_score ? "var(--success)" : "var(--text-muted)" }}>
                      {s.average_score ? `${Number(s.average_score).toFixed(2)} ★` : "—"}
                    </td>
                    <td style={{ padding: "12px", color: "var(--text-secondary)" }}>
                      {s.client_contact_email || "—"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>

                        {s.client_contact_email && s.status !== "Completed" && (
                          <ResendMailButton
                            onClick={() => handleResendEmail(s)}
                            loading={sendingEmailId === s.id}
                            title={`Trigger/Resend survey invitation email to ${s.client_contact_email}`}
                          />
                        )}
                        {s.status === "Completed" && (
                          <Link
                            to={`/responses/${s.id}`}
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
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "var(--primary)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "var(--border)";
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            View Response
                          </Link>
                        )}
                        <ExportCsvButton
                          onClick={() => handleExportCsv(s)}
                          loading={exportingId === s.id}
                          title={`Export survey results for ${s.project?.name || "Project"} as CSV`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast.message && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "info" })} />
      )}
    </div>
  );
}
