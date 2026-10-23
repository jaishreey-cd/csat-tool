import { useState, useEffect, useMemo } from "react";
import surveysApi from "../api/surveysApi";
import analyticsApi, { sanitizeFilename } from "../api/analyticsApi";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";
import { CopyLinkButton, ResendMailButton, ExportCsvButton } from "../components/SurveyActionButtons";

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
        setToast({ message: "Failed to load authorized survey results.", type: "error" });
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
        type: "error",
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
      setToast({ message: "Failed to download export file.", type: "error" });
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
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
            My Survey Results & Performance
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>
            Real-time CSAT feedback, response rates, and client ratings for your authorized surveys.
          </p>
        </div>
        <Button variant="secondary" onClick={() => loadSurveys(true)} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Results"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div style={{ background: "var(--bg-surface, #0d1b2a)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border, rgba(96, 165, 250, 0.12))" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase" }}>Authorized Surveys</div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-white, #ffffff)", marginTop: "6px" }}>{stats.total}</div>
        </div>

        <div style={{ background: "var(--bg-surface, #0d1b2a)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border, rgba(96, 165, 250, 0.12))" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase" }}>Completed Responses</div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#34d399", marginTop: "6px" }}>
            {stats.completed}
          </div>
        </div>

        <div style={{ background: "var(--bg-surface, #0d1b2a)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border, rgba(96, 165, 250, 0.12))" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#93c5fd", textTransform: "uppercase" }}>Awaiting Client Feedback</div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#60a5fa", marginTop: "6px" }}>
            {stats.pending}
          </div>
        </div>
      </div>

      {/* Survey Results Table */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
          borderRadius: "12px",
          padding: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-white, #ffffff)", margin: 0 }}>
            Survey Registry
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>Filter Phase:</label>
            <select
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                background: "var(--bg-surface, #0d1b2a)",
                border: "1px solid var(--border, rgba(96, 165, 250, 0.2))",
                color: "var(--text-main, #e2e8f0)",
                fontSize: "12px",
              }}
            >
              <option value="ALL">All Phases</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Mid-Project">Mid-Project</option>
              <option value="Post-Go-Live">Post-Go-Live</option>
              <option value="Closure">Closure</option>
            </select>
          </div>
        </div>

        {loading && surveys.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}><Spinner size="lg" /></div>
        ) : filteredSurveys.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)" }}>
            No surveys found. Navigate to "Create Survey" to configure and dispatch your first survey.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))", textAlign: "left", color: "var(--text-muted, #94a3b8)" }}>
                  <th style={{ padding: "10px 12px" }}>Client</th>
                  <th style={{ padding: "10px 12px" }}>Project</th>
                  <th style={{ padding: "10px 12px" }}>Phase</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px" }}>Average CSAT</th>
                  <th style={{ padding: "10px 12px" }}>Client Contact</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSurveys.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
                      color: "var(--text-main, #e2e8f0)",
                    }}
                  >
                    <td style={{ padding: "12px", fontWeight: 600, color: "var(--text-white, #ffffff)" }}>{s.client?.name || "—"}</td>
                    <td style={{ padding: "12px" }}>{s.project?.name || "—"}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: "rgba(37, 99, 235, 0.15)", color: "var(--primary-lt, #2563eb)" }}>
                        {s.phase}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <Badge variant={s.status === "Completed" ? "success" : s.status === "Sent" ? "info" : "neutral"}>
                        {s.status}
                      </Badge>
                    </td>
                    <td style={{ padding: "12px", fontWeight: 700, color: s.average_score ? "var(--success, #15803d)" : "var(--text-dim, #64748b)" }}>
                      {s.average_score ? `${Number(s.average_score).toFixed(2)} ★` : "—"}
                    </td>
                    <td style={{ padding: "12px", color: "var(--text-muted, #94a3b8)" }}>
                      {s.client_contact_email || "—"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                        {s.unique_token && (
                          <CopyLinkButton
                            url={`${window.location.origin}/s/${s.unique_token}`}
                            onCopy={() => setToast({ message: "Shortened survey link copied to clipboard!", type: "success" })}
                          />
                        )}
                        {s.client_contact_email && s.status !== "Completed" && (
                          <ResendMailButton
                            onClick={() => handleResendEmail(s)}
                            loading={sendingEmailId === s.id}
                            title={`Trigger/Resend survey invitation email to ${s.client_contact_email}`}
                          />
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
