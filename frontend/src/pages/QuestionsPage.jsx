import { useState, useEffect, useMemo, useCallback } from "react";
import questionsApi from "../api/questionsApi";
import Button from "../components/Button";
import Spinner from "../components/Spinner";

const SECTIONS = [
  { num: 1, title: "Project Management & Communication" },
  { num: 2, title: "Technical Competence & Solution Quality" },
  { num: 3, title: "Team Responsiveness & Collaboration" },
  { num: 4, title: "Delivery & Execution Quality" },
  { num: 5, title: "Value & Business Impact" },
  { num: 6, title: "Qualitative Feedback & General Comments" },
];

const ALL_PHASES = [
  "Weekly",
  "Monthly",
  "Quarterly",
  "Closure",
];

const parsePhases = (val) => {
  if (Array.isArray(val)) return val;
  if (!val || val === "ALL") return [...ALL_PHASES];
  if (typeof val === "string") {
    return val.split(",").map((p) => p.trim()).filter(Boolean);
  }
  return [...ALL_PHASES];
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [selectedSection, setSelectedSection] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [formData, setFormData] = useState({
    section_number: 1,
    section_title: SECTIONS[0].title,
    question_text: "",
    response_type: "StarRating",
    applicable_phases: ALL_PHASES,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchQuestions = useCallback(async (force = false) => {
    const params = {};
    if (selectedSection !== "ALL") params.section = Number(selectedSection);

    // Instant cached render
    if (!force) {
      const cached = questionsApi.getCachedQuestions(params);
      if (cached) {
        setQuestions(cached.questions || []);
        setLoading(false);
        // refresh in background silently
        questionsApi.getQuestions(params, true).then((data) => {
          setQuestions(data.questions || []);
        }).catch(() => {});
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      const data = await questionsApi.getQuestions(params, force);
      setQuestions(data.questions || []);
    } catch (err) {
      console.error("Failed to load questions:", err);
      setError("Failed to load questions from database. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [selectedSection]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const openCreateModal = () => {
    setEditingQuestion(null);
    setFormData({
      section_number: 1,
      section_title: SECTIONS[0].title,
      question_text: "",
      response_type: "StarRating",
      applicable_phases: [...ALL_PHASES],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (q) => {
    setEditingQuestion(q);
    setFormData({
      section_number: q.section_number,
      section_title: q.section_title,
      question_text: q.question_text,
      response_type: q.response_type,
      applicable_phases: parsePhases(q.applicable_phases),
    });
    setIsModalOpen(true);
  };

  const handleSectionChange = (secNum) => {
    const sec = SECTIONS.find((s) => s.num === Number(secNum));
    setFormData((prev) => ({
      ...prev,
      section_number: Number(secNum),
      section_title: sec ? sec.title : `Section ${secNum}`,
      response_type: Number(secNum) === 6 ? "Text" : "StarRating",
    }));
  };

  const togglePhase = (phase) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.applicable_phases) ? prev.applicable_phases : parsePhases(prev.applicable_phases);
      const exists = current.includes(phase);
      const nextPhases = exists
        ? current.filter((p) => p !== phase)
        : [...current, phase];
      return { ...prev, applicable_phases: nextPhases };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.question_text.trim()) {
      alert("Please enter question text.");
      return;
    }
    if (!formData.applicable_phases || formData.applicable_phases.length === 0) {
      alert("Please select at least one applicable survey phase.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        applicable_phases: Array.isArray(formData.applicable_phases)
          ? formData.applicable_phases.join(",")
          : (formData.applicable_phases || "ALL"),
      };

      if (editingQuestion) {
        await questionsApi.updateQuestion(editingQuestion.id, payload);
        setSuccessMsg("Question updated successfully!");
      } else {
        await questionsApi.createQuestion(payload);
        setSuccessMsg("Question added to bank successfully!");
      }
      setIsModalOpen(false);
      fetchQuestions(true);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error("Save question error:", err);
      alert("Failed to save question. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeleteConfirmId(null);
      await questionsApi.deleteQuestion(id);
      setSuccessMsg("Question permanently deleted from database.");
      fetchQuestions(true);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error("Delete question error:", err);
      alert("Failed to delete question permanently.");
    }
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--text-white, #ffffff)",
              margin: "0 0 6px 0",
              letterSpacing: "-0.3px",
            }}
          >
            Question Bank
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-muted, #94a3b8)",
              margin: 0,
            }}
          >
            Create, customize, and manage survey evaluation questions across all phases independently.
          </p>
        </div>

        <Button variant="primary" onClick={openCreateModal}>
          + Add New Question
        </Button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#6ee7b7",
            padding: "12px 18px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
            padding: "12px 18px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
          borderRadius: "12px",
          padding: "18px 22px",
          marginBottom: "24px",
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>
            Section:
          </label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            style={{
              background: "var(--bg-surface, #0d1b2a)",
              border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
              color: "var(--text-main, #0f172a)",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "13px",
            }}
          >
            <option value="ALL">All Sections (1 to 6)</option>
            {SECTIONS.map((s) => (
              <option key={s.num} value={s.num}>
                Section {s.num}: {s.title}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: "auto", fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
          Total Questions: <strong style={{ color: "var(--primary-lt, #60a5fa)" }}>{questions.length}</strong>
        </div>
      </div>

      {/* Questions List */}
      {loading && questions.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "12px" }}>
          <Spinner size="lg" />
          <span style={{ color: "var(--text-muted, #94a3b8)", fontSize: "14px" }}>Loading questions from database...</span>
        </div>
      ) : questions.length === 0 ? (
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px dashed var(--border-strong, rgba(96, 165, 250, 0.25))",
            borderRadius: "12px",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "15px", marginBottom: "16px" }}>
            No questions found for the selected filter.
          </p>
          <Button variant="primary" onClick={openCreateModal}>
            Create First Question
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {questions.map((q) => {
            const phases = parsePhases(q.applicable_phases);
            return (
              <div
                key={q.id}
                style={{
                  background: "var(--bg-surface, #0d1b2a)",
                  border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                  borderRadius: "10px",
                  padding: "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                <div style={{ flex: 1 }}>
                  {/* Meta Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: q.section_number === 6 ? "rgba(168, 85, 247, 0.2)" : "rgba(37, 99, 235, 0.2)",
                        border: `1px solid ${q.section_number === 6 ? "rgba(168, 85, 247, 0.4)" : "rgba(37, 99, 235, 0.4)"}`,
                        color: q.section_number === 6 ? "#c084fc" : "#93c5fd",
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      Section {q.section_number}: {q.section_title}
                    </span>

                    <span
                      style={{
                        background: "rgba(100, 116, 139, 0.2)",
                        color: "#cbd5e1",
                        fontSize: "12px",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        border: "1px solid rgba(100, 116, 139, 0.3)",
                      }}
                    >
                      Type: {q.response_type === "Text" ? "Text / Comment" : "1-5 Star Rating"}
                    </span>

                    {q.section_number === 6 && (
                      <span
                        style={{
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#fde68a",
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid rgba(245, 158, 11, 0.3)",
                        }}
                      >
                        Optional
                      </span>
                    )}
                  </div>

                  {/* Question Text */}
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-white, #ffffff)", marginBottom: "12px", lineHeight: 1.5 }}>
                    {q.question_text}
                  </div>

                  {/* Applicable Phases */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)" }}>Phases:</span>
                    {phases.map((ph) => (
                      <span
                        key={ph}
                        style={{
                          fontSize: "11px",
                          background: "var(--bg-hover, rgba(15, 23, 42, 0.6))",
                          border: "1px solid var(--border, rgba(96, 165, 250, 0.2))",
                          color: "var(--primary-lt, #1d4ed8)",
                          padding: "2px 8px",
                          borderRadius: "12px",
                        }}
                      >
                        {ph}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <Button variant="secondary" size="sm" onClick={() => openEditModal(q)}>
                    Edit
                  </Button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(q.id)}
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#fca5a5",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--bg-surface, #0d1b2a)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <h3 style={{ color: "var(--danger, #ef4444)", margin: "0 0 12px 0", fontSize: "18px" }}>
              Permanent Question Deletion
            </h3>
            <p style={{ color: "var(--text-muted, #cbd5e1)", fontSize: "14px", lineHeight: 1.5, margin: "0 0 20px 0" }}>
              Are you sure you want to delete this question? This question will be <strong>permanently removed from the database</strong>.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Yes, Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--bg-surface, #0d1b2a)",
              border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.3))",
              borderRadius: "12px",
              padding: "28px",
              maxWidth: "600px",
              width: "100%",
              boxShadow: "var(--shadow-lg, 0 10px 40px rgba(0,0,0,0.6))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ color: "var(--text-white, #ffffff)", margin: 0, fontSize: "18px" }}>
                {editingQuestion ? "Edit Question" : "Add Question to Bank"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted, #94a3b8)", fontSize: "20px", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Section Select */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted, #cbd5e1)", marginBottom: "6px" }}>
                  Section
                </label>
                <select
                  value={formData.section_number}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg-surface, #0b1329)",
                    border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
                    borderRadius: "6px",
                    color: "var(--text-main, #ffffff)",
                    padding: "8px 12px",
                    fontSize: "14px",
                  }}
                >
                  {SECTIONS.map((s) => (
                    <option key={s.num} value={s.num}>
                      Section {s.num}: {s.title}
                    </option>
                  ))}
                </select>
                {formData.section_number === 6 && (
                  <p style={{ fontSize: "12px", color: "var(--warning, #fde68a)", margin: "4px 0 0 0" }}>
                    * Section 6 questions and feedback comments are optional in surveys.
                  </p>
                )}
              </div>

              {/* Question Text */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted, #cbd5e1)", marginBottom: "6px" }}>
                  Question Text
                </label>
                <textarea
                  rows={3}
                  value={formData.question_text}
                  onChange={(e) => setFormData((p) => ({ ...p, question_text: e.target.value }))}
                  placeholder="e.g. How satisfied are you with the technical architecture and delivery velocity?"
                  style={{
                    width: "100%",
                    background: "var(--bg-surface, #0b1329)",
                    border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
                    borderRadius: "6px",
                    color: "var(--text-main, #ffffff)",
                    padding: "8px 12px",
                    fontSize: "14px",
                    resize: "vertical",
                  }}
                  required
                />
              </div>

              {/* Response Type */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted, #cbd5e1)", marginBottom: "6px" }}>
                  Response Type
                </label>
                <select
                  value={formData.response_type}
                  onChange={(e) => setFormData((p) => ({ ...p, response_type: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "var(--bg-surface, #0b1329)",
                    border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
                    borderRadius: "6px",
                    color: "var(--text-main, #ffffff)",
                    padding: "8px 12px",
                    fontSize: "14px",
                  }}
                >
                  <option value="StarRating">1-5 Star Rating</option>
                  <option value="Text">Text Feedback / Comment</option>
                </select>
              </div>

              {/* Applicable Phases */}
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", marginBottom: "8px" }}>
                  Link to Survey Phases
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {ALL_PHASES.map((ph) => {
                    const phases = Array.isArray(formData.applicable_phases) ? formData.applicable_phases : parsePhases(formData.applicable_phases);
                    const selected = phases.includes(ph);
                    return (
                      <button
                        type="button"
                        key={ph}
                        onClick={() => togglePhase(ph)}
                        style={{
                          background: selected ? "var(--bg-active, rgba(37, 99, 235, 0.3))" : "var(--bg-hover, rgba(15, 23, 42, 0.6))",
                          border: `1px solid ${selected ? "var(--primary, #3b82f6)" : "var(--border, rgba(96, 165, 250, 0.2))"}`,
                          color: selected ? "var(--primary, #60a5fa)" : "var(--text-muted, #94a3b8)",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          cursor: "pointer",
                          fontWeight: selected ? 600 : 400,
                        }}
                      >
                        {selected ? "✓ " : "+ "}
                        {ph}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button variant="secondary" size="md" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="md" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingQuestion ? "Update Question" : "Save Question"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
