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

  // Client responses state: { [questionId]: { rating_score?: number, text_answer?: string } }
  const [responses, setResponses] = useState({});
  const [hoveredRatings, setHoveredRatings] = useState({});

  // Submission & Validation state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedData, setSubmittedData] = useState(null);
  const [missingQuestionIds, setMissingQuestionIds] = useState(new Set());
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);

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

  // Group questions category-wise (sections 1 through 6)
  const categoryGroups = useMemo(() => {
    if (!survey || !survey.questions) return [];
    const groupsMap = {};
    survey.questions.forEach((q) => {
      if (!groupsMap[q.section_number]) {
        groupsMap[q.section_number] = {
          section_number: q.section_number,
          title: q.section_title,
          responseType: q.response_type,
          questions: [],
        };
      }
      groupsMap[q.section_number].questions.push(q);
    });

    const sorted = Object.values(groupsMap).sort((a, b) => a.section_number - b.section_number);
    sorted.forEach((grp) => {
      grp.questions.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    });
    return sorted;
  }, [survey]);

  // All star rating questions across all categories
  const allStarQuestions = useMemo(() => {
    if (!survey || !survey.questions) return [];
    return survey.questions.filter((q) => q.response_type === "star_rating");
  }, [survey]);

  // Total rated count & overall progress percentage
  const ratedCount = useMemo(() => {
    return allStarQuestions.filter((q) => responses[q.id]?.rating_score > 0).length;
  }, [allStarQuestions, responses]);

  const completionPercentage =
    allStarQuestions.length > 0
      ? Math.round((ratedCount / allStarQuestions.length) * 100)
      : 0;

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
    setMissingQuestionIds((prev) => {
      if (prev.has(questionId)) {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      }
      return prev;
    });
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

  // Move to next category page
  const handleNextCategory = () => {
    setSubmitError("");
    const currentGroup = categoryGroups[currentCategoryIndex];
    if (!currentGroup) return;

    const missingInCurrent = currentGroup.questions.filter(
      (q) => q.response_type === "star_rating" && (!responses[q.id]?.rating_score || responses[q.id].rating_score < 1)
    );

    if (missingInCurrent.length > 0) {
      setMissingQuestionIds(new Set(missingInCurrent.map((q) => q.id)));
      setSubmitError(
        `Please rate all questions in this category to proceed (${missingInCurrent.length} remaining).`
      );
      const firstEl = document.getElementById(`question-${missingInCurrent[0].id}`);
      if (firstEl) {
        firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setMissingQuestionIds(new Set());
    setCurrentCategoryIndex((prev) => Math.min(categoryGroups.length - 1, prev + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Move to previous category page
  const handlePrevCategory = () => {
    setSubmitError("");
    setMissingQuestionIds(new Set());
    setCurrentCategoryIndex((prev) => Math.max(0, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Submit survey responses with smooth scroll to any unrated question
  const handleSubmit = async () => {
    setSubmitError("");
    const missing = allStarQuestions.filter(
      (q) => !responses[q.id]?.rating_score || responses[q.id].rating_score < 1
    );

    if (missing.length > 0) {
      const firstMissingQ = missing[0];
      const targetGroupIdx = categoryGroups.findIndex((grp) =>
        grp.questions.some((q) => q.id === firstMissingQ.id)
      );
      if (targetGroupIdx !== -1) {
        setCurrentCategoryIndex(targetGroupIdx);
      }
      setMissingQuestionIds(new Set(missing.map((q) => q.id)));
      setSubmitError(
        `Please provide a star rating for all questions (${missing.length} question${
          missing.length > 1 ? "s" : ""
        } remaining).`
      );
      setTimeout(() => {
        const firstEl = document.getElementById(`question-${firstMissingQ.id}`);
        if (firstEl) {
          firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }

    setSubmitting(true);

    try {
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

          {/* Engagement Details */}
          <div
            style={{
              background: "rgba(10, 22, 40, 0.7)",
              border: "1px solid rgba(96, 165, 250, 0.15)",
              borderRadius: "var(--radius-md, 10px)",
              padding: "14px 20px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              fontSize: "13px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-dim, #64748b)" }}>Project:</span>
              <strong style={{ color: "var(--text-white, #ffffff)" }}>{survey?.project_name}</strong>
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

        {/* Overall Survey Evaluation Progress */}
        <div
          style={{
            background: "rgba(11, 23, 42, 0.85)",
            border: "1px solid rgba(96, 165, 250, 0.2)",
            borderRadius: "var(--radius-md, 12px)",
            padding: "18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-white, #ffffff)" }}>
              Survey Progress
            </span>
            <span
              style={{
                fontSize: "13px",
                color: completionPercentage === 100 ? "var(--success, #22c55e)" : "var(--primary-lt, #60a5fa)",
                fontWeight: 600,
              }}
            >
              {ratedCount} of {allStarQuestions.length} rated ({completionPercentage}%)
            </span>
          </div>
          <div
            style={{
              height: "7px",
              width: "100%",
              background: "rgba(96, 165, 250, 0.15)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${completionPercentage}%`,
                background:
                  completionPercentage === 100
                    ? "var(--success, #22c55e)"
                    : "linear-gradient(90deg, #2563eb, #38bdf8)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Active Category Page (Page-by-page next/prev navigation) */}
        {(() => {
          if (categoryGroups.length === 0) return null;
          const currentGroup = categoryGroups[currentCategoryIndex] || categoryGroups[0];
          const isFirstCategory = currentCategoryIndex === 0;
          const isLastCategory = currentCategoryIndex === categoryGroups.length - 1;

          // Calculate continuous question start number for the active category
          let questionStartIndex = 0;
          for (let i = 0; i < currentCategoryIndex; i++) {
            questionStartIndex += categoryGroups[i]?.questions?.length || 0;
          }

          const currentGroupStarQuestions = currentGroup.questions.filter((q) => q.response_type === "star_rating");
          const currentGroupRatedCount = currentGroupStarQuestions.filter((q) => responses[q.id]?.rating_score > 0).length;

          return (
            <div
              style={{
                background: "rgba(11, 23, 42, 0.85)",
                border: "1.5px solid rgba(96, 165, 250, 0.22)",
                borderRadius: "var(--radius-md, 14px)",
                padding: "26px 28px",
                display: "flex",
                flexDirection: "column",
                gap: "22px",
                boxShadow: "0 6px 24px rgba(0, 0, 0, 0.35)",
              }}
            >
              {/* Category Header (NO category tabs, NO 'Section 1 of 6' text, just clean category title & type badge) */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  borderBottom: "1px solid rgba(96, 165, 250, 0.15)",
                  paddingBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "4px",
                      height: "22px",
                      background: "linear-gradient(180deg, #38bdf8, #2563eb)",
                      borderRadius: "2px",
                    }}
                  />
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                    {currentGroup.title}
                  </h2>
                </div>

                <Badge variant={currentGroup.responseType === "star_rating" ? "count" : "info"} size="sm">
                  {currentGroup.responseType === "star_rating" ? "★ 1-5 Star Ratings" : "✎ Feedback & Comments"}
                </Badge>
              </div>

              {/* Questions in Current Category */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {currentGroup.questions.map((q, idx) => {
                  const isStarRating = q.response_type === "star_rating";
                  const currentNum = questionStartIndex + idx + 1;
                  const currentRating = responses[q.id]?.rating_score || 0;
                  const hoverRating = hoveredRatings[q.id] || 0;
                  const activeScore = hoverRating || currentRating;
                  const isMissing = missingQuestionIds.has(q.id);

                  return (
                    <div
                      key={q.id}
                      id={`question-${q.id}`}
                      style={{
                        background: isMissing
                          ? "rgba(239, 68, 68, 0.08)"
                          : currentRating > 0
                          ? "rgba(34, 197, 94, 0.05)"
                          : "rgba(14, 28, 48, 0.6)",
                        border: isMissing
                          ? "1.5px solid rgba(239, 68, 68, 0.55)"
                          : currentRating > 0
                          ? "1px solid rgba(34, 197, 94, 0.25)"
                          : "1px solid rgba(96, 165, 250, 0.12)",
                        borderRadius: "var(--radius-md, 10px)",
                        padding: "18px 22px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: currentRating > 0 ? "var(--success, #22c55e)" : "var(--primary-lt, #60a5fa)",
                            background: currentRating > 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(37, 99, 235, 0.15)",
                            width: "26px",
                            height: "26px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {currentRating > 0 ? "✓" : currentNum}
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-white, #ffffff)", lineHeight: 1.5, marginTop: "2px" }}>
                          {q.question_text}
                        </span>
                      </div>

                      {isStarRating ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            marginLeft: "38px",
                            marginTop: "4px",
                            padding: "10px 14px",
                            background: "rgba(10, 22, 40, 0.5)",
                            borderRadius: "8px",
                            border: "1px solid rgba(96, 165, 250, 0.1)",
                            width: "fit-content",
                          }}
                        >
                          {/* Rating Stars Positioned Below Question */}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
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
                                    width="30"
                                    height="30"
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

                          {/* Rating Label Below the Stars */}
                          <div style={{ fontSize: "12px", marginTop: "2px" }}>
                            {activeScore > 0 ? (
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: "#fbbf24",
                                  background: "rgba(245, 158, 11, 0.15)",
                                  border: "1px solid rgba(245, 158, 11, 0.3)",
                                  padding: "3px 10px",
                                  borderRadius: "6px",
                                  display: "inline-block",
                                }}
                              >
                                {activeScore} / 5 — {RATING_LABELS[activeScore]}
                              </span>
                            ) : (
                              <span style={{ color: isMissing ? "#fca5a5" : "var(--text-dim, #64748b)" }}>
                                {isMissing ? "⚠️ Please select a rating (1 to 5)" : "Click stars above to rate"}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginLeft: "38px" }}>
                          <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", display: "block", marginBottom: "6px" }}>
                            Comments / Actionable Feedback <em style={{ color: "#94a3b8" }}>(Optional)</em>
                          </span>
                          <textarea
                            rows={4}
                            placeholder="Optional: share any specific feedback, appreciation, or strategic improvement recommendations..."
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
                })}
              </div>

              {/* In-Form Navigation Bar: Previous, Status, Next / Submit */}
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
                    onClick={handlePrevCategory}
                  >
                    ← Previous
                  </Button>
                ) : (
                  <div />
                )}

                <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", fontWeight: 500 }}>
                  {currentGroupStarQuestions.length > 0
                    ? `${currentGroupRatedCount} of ${currentGroupStarQuestions.length} rated in this category`
                    : "Feedback & Comments"}
                </span>

                {!isLastCategory ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleNextCategory}
                  >
                    Next Category →
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
          );
        })()}
      </div>
    </div>
  );
}
