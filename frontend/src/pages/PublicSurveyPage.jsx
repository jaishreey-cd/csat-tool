import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import surveysApi from "../api/surveysApi";
import Logo from "../components/Logo";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";

const RATING_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

export default function PublicSurveyPage() {
  const { token } = useParams();

  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Active Category (1 to 6)
  const [activeCategory, setActiveCategory] = useState(1);

  // Client responses state: { [questionId]: { rating_score?: number, text_answer?: string } }
  const [responses, setResponses] = useState({});
  const [hoveredRatings, setHoveredRatings] = useState({});

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedData, setSubmittedData] = useState(null);

  // Load public survey by token
  useEffect(() => {
    const fetchSurvey = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const data = await surveysApi.getPublicSurvey(token);
        setSurvey(data);
      } catch (err) {
        console.error("Failed to load public survey:", err);
        setLoadError(
          err?.response?.data?.detail || "This survey link is invalid, expired, or not found."
        );
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSurvey();
    }
  }, [token]);

  // Group questions by section
  const sectionQuestionsMap = useMemo(() => {
    if (!survey || !survey.questions) return {};
    const map = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    survey.questions.forEach((q) => {
      if (map[q.section_number]) {
        map[q.section_number].push(q);
      }
    });
    return map;
  }, [survey]);

  // Section titles and descriptions
  const sectionMetaMap = useMemo(() => {
    if (!survey || !survey.questions) return {};
    const meta = {};
    survey.questions.forEach((q) => {
      if (!meta[q.section_number]) {
        meta[q.section_number] = {
          number: q.section_number,
          title: q.section_title,
          responseType: q.response_type,
        };
      }
    });
    return meta;
  }, [survey]);

  // Handle star rating click
  const handleRatingSelect = (questionId, score) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        question_id: questionId,
        rating_score: prev[questionId]?.rating_score === score ? null : score,
      },
    }));
  };

  // Handle text comment change
  const handleTextChange = (questionId, text) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        question_id: questionId,
        text_answer: text,
      },
    }));
  };

  // Validate responses before submission
  const validateResponses = () => {
    if (!survey || !survey.questions) return { valid: false };

    // Check all questions in sections 1 to 5
    for (let sec = 1; sec <= 5; sec++) {
      const qList = sectionQuestionsMap[sec] || [];
      for (const q of qList) {
        const score = responses[q.id]?.rating_score;
        if (!score || score < 1 || score > 5) {
          return {
            valid: false,
            missingSection: sec,
            missingQuestion: q.question_text,
          };
        }
      }
    }
    return { valid: true };
  };

  // Submit survey responses
  const handleSubmit = async () => {
    setSubmitError("");
    const validation = validateResponses();

    if (!validation.valid) {
      setActiveCategory(validation.missingSection);
      setSubmitError(
        `Please provide a star rating for all questions in Section ${validation.missingSection} before submitting.`
      );
      return;
    }

    setSubmitting(true);

    try {
      // Build answers array
      const answersList = [];
      survey.questions.forEach((q) => {
        const resp = responses[q.id] || {};
        answersList.push({
          question_id: q.id,
          rating_score: resp.rating_score || null,
          text_answer: resp.text_answer || null,
        });
      });

      const result = await surveysApi.submitPublicSurvey(token, { answers: answersList });
      setSubmittedData(result);
    } catch (err) {
      setSubmitError(
        err?.response?.data?.detail || "Failed to submit survey feedback. Please check answers and retry."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 1. LOADING STATE
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-deep, #0a1628)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          color: "var(--text-white, #ffffff)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <Logo size="lg" />
        <Spinner size="lg" />
        <span style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)" }}>
          Loading your customer satisfaction survey...
        </span>
      </div>
    );
  }

  // 2. ERROR STATE (Invalid or expired token)
  if (loadError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-deep, #0a1628)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            width: "100%",
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "36px 30px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "18px",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.5)",
          }}
        >
          <Logo size="md" />
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              border: "2px solid var(--danger, #ef4444)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              color: "var(--danger, #ef4444)",
            }}
          >
            ✕
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
            Survey Unavailable
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", lineHeight: 1.6, margin: 0 }}>
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  // 3. ALREADY COMPLETED STATE OR JUST SUBMITTED STATE
  if (submittedData || survey?.status === "Completed") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-deep, #0a1628)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "540px",
            width: "100%",
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
            borderRadius: "var(--radius-lg, 16px)",
            padding: "40px 32px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.55)",
          }}
        >
          <Logo size="lg" />

          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(34, 197, 94, 0.15)",
              border: "2px solid var(--success, #22c55e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              color: "var(--success, #22c55e)",
            }}
          >
            ✓
          </div>

          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-white, #ffffff)", margin: "0 0 8px 0" }}>
              Thank You for Your Feedback!
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", lineHeight: 1.6, margin: 0 }}>
              Your responses have been successfully submitted for <strong>{survey?.project_name}</strong>.
              Cloud Destinations sincerely appreciates your partnership and valuable insights.
            </p>
          </div>

          {/* Reference pill */}
          <div
            style={{
              background: "rgba(10, 22, 40, 0.7)",
              border: "1px solid rgba(96, 165, 250, 0.15)",
              borderRadius: "var(--radius-md, 10px)",
              padding: "14px 20px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "12px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-dim, #64748b)" }}>Survey Reference:</span>
              <strong style={{ color: "var(--primary-lt, #60a5fa)" }}>{survey?.survey_code}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-dim, #64748b)" }}>Organization:</span>
              <span style={{ color: "var(--text-white, #ffffff)" }}>{survey?.client_name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-dim, #64748b)" }}>Phase:</span>
              <Badge variant="count">{survey?.phase}</Badge>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. ACTIVE CLIENT SURVEY EVALUATION FORM
  const activeQuestions = sectionQuestionsMap[activeCategory] || [];
  const activeMeta = sectionMetaMap[activeCategory] || {
    number: activeCategory,
    title: `Section ${activeCategory}`,
    responseType: activeCategory === 6 ? "free_text" : "star_rating",
  };
  const isFirstCategory = activeCategory === 1;
  const isLastCategory = activeCategory === 6;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-deep, #0a1628)",
        color: "var(--text-white, #ffffff)",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: "880px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Top Branding Banner */}
        <div
          style={{
            background: "rgba(13, 27, 42, 0.95)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "16px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Logo size="md" />
            <div style={{ height: "20px", width: "1px", background: "rgba(96, 165, 250, 0.2)" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>
              Client Feedback Portal
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Badge variant="count">{survey.phase} Review</Badge>
            <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)" }}>
              Client: <strong style={{ color: "var(--text-white, #ffffff)" }}>{survey.client_name}</strong>
            </span>
          </div>
        </div>

        {/* Survey Welcome Card */}
        <div
          style={{
            background: "rgba(14, 30, 55, 0.7)",
            border: "1px solid rgba(96, 165, 250, 0.2)",
            borderRadius: "var(--radius-lg, 14px)",
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-white, #ffffff)", margin: 0 }}>
              Customer Satisfaction Survey
            </h1>
            <Badge variant="active">{survey.project_code}</Badge>
          </div>

          <div style={{ fontSize: "14px", color: "var(--primary-lt, #60a5fa)", fontWeight: 600 }}>
            Project: {survey.project_name}
          </div>

          <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", lineHeight: 1.6, margin: "4px 0 0 0" }}>
            Thank you for partnering with Cloud Destinations. Please rate your satisfaction across key service delivery categories.
            Your feedback directly guides our engagement teams and continuous delivery improvements.
          </p>

          {/* Rating Scale Legend */}
          <div
            style={{
              marginTop: "8px",
              padding: "10px 14px",
              background: "rgba(10, 20, 36, 0.7)",
              borderRadius: "var(--radius-sm, 8px)",
              border: "1px solid rgba(96, 165, 250, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim, #64748b)", textTransform: "uppercase" }}>
              Rating Scale:
            </span>
            {[
              { score: 1, label: "Poor" },
              { score: 2, label: "Fair" },
              { score: 3, label: "Good" },
              { score: 4, label: "Very Good" },
              { score: 5, label: "Excellent" },
            ].map((scale) => (
              <span key={scale.score} style={{ fontSize: "12px", color: "var(--text-main, #e2e8f0)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span style={{ color: "#f59e0b", fontSize: "12px" }}>★</span>
                <strong>{scale.score}</strong> - {scale.label}
              </span>
            ))}
          </div>
        </div>

        {/* Category Stepper Tabs (1 to 6) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted, #94a3b8)", letterSpacing: "0.5px" }}>
              Categories Progress ({activeCategory}/6)
            </span>
            <span style={{ fontSize: "12px", color: "var(--primary-lt, #60a5fa)", fontWeight: 600 }}>
              Complete each section and click Next Section
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "8px",
              overflowX: "auto",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((secNum) => {
              const isCurrent = activeCategory === secNum;
              const qList = sectionQuestionsMap[secNum] || [];
              const ratedCount = qList.filter((q) => {
                const resp = responses[q.id];
                return (resp?.rating_score && resp.rating_score > 0) || (resp?.text_answer && resp.text_answer.trim().length > 0);
              }).length;
              const isComplete = qList.length > 0 && ratedCount >= qList.length;
              const meta = sectionMetaMap[secNum] || { title: `Section ${secNum}` };

              return (
                <button
                  key={secNum}
                  type="button"
                  onClick={() => setActiveCategory(secNum)}
                  style={{
                    background: isCurrent
                      ? "rgba(37, 99, 235, 0.25)"
                      : isComplete
                      ? "rgba(34, 197, 94, 0.1)"
                      : "rgba(14, 30, 50, 0.6)",
                    border: `1.5px solid ${
                      isCurrent
                        ? "var(--primary-lt, #60a5fa)"
                        : isComplete
                        ? "rgba(34, 197, 94, 0.4)"
                        : "rgba(96, 165, 250, 0.12)"
                    }`,
                    borderRadius: "var(--radius-md, 8px)",
                    padding: "10px 6px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                    boxShadow: isCurrent ? "0 0 10px rgba(37, 99, 235, 0.35)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        fontWeight: 800,
                        background: isCurrent
                          ? "var(--primary, #2563eb)"
                          : isComplete
                          ? "var(--success, #22c55e)"
                          : "rgba(96, 165, 250, 0.15)",
                        color: "#ffffff",
                      }}
                    >
                      {isComplete ? "✓" : secNum}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: isCurrent
                          ? "var(--text-white, #ffffff)"
                          : isComplete
                          ? "var(--success, #22c55e)"
                          : "var(--text-muted, #94a3b8)",
                      }}
                    >
                      Sec {secNum}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: isCurrent ? "var(--primary-lt, #60a5fa)" : "var(--text-dim, #64748b)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                    }}
                  >
                    {meta.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: "var(--radius-md, 8px)",
              padding: "12px 18px",
              color: "#fca5a5",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span>⚠</span>
            <span>{submitError}</span>
          </div>
        )}

        {/* Active Category Questions Card */}
        <div
          style={{
            background: "rgba(11, 23, 42, 0.9)",
            border: "1.5px solid rgba(96, 165, 250, 0.25)",
            borderRadius: "var(--radius-md, 14px)",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Section Header */}
          <div style={{ borderBottom: "1px solid rgba(96, 165, 250, 0.15)", paddingBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    background: "var(--primary, #2563eb)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "6px",
                  }}
                >
                  Section {activeMeta.number} of 6
                </span>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                  {activeMeta.title}
                </h2>
              </div>
            </div>

            <Badge variant={activeMeta.responseType === "star_rating" ? "count" : "info"}>
              {activeMeta.responseType === "star_rating" ? "★ 1-5 Star Ratings" : "✎ Free-Text Comments"}
            </Badge>
          </div>

          {/* Question Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {activeQuestions.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "13px" }}>
                No questions configured in this section.
              </div>
            ) : (
              activeQuestions.map((q, idx) => {
                const isStarRating = q.response_type === "star_rating";
                const currentRating = responses[q.id]?.rating_score || 0;
                const hoverRating = hoveredRatings[q.id] || 0;
                const activeScore = hoverRating || currentRating;

                return (
                  <div
                    key={q.id}
                    style={{
                      background: "rgba(14, 28, 48, 0.6)",
                      border: "1px solid rgba(96, 165, 250, 0.12)",
                      borderRadius: "var(--radius-md, 10px)",
                      padding: "18px 22px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--primary-lt, #60a5fa)", minWidth: "24px" }}>
                        {idx + 1}.
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-white, #ffffff)", lineHeight: 1.5 }}>
                        {q.question_text}
                      </span>
                    </div>

                    {isStarRating ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginLeft: "34px", flexWrap: "wrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {[1, 2, 3, 4, 5].map((starValue) => {
                            const isFilled = starValue <= activeScore;
                            return (
                              <button
                                key={starValue}
                                type="button"
                                onClick={() => handleRatingSelect(q.id, starValue)}
                                onMouseEnter={() => setHoveredRatings((prev) => ({ ...prev, [q.id]: starValue }))}
                                onMouseLeave={() => setHoveredRatings((prev) => ({ ...prev, [q.id]: 0 }))}
                                title={`Rate ${starValue} of 5 - ${RATING_LABELS[starValue]}`}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  padding: "4px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  outline: "none",
                                  transition: "transform 0.15s ease",
                                  transform: isFilled ? "scale(1.15)" : "scale(1)",
                                }}
                              >
                                <svg
                                  width="28"
                                  height="28"
                                  viewBox="0 0 24 24"
                                  fill={isFilled ? "#f59e0b" : "none"}
                                  stroke={isFilled ? "#f59e0b" : "rgba(148, 163, 184, 0.35)"}
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{
                                    filter: isFilled ? "drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))" : "none",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              </button>
                            );
                          })}
                        </div>

                        {/* Rating text descriptor pill */}
                        <div style={{ fontSize: "12px", minWidth: "120px" }}>
                          {activeScore > 0 ? (
                            <span
                              style={{
                                fontWeight: 700,
                                color: "#fbbf24",
                                background: "rgba(245, 158, 11, 0.15)",
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                                padding: "3px 9px",
                                borderRadius: "6px",
                              }}
                            >
                              {activeScore} — {RATING_LABELS[activeScore]}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-dim, #64748b)" }}>
                              Click stars to rate (1 to 5)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Free-Text Input Area for Section 6 */
                      <div style={{ marginLeft: "34px" }}>
                        <textarea
                          rows={4}
                          placeholder="Please share any specific highlights, feedback, or strategic improvement recommendations..."
                          value={responses[q.id]?.text_answer || ""}
                          onChange={(e) => handleTextChange(q.id, e.target.value)}
                          style={{
                            width: "100%",
                            background: "rgba(10, 20, 36, 0.6)",
                            border: "1px solid rgba(96, 165, 250, 0.2)",
                            borderRadius: "var(--radius-md, 8px)",
                            padding: "12px 14px",
                            color: "var(--text-main, #e2e8f0)",
                            fontSize: "13px",
                            fontFamily: "inherit",
                            resize: "vertical",
                            outline: "none",
                            transition: "border-color 0.15s ease",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "var(--primary-lt, #60a5fa)")}
                          onBlur={(e) => (e.target.style.borderColor = "rgba(96, 165, 250, 0.2)")}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Section Navigation Footer */}
          <div
            style={{
              borderTop: "1px solid rgba(96, 165, 250, 0.15)",
              paddingTop: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {!isFirstCategory ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setSubmitError("");
                  setActiveCategory((prev) => prev - 1);
                }}
              >
                ← Previous Section ({activeCategory - 1}/6)
              </Button>
            ) : (
              <div />
            )}

            <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 600 }}>
              Section {activeCategory} of 6: {activeMeta.title}
            </span>

            {!isLastCategory ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => {
                  setSubmitError("");
                  setActiveCategory((prev) => prev + 1);
                }}
              >
                Next Section ({activeCategory + 1}/6) →
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="lg"
                loading={submitting}
                disabled={submitting}
                onClick={handleSubmit}
              >
                Submit Survey Feedback ✓
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
