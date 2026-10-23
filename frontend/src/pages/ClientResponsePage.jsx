import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import surveysApi from "../api/surveysApi";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";

export default function ClientResponsePage() {
  const { responseId, surveyId } = useParams();
  const navigate = useNavigate();
  const targetId = responseId || surveyId;

  const [responseDetail, setResponseDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchResponse = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await surveysApi.getClientResponse(targetId);
        if (isMounted) {
          setResponseDetail(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load client response details:", err);
          setError(
            err.response?.data?.detail ||
              "Unable to load client response details. Please confirm the survey has been submitted."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (targetId) {
      fetchResponse();
    }
    return () => {
      isMounted = false;
    };
  }, [targetId]);

  const renderStars = (score) => {
    if (score == null) return <span style={{ color: "var(--text-dim, #64748b)" }}>—</span>;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          style={{
            color: i <= score ? "#fbbf24" : "rgba(148, 163, 184, 0.25)",
            fontSize: "16px",
            lineHeight: 1,
          }}
        >
          ★
        </span>
      );
    }
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
        {stars}
        <span style={{ marginLeft: "6px", fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
          {score} / 5
        </span>
      </div>
    );
  };

  const getScoreColor = (score) => {
    if (score == null) return "#94a3b8";
    if (score >= 4.0) return "#22c55e"; // green
    if (score >= 3.0) return "#3b82f6"; // blue
    if (score >= 2.0) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "60px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          minHeight: "60vh",
        }}
      >
        <Spinner size="lg" />
        <span style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)" }}>
          Loading submitted client feedback...
        </span>
      </div>
    );
  }

  if (error || !responseDetail) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ marginBottom: "20px" }}>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            ← Back to CSAT Dashboard
          </Button>
        </div>

        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "12px",
            padding: "36px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "32px", display: "block", marginBottom: "12px" }}>⚠️</span>
          <h3 style={{ fontSize: "18px", color: "#f87171", margin: "0 0 8px 0" }}>
            Response Not Found
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", maxWidth: "500px", margin: "0 auto 24px auto" }}>
            {error || "No client response was found for this survey instance. The survey may still be awaiting client submission."}
          </p>
          <Button variant="primary" onClick={() => navigate("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const {
    survey_code,
    client_name,
    client_contact_name,
    client_contact_email,
    project_name,
    project_code,
    phase,
    submission_date,
    overall_score,
    overall_percentage,
    sections = [],
    additional_comments = [],
  } = responseDetail;

  const totalQuestions = sections.reduce((acc, sec) => acc + (sec.questions?.length || 0), 0);
  const formattedDate = submission_date
    ? new Date(submission_date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

  return (
    <div
      style={{
        padding: "28px 24px 60px 24px",
        maxWidth: "1140px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Top Navigation & Breadcrumbs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          ← Back to CSAT Dashboard
        </Button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-dim, #64748b)" }}>
            Code: {survey_code}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: "12px",
              background: "rgba(34, 197, 94, 0.15)",
              color: "#22c55e",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            ● Responded
          </span>
        </div>
      </div>

      {/* Hero Header Card */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(13, 27, 42, 0.95) 0%, rgba(10, 22, 40, 0.95) 100%)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          borderRadius: "12px",
          padding: "28px 32px",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-white, #ffffff)", margin: 0, letterSpacing: "-0.3px" }}>
                Client Response Evaluation
              </h1>
              <Badge variant="count">{phase}</Badge>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "0 0 16px 0" }}>
              Formal Customer Satisfaction feedback submitted by the client stakeholder.
            </p>
          </div>

          {/* Overall Rating Badge / KPI in Hero */}
          {overall_score != null && (
            <div
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(251, 191, 36, 0.3)",
                borderRadius: "10px",
                padding: "14px 22px",
                textAlign: "center",
                minWidth: "150px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim, #64748b)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Overall CSAT Score
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#fbbf24", margin: "2px 0" }}>
                ★ {overall_score.toFixed(1)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 600 }}>
                {overall_percentage}% Satisfaction
              </div>
            </div>
          )}
        </div>

        {/* 4-Column Metadata Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginTop: "16px",
            paddingTop: "20px",
            borderTop: "1px solid rgba(96, 165, 250, 0.15)",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim, #64748b)", textTransform: "uppercase" }}>
              Client Organization
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-white, #ffffff)", marginTop: "4px" }}>
              {client_name}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim, #64748b)", textTransform: "uppercase" }}>
              Project
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#60a5fa", marginTop: "4px" }}>
              {project_name} {project_code ? `(${project_code})` : ""}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim, #64748b)", textTransform: "uppercase" }}>
              Client Contact
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-white, #ffffff)", marginTop: "4px" }}>
              {client_contact_name || "—"}
            </div>
            {client_contact_email && (
              <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontFamily: "monospace" }}>
                {client_contact_email}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim, #64748b)", textTransform: "uppercase" }}>
              Submission Date
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-white, #ffffff)", marginTop: "4px" }}>
              {formattedDate}
            </div>
          </div>
        </div>
      </div>

      {/* Sections & Questions Response Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {sections.map((section) => {
          const isQualitative = section.section_number === 6;
          const questions = section.questions || [];

          return (
            <div
              key={section.section_number}
              style={{
                background: "var(--bg-surface, #0d1b2a)",
                border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 4px 18px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Section Header */}
              <div
                style={{
                  padding: "16px 24px",
                  background: "rgba(10, 22, 40, 0.8)",
                  borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      background: "rgba(96, 165, 250, 0.2)",
                      color: "#93c5fd",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {section.section_number}
                  </span>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                    {section.section_title}
                  </h3>
                </div>

                {!isQualitative && section.average_score != null && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", fontWeight: 600 }}>
                      Section Average:
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: getScoreColor(section.average_score),
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(96, 165, 250, 0.2)",
                      }}
                    >
                      ★ {section.average_score.toFixed(1)} / 5.0
                    </span>
                  </div>
                )}
              </div>

              {/* Questions List */}
              <div style={{ padding: "8px 0" }}>
                {questions.map((q, idx) => {
                  const hasAnswer = q.rating_score != null || (q.text_answer && q.text_answer.trim());

                  return (
                    <div
                      key={q.question_id || idx}
                      style={{
                        padding: "18px 24px",
                        borderBottom: idx < questions.length - 1 ? "1px solid rgba(96, 165, 250, 0.08)" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "24px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: "1 1 500px" }}>
                        <div style={{ fontSize: "14px", fontWeight: 500, color: "#e2e8f0", lineHeight: "1.5" }}>
                          <span style={{ color: "var(--text-dim, #64748b)", marginRight: "8px", fontWeight: 700 }}>
                            {section.section_number}.{idx + 1}
                          </span>
                          {q.question_text}
                        </div>

                        {/* Free text / Qualitative Comment Display */}
                        {q.response_type === "free_text" && (
                          <div style={{ marginTop: "12px" }}>
                            {q.text_answer && q.text_answer.trim() ? (
                              <div
                                style={{
                                  background: "rgba(15, 23, 42, 0.75)",
                                  borderLeft: "3px solid #60a5fa",
                                  borderRadius: "0 8px 8px 0",
                                  padding: "12px 16px",
                                  fontSize: "13px",
                                  color: "#93c5fd",
                                  lineHeight: "1.6",
                                  fontStyle: "italic",
                                }}
                              >
                                "{q.text_answer.trim()}"
                              </div>
                            ) : (
                              <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", fontStyle: "italic" }}>
                                No comment provided by client.
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Star Rating Display */}
                      {q.response_type === "star_rating" && (
                        <div style={{ minWidth: "140px", textAlign: "right" }}>
                          {renderStars(q.rating_score)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Comments Summary Card */}
      {additional_comments.length > 0 && (
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid rgba(96, 165, 250, 0.25)",
            borderRadius: "12px",
            padding: "24px 28px",
            boxShadow: "0 4px 18px rgba(0, 0, 0, 0.25)",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: "0 0 14px 0" }}>
            💬 Key Client Comments & Takeaways ({additional_comments.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {additional_comments.map((comment, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  borderLeft: "3px solid #38bdf8",
                  borderRadius: "0 6px 6px 0",
                  padding: "10px 16px",
                  fontSize: "13px",
                  color: "#e2e8f0",
                }}
              >
                "{comment}"
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
