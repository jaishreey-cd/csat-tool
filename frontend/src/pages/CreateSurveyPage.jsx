import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import Stepper from "../components/Stepper";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Input from "../components/Input";
import Select from "../components/Select";
import Spinner from "../components/Spinner";
import Logo from "../components/Logo";
import { QUESTION_BANK, SURVEY_PHASES } from "../data/questionBank";
import clientsApi from "../api/clientsApi";
import surveysApi from "../api/surveysApi";
import questionsApi from "../api/questionsApi";

const PHASE_WORKFLOW = [
  { value: "Weekly", label: "Weekly Review", order: 1, next: "Monthly Milestone", desc: "Short cadence weekly progress and sprint pulse check." },
  { value: "Monthly", label: "Monthly Milestone", order: 2, next: "Quarterly Review", desc: "Monthly sprint deliverable, governance, and velocity review." },
  { value: "Quarterly", label: "Quarterly Review", order: 3, next: "Project Closure", desc: "Quarterly business review (QBR) assessing strategic value and delivery." },
  { value: "Closure", label: "Project Closure", order: 4, next: "Complete", desc: "Final engagement evaluation, deliverable sign-off, and handover." },
];

const RATING_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

function GridBackButton({ onClick }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      ← Back
    </Button>
  );
}

export default function CreateSurveyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Initial client/project from query params
  const initialClientId = searchParams.get("client") || "";
  const initialProjectId = searchParams.get("project") || "";

  // Stepper state (0: Client/Project, 1: Phase, 2: Questions, 3: Preview & Dispatch)
  const [currentStep, setCurrentStep] = useState(0);

  // Data fetching state
  const cachedClients = clientsApi.getCachedClients();
  const [clients, setClients] = useState(() => cachedClients?.clients || []);
  const [loadingClients, setLoadingClients] = useState(() => !cachedClients);

  // Form selections
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [selectedPhase, setSelectedPhase] = useState("Weekly");

  // Selected questions by section ID: { [sectionNumber]: [questionObjects] }
  // Pre-populates with default questions from bank so user has an immediate valid survey
  // and can delete unwanted questions with the trash icon or add more
  const [selectedQuestions, setSelectedQuestions] = useState(() => {
    const initial = {};
    QUESTION_BANK.forEach((section) => {
      const defaultCount = section.number === 6 ? 2 : 5;
      initial[section.number] = (section.questions || []).slice(0, defaultCount).map((q) => ({
        section_number: section.number,
        section_title: section.title,
        question_text: q.text,
        response_type: section.responseType,
        is_custom: false,
      }));
    });
    return initial;
  });

  // State for simulated client preview interactions
  const [previewCategoryIndex, setPreviewCategoryIndex] = useState(0);
  const [previewRatings, setPreviewRatings] = useState({});
  const [previewHover, setPreviewHover] = useState({});
  const [previewComments, setPreviewComments] = useState({});

  // Active question section tab (1 to 6)
  const [activeSectionTab, setActiveSectionTab] = useState(1);
  const [bankSelectValue, setBankSelectValue] = useState("");

  // Custom question input state
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [customQuestionError, setCustomQuestionError] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdSurvey, setCreatedSurvey] = useState(null);

  // Client Contact State
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch clients on mount
  // Fetch clients on mount with cache support
  useEffect(() => {
    const fetchClients = async () => {
      const cached = clientsApi.getCachedClients();
      if (cached) {
        setClients(cached.clients || []);
        setLoadingClients(false);
        return;
      }
      setLoadingClients(true);
      try {
        const data = await clientsApi.getClients();
        setClients(data.clients || []);
      } catch (err) {
        console.error("Failed to load clients:", err);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  // Update selected client/project when initial params change
  useEffect(() => {
    if (initialClientId) setSelectedClientId(initialClientId);
    if (initialProjectId) setSelectedProjectId(initialProjectId);
  }, [initialClientId, initialProjectId]);

  // Selected client object
  const currentClient = clients.find((c) => String(c.id) === String(selectedClientId));
  // Available projects for the selected client
  const availableProjects = currentClient?.projects?.filter((p) => p.is_active) || [];
  // Selected project object
  const currentProject = availableProjects.find((p) => String(p.id) === String(selectedProjectId));

  // Handle client selection change (resets project if client changes)
  const handleClientChange = (e) => {
    const clientId = e.target.value;
    setSelectedClientId(clientId);
    setSelectedProjectId("");
  };

  // Toggle selection of standard question
  const toggleQuestion = (sectionNumber, sectionTitle, questionText, responseType) => {
    setSelectedQuestions((prev) => {
      const currentList = prev[sectionNumber] || [];
      const exists = currentList.some((q) => q.question_text === questionText);

      if (exists) {
        // Remove question
        return {
          ...prev,
          [sectionNumber]: currentList.filter((q) => q.question_text !== questionText),
        };
      } else {
        // Enforce maximum 5 questions per section
        if (currentList.length >= 5) {
          return prev;
        }
        return {
          ...prev,
          [sectionNumber]: [
            ...currentList,
            {
              section_number: sectionNumber,
              section_title: sectionTitle,
              question_text: questionText,
              response_type: responseType,
              is_custom: false,
            },
          ],
        };
      }
    });
  };

  // Add custom question to active section and persist to DB question bank
  const handleAddCustomQuestion = async (e) => {
    e.preventDefault();
    const trimmed = customQuestionText.trim();
    if (!trimmed) {
      setCustomQuestionError("Please enter question text.");
      return;
    }
    const currentList = selectedQuestions[activeSectionTab] || [];
    if (currentList.length >= 5) {
      setCustomQuestionError("Maximum 5 questions already reached in this section.");
      return;
    }

    const currentSectionMeta = QUESTION_BANK.find((s) => s.number === activeSectionTab);

    const newQObj = {
      section_number: activeSectionTab,
      section_title: currentSectionMeta.title,
      question_text: trimmed,
      response_type: currentSectionMeta.responseType,
      is_custom: true,
    };

    setSelectedQuestions((prev) => ({
      ...prev,
      [activeSectionTab]: [...currentList, newQObj],
    }));

    setCustomQuestionText("");
    setCustomQuestionError("");

    // Persist to database Question Bank for sure
    try {
      await questionsApi.createQuestion({
        section_number: activeSectionTab,
        section_title: currentSectionMeta.title,
        question_text: trimmed,
        response_type: currentSectionMeta.responseType,
        applicable_phases: "ALL",
        display_order: currentList.length + 1,
      });
    } catch (err) {
      console.warn("Question template saved locally; background DB sync:", err);
    }
  };

  // Remove a question
  const removeQuestion = (sectionNumber, questionText) => {
    setSelectedQuestions((prev) => ({
      ...prev,
      [sectionNumber]: (prev[sectionNumber] || []).filter((q) => q.question_text !== questionText),
    }));
  };

  // Validation checkers across sections: Sections 1-5 require 1-5 questions; Section 6 is optional (0-5)
  const totalQuestionsCount = Object.values(selectedQuestions).reduce((acc, list) => acc + list.length, 0);
  const allSectionsHaveQuestions = [1, 2, 3, 4, 5].every(
    (sec) => (selectedQuestions[sec]?.length || 0) >= 1 && (selectedQuestions[sec]?.length || 0) <= 5
  ) && (selectedQuestions[6]?.length || 0) <= 5;
  const emptySections = [1, 2, 3, 4, 5].filter((sec) => (selectedQuestions[sec]?.length || 0) === 0);

  // Stepper definition (4 unified steps)
  const steps = [
    { label: "Client & Project" },
    { label: "Survey Phase" },
    { label: "Question Selection" },
    { label: "Preview & Dispatch" },
  ];

  // Submit survey and trigger approval
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");

    // Flatten questions in section order
    const flatQuestions = [];
    for (let sec = 1; sec <= 6; sec++) {
      const qList = selectedQuestions[sec] || [];
      qList.forEach((q, idx) => {
        flatQuestions.push({
          section_number: sec,
          section_title: q.section_title,
          question_text: q.question_text,
          response_type: q.response_type,
          is_custom: q.is_custom || false,
          display_order: idx + 1,
        });
      });
    }

    if (!contactName.trim() || !contactEmail.trim()) {
      setSubmitError("Client stakeholder name and email are required to create and dispatch the survey.");
      setSubmitting(false);
      return;
    }

    const trimmedEmail = contactEmail.trim();

    const payload = {
      client_id: parseInt(selectedClientId, 10),
      project_id: parseInt(selectedProjectId, 10),
      phase: selectedPhase,
      questions: flatQuestions,
      client_contact_name: contactName.trim(),
      client_contact_email: trimmedEmail,
    };

    try {
      // Create survey directly - no approval state
      const survey = await surveysApi.createSurvey(payload);
      setCreatedSurvey(survey);
    } catch (err) {
      setSubmitError(
        err?.response?.data?.detail || "Failed to create survey. Please check requirements and retry."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Copy survey link to clipboard
  const handleCopyLink = (token) => {
    const publicUrl = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // CONFIRMATION PAGE (Requirement 3: Show only message and link with copy button)
  if (createdSurvey) {
    const clientName = currentClient?.name || createdSurvey.client?.name || createdSurvey.client_contact_name || "Client";
    const surveyUrl = `${window.location.origin}/s/${createdSurvey.unique_token || ""}`;
    const emailResult = createdSurvey.email_dispatch_result;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: "600px",
          margin: "80px auto",
          padding: "36px 32px",
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
          borderRadius: "var(--radius-lg, 16px)",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
          textAlign: "center",
          gap: "24px",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "rgba(34, 197, 94, 0.15)",
            border: "2px solid var(--success, #22c55e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "26px",
            color: "var(--success, #22c55e)",
            boxShadow: "0 0 20px rgba(34, 197, 94, 0.25)",
          }}
        >
          ✓
        </div>

        <h2
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--text-white, #ffffff)",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Survey link dispatched to {clientName}
        </h2>

        {createdSurvey.client_contact_email && (
          <div
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              background: emailResult?.success
                ? "rgba(34, 197, 94, 0.12)"
                : emailResult?.mode === "error"
                ? "rgba(239, 68, 68, 0.12)"
                : "rgba(37, 99, 235, 0.12)",
              border: `1px solid ${
                emailResult?.success
                  ? "rgba(34, 197, 94, 0.3)"
                  : emailResult?.mode === "error"
                  ? "rgba(239, 68, 68, 0.3)"
                  : "rgba(96, 165, 250, 0.3)"
              }`,
              fontSize: "13px",
              lineHeight: 1.5,
              marginTop: "-8px",
            }}
          >
            {emailResult?.success ? (
              <span style={{ color: "#34d399", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span>✉</span> Invitation email successfully sent to <strong>{createdSurvey.client_contact_email}</strong>
              </span>
            ) : emailResult?.mode === "error" ? (
              <span style={{ color: "#f87171", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span>⚠</span> Email dispatch notice: {emailResult.message}
              </span>
            ) : (
              <span style={{ color: "#93c5fd", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span>✉</span> Invitation email triggered for <strong>{createdSurvey.client_contact_email}</strong>
              </span>
            )}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            background: "rgba(10, 22, 40, 0.8)",
            border: "1px solid rgba(96, 165, 250, 0.25)",
            borderRadius: "8px",
            padding: "8px 10px 8px 14px",
            boxSizing: "border-box",
          }}
        >
          <input
            type="text"
            readOnly
            value={surveyUrl}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "#93c5fd",
              fontSize: "13px",
              fontFamily: "monospace",
              outline: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            onClick={(e) => e.target.select()}
          />
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={() => handleCopyLink(createdSurvey.unique_token)}
            style={{ whiteSpace: "nowrap" }}
          >
            {copiedLink ? "✓ Copied!" : "Copy"}
          </Button>
        </div>

        <Button
          variant="secondary"
          size="md"
          type="button"
          onClick={() => navigate("/dashboard")}
          style={{ marginTop: "4px" }}
        >
          Back to Create Survey Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "960px", margin: "0 auto" }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
          Create Survey
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
          Configure customer satisfaction survey questions across 6 sections and create survey.
        </p>
      </div>

      {/* Stepper Progress */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "8px 24px",
        }}
      >
        <Stepper steps={steps} currentStep={currentStep} onStepClick={(idx) => idx < currentStep && setCurrentStep(idx)} />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STEP 1: CLIENT & PROJECT SELECTION
         ───────────────────────────────────────────────────────────── */}
      {currentStep === 0 && (
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-white, #ffffff)", margin: 0 }}>
            Step 1: Select Client and Project
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: 0 }}>
            Choose the client organization and the active project engagement for this survey.
          </p>

          {loadingClients ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "20px" }}>
              <Spinner size="md" />
              <span style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)" }}>Loading clients...</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Client Select */}
              <Select
                id="clientSelect"
                label="Client Organization"
                value={selectedClientId}
                onChange={handleClientChange}
                placeholder="-- Select a client --"
                required
                options={clients.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                }))}
              />

              {/* Dependent Project Select */}
              <Select
                id="projectSelect"
                label="Client Project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                placeholder={
                  selectedClientId
                    ? availableProjects.length > 0
                      ? "-- Select an active project --"
                      : "No active projects for this client"
                    : "Please select a client first"
                }
                disabled={!selectedClientId || availableProjects.length === 0}
                required
                options={availableProjects.map((p) => ({
                  value: String(p.id),
                  label: p.name,
                }))}
              />

              {/* Selected Project Summary Pill */}
              {currentProject && (
                <div
                  style={{
                    background: "rgba(37, 99, 235, 0.1)",
                    border: "1px solid rgba(96, 165, 250, 0.25)",
                    borderRadius: "var(--radius-md, 9px)",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                      {currentProject.name}
                    </span>
                  </div>
                  <Badge variant="active">Active</Badge>
                </div>
              )}

            </div>
          )}

          {/* Step 1 Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
            <Button
              variant="primary"
              size="md"
              disabled={!selectedClientId || !selectedProjectId}
              onClick={() => setCurrentStep(1)}
            >
              Continue to Phase Selection →
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 2: PHASE SELECTION
         ───────────────────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-white, #ffffff)", margin: 0 }}>
                Step 2: Select Project Phase
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                Select the project milestone being evaluated. Surveys follow a standardized 4-phase lifecycle.
              </p>
            </div>
            <Badge variant="count">Total 4 Survey Phases</Badge>
          </div>

          {/* Phase Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px" }}>
            {PHASE_WORKFLOW.map((phase) => {
              const isSelected = selectedPhase === phase.value;
              return (
                <div
                  key={phase.value}
                  onClick={() => setSelectedPhase(phase.value)}
                  style={{
                    background: isSelected ? "rgba(37, 99, 235, 0.2)" : "var(--bg-card, rgba(14, 30, 50, 0.6))",
                    border: `1.5px solid ${isSelected ? "var(--primary-lt, #60a5fa)" : "var(--border, rgba(96, 165, 250, 0.15))"}`,
                    borderRadius: "var(--radius-md, 9px)",
                    padding: "16px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 0 12px rgba(37, 99, 235, 0.3)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: isSelected ? "#93c5fd" : "#64748b", textTransform: "uppercase" }}>
                        Phase {phase.order} of 4
                      </span>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-white, #ffffff)" }}>
                        {phase.label}
                      </div>
                    </div>
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: "2px solid",
                        borderColor: isSelected ? "var(--primary-lt, #60a5fa)" : "#64748b",
                        background: isSelected ? "var(--primary, #2563eb)" : "transparent",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)", lineHeight: 1.4 }}>
                    {phase.desc}
                  </span>
                  <div style={{ fontSize: "11px", color: "#34d399", fontWeight: 600, borderTop: "1px solid rgba(96, 165, 250, 0.1)", paddingTop: "6px" }}>
                    Next Phase: {phase.next}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Workflow Sequence Summary */}
          {(() => {
            const currentPhaseObj = PHASE_WORKFLOW.find((p) => p.value === selectedPhase) || PHASE_WORKFLOW[0];
            return (
              <div
                style={{
                  background: "rgba(37, 99, 235, 0.12)",
                  border: "1px solid rgba(96, 165, 250, 0.25)",
                  borderRadius: "8px",
                  padding: "14px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>Current Phase Selected:</span>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#60a5fa" }}>
                    Phase {currentPhaseObj.order} of 4 — {currentPhaseObj.label}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>Next Survey Phase in Lifecycle:</span>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#34d399" }}>
                    ➔ {currentPhaseObj.next}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Step 2 Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
            <Button variant="secondary" size="md" onClick={() => setCurrentStep(0)}>
              ← Back
            </Button>
            <Button variant="primary" size="md" onClick={() => setCurrentStep(2)}>
              Configure Questions (6 Sections) →
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 3: CONFIGURE QUESTIONS ACROSS 6 FIXED SECTIONS
         ───────────────────────────────────────────────────────────── */}
      {currentStep === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Rules Header & Progress */}
          <div
            style={{
              background: "var(--bg-surface, #0d1b2a)",
              border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
              borderRadius: "var(--radius-lg, 12px)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                Step 3: Question Configuration
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                Sections 1 to 5 require 1 to 5 questions. Section 6 (Feedback & Comments) is optional (0 to 5 questions).
              </p>
            </div>

            {/* Total Questions Count Badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Badge variant={allSectionsHaveQuestions ? "active" : "warning"}>
                {totalQuestionsCount} / 30 Questions Selected
              </Badge>
            </div>
          </div>

          {/* Section Navigation Tabs (1 to 6) */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              paddingBottom: "4px",
            }}
          >
            {QUESTION_BANK.map((sec) => {
              const count = selectedQuestions[sec.number]?.length || 0;
              const isTabActive = activeSectionTab === sec.number;
              const isValid = sec.number === 6 ? count <= 5 : count >= 1 && count <= 5;

              return (
                <button
                  key={sec.number}
                  type="button"
                  onClick={() => setActiveSectionTab(sec.number)}
                  style={{
                    flex: 1,
                    minWidth: "140px",
                    padding: "10px 12px",
                    background: isTabActive ? "rgba(37, 99, 235, 0.25)" : "var(--bg-surface, #0d1b2a)",
                    border: `1.5px solid ${isTabActive ? "var(--primary-lt, #60a5fa)" : "var(--border, rgba(96, 165, 250, 0.15))"}`,
                    borderRadius: "var(--radius-md, 9px)",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim, #64748b)" }}>
                      Section {sec.number}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "var(--radius-sm, 6px)",
                        background: isValid ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: isValid ? "var(--success, #22c55e)" : "var(--danger, #ef4444)",
                      }}
                    >
                      {sec.number === 6 ? (count > 0 ? `${count}/5` : "Optional") : `${count}/5`}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: isTabActive ? "var(--text-white, #ffffff)" : "var(--text-muted, #94a3b8)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {sec.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Section Question Bank */}
          {(() => {
            const currentSection = QUESTION_BANK.find((s) => s.number === activeSectionTab);
            const currentSelected = selectedQuestions[activeSectionTab] || [];
            const atLimit = currentSelected.length >= 5;

            return (
              <div
                style={{
                  background: "var(--bg-surface, #0d1b2a)",
                  border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
                  borderRadius: "var(--radius-lg, 12px)",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {/* Active Section Info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--primary-lt, #60a5fa)" }}>
                        Section {currentSection.number}:
                      </span>
                      <h4 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                        {currentSection.title}
                      </h4>
                      <Badge variant={currentSection.responseType === "star_rating" ? "count" : "info"}>
                        {currentSection.responseType === "star_rating" ? "★ 1-5 Star Ratings" : "✎ Free-Text Descriptive"}
                      </Badge>
                    </div>
                    <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                      {currentSection.description}
                    </p>
                  </div>

                  {/* Section Count */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: currentSelected.length >= 1 ? "var(--success, #22c55e)" : "var(--danger, #ef4444)",
                      }}
                    >
                      {currentSelected.length}/5 Selected
                    </span>
                    {atLimit && (
                      <div style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>Maximum reached</div>
                    )}
                  </div>
                </div>

                {/* Active Configured Questions List with Garbage Delete Icon on the Left */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase" }}>
                      Active Questions in Section {currentSection.number} ({currentSelected.length}/5)
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
                      Use garbage icon on left to delete questions
                    </span>
                  </div>

                  {currentSelected.length === 0 ? (
                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "var(--radius-md, 8px)",
                        background: "rgba(239, 68, 68, 0.08)",
                        border: "1px dashed rgba(239, 68, 68, 0.3)",
                        color: "#fca5a5",
                        fontSize: "13px",
                        textAlign: "center",
                      }}
                    >
                      No questions currently in this section. Add from the 25-question bank below or create a custom question.
                    </div>
                  ) : (
                    currentSelected.map((q, idx) => (
                      <div
                        key={q.question_text || idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 16px",
                          background: "var(--bg-card, rgba(14, 30, 50, 0.6))",
                          border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                          borderRadius: "var(--radius-md, 9px)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* Garbage Icon on the LEFT side straight to the question */}
                        <button
                          type="button"
                          onClick={() => removeQuestion(currentSection.number, q.question_text)}
                          title="Delete question from section"
                          aria-label="Delete question"
                          style={{
                            background: "rgba(239, 68, 68, 0.12)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: "6px",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: "6px 8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s ease",
                            flexShrink: 0,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                            e.currentTarget.style.borderColor = "#ef4444";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>

                        {/* Number Index */}
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "var(--primary-lt, #60a5fa)",
                            background: "rgba(37, 99, 235, 0.15)",
                            minWidth: "28px",
                            height: "24px",
                            padding: "0 6px",
                            borderRadius: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          Q{idx + 1}
                        </span>

                        {/* Question Text */}
                        <span style={{ fontSize: "13.5px", color: "var(--text-white, #ffffff)", lineHeight: 1.45, flex: 1 }}>
                          {q.question_text}
                        </span>

                        {q.is_custom && (
                          <span
                            style={{
                              fontSize: "10px",
                              color: "var(--accent, #06b6d4)",
                              background: "rgba(6, 182, 212, 0.12)",
                              border: "1px solid rgba(6, 182, 212, 0.25)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              flexShrink: 0,
                            }}
                          >
                            Custom (In Bank)
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add from 25-Question Bank Dropdown */}
                {(() => {
                  const availableBank = (currentSection.questions || []).filter(
                    (bq) => !currentSelected.some((sq) => sq.question_text === bq.text)
                  );

                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        paddingTop: "14px",
                        borderTop: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase" }}>
                          + Add Question from Bank ({availableBank.length} Available of 25)
                        </span>
                        {atLimit && (
                          <span style={{ fontSize: "11px", color: "#fbbf24" }}>
                            Limit of 5 questions reached in this section
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <select
                          value={bankSelectValue}
                          onChange={(e) => setBankSelectValue(e.target.value)}
                          disabled={atLimit || availableBank.length === 0}
                          style={{
                            flex: 1,
                            background: "rgba(10, 22, 40, 0.8)",
                            border: "1px solid rgba(96, 165, 250, 0.2)",
                            borderRadius: "var(--radius-md, 8px)",
                            color: bankSelectValue ? "var(--text-white, #ffffff)" : "var(--text-dim, #64748b)",
                            fontSize: "13px",
                            padding: "9px 12px",
                            outline: "none",
                            cursor: atLimit ? "not-allowed" : "pointer",
                          }}
                        >
                          <option value="">-- Choose from 25 standardized questions in bank --</option>
                          {availableBank.map((bq) => (
                            <option key={bq.id} value={bq.text}>
                              {bq.text}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          disabled={atLimit || !bankSelectValue}
                          onClick={() => {
                            if (!bankSelectValue) return;
                            toggleQuestion(
                              currentSection.number,
                              currentSection.title,
                              bankSelectValue,
                              currentSection.responseType
                            );
                            setBankSelectValue("");
                          }}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          + Add to Section
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                {/* Add Custom Question Form (Persists to Database Question Bank) */}
                <form
                  onSubmit={handleAddCustomQuestion}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    paddingTop: "14px",
                    borderTop: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase" }}>
                      + Add Custom Question (Saves to Database Question Bank)
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <Input
                      id="customQuestionInput"
                      placeholder="Type custom question..."
                      value={customQuestionText}
                      onChange={(e) => setCustomQuestionText(e.target.value)}
                      disabled={atLimit}
                      error={customQuestionError}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="md"
                      disabled={atLimit || !customQuestionText.trim()}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      Add Question
                    </Button>
                  </div>
                </form>

                {/* ── Section Navigation Inside Question Section Grid ── */}
                <div
                  style={{
                    borderTop: "1px solid rgba(96, 165, 250, 0.2)",
                    paddingTop: "16px",
                    marginTop: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  {/* Left: Inside-grid Back button (Section 1 returns to Phase; Sections 2 to 6 step back to previous section) */}
                  {activeSectionTab === 1 ? (
                    <GridBackButton onClick={() => setCurrentStep(1)} />
                  ) : (
                    <GridBackButton
                      onClick={() => {
                        setActiveSectionTab((p) => Math.max(1, p - 1));
                        setBankSelectValue("");
                      }}
                    />
                  )}

                  {/* Right: Next Section on Sections 1-5, or Preview & Dispatch on Section 6 */}
                  {activeSectionTab < 6 ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setActiveSectionTab((p) => Math.min(6, p + 1));
                        setBankSelectValue("");
                      }}
                    >
                      Next Section →
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      disabled={!allSectionsHaveQuestions}
                      onClick={() => setCurrentStep(3)}
                    >
                      Preview & Dispatch →
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Validation Banner if any section is empty */}
          {emptySections.length > 0 && totalQuestionsCount > 0 && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "var(--radius-md, 9px)",
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#fca5a5",
                fontSize: "13px",
              }}
            >
              <span>⚠</span>
              <span>
                Section {emptySections.join(", ")} {emptySections.length === 1 ? "has" : "have"} 0 questions selected. Sections 1 to 5 require at least 1 question (max 5). Section 6 is optional.
              </span>
            </div>
          )}

          {totalQuestionsCount === 0 && (
            <div
              style={{
                background: "rgba(37, 99, 235, 0.1)",
                border: "1px solid rgba(96, 165, 250, 0.25)",
                borderRadius: "var(--radius-md, 9px)",
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "var(--primary-lt, #60a5fa)",
                fontSize: "13px",
              }}
            >
              <span>ℹ</span>
              <span>
                Please select between 1 and 5 questions for sections 1 to 5 to configure your survey. Section 6 is optional.
              </span>
            </div>
          )}


        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 4: CLIENT FORM PREVIEW (CATEGORY-WISE CLIENT EXPERIENCE)
         ───────────────────────────────────────────────────────────── */}
      {currentStep === 3 && (() => {
        // Collect category groups with configured questions
        const categoryGroups = [];
        let totalStarCount = 0;

        for (let sec = 1; sec <= 6; sec++) {
          const secMeta = QUESTION_BANK.find((s) => s.number === sec) || QUESTION_BANK[sec - 1];
          const qList = (selectedQuestions[sec] || []).map((q, qIdx) => {
            const isStar = (q.response_type || secMeta.responseType) === "star_rating";
            if (isStar) totalStarCount += 1;
            return {
              ...q,
              uniqueKey: `${sec}_${qIdx}`,
              response_type: q.response_type || secMeta.responseType,
            };
          });

          if (qList.length > 0) {
            categoryGroups.push({
              section_number: sec,
              title: secMeta.title,
              description: secMeta.description,
              responseType: secMeta.responseType,
              questions: qList,
            });
          }
        }

        // Rated questions in simulation
        const ratedCount = Object.keys(previewRatings).filter(
          (k) => previewRatings[k] && previewRatings[k] > 0
        ).length;
        const completionPercentage =
          totalStarCount > 0 ? Math.round((ratedCount / totalStarCount) * 100) : 0;

        let questionCounter = 0;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Preview Control Banner */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(6, 182, 212, 0.12) 100%)",
                border: "1px solid rgba(96, 165, 250, 0.3)",
                borderRadius: "var(--radius-lg, 12px)",
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>👁</span>
                  <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                    Step 4: Preview & Dispatch Survey
                  </h3>
                  <Badge variant="active">Live Simulation</Badge>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                  Preview the client survey experience section-by-section with live answer fields, confirm stakeholder recipient details, and dispatch.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Badge variant="count">{totalQuestionsCount} Questions Configured</Badge>
              </div>
            </div>

            {/* Client Form Simulation Canvas (Preview Form) */}
            <div
              style={{
                background: "#081325",
                border: "1px solid rgba(96, 165, 250, 0.25)",
                borderRadius: "var(--radius-lg, 16px)",
                boxShadow: "0 12px 36px rgba(0, 0, 0, 0.45)",
                overflow: "hidden",
              }}
            >
              {/* Top Browser/Portal Header Bar */}
              <div
                style={{
                  background: "rgba(10, 22, 40, 0.95)",
                  borderBottom: "1px solid rgba(96, 165, 250, 0.15)",
                  padding: "16px 28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
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
                  <Badge variant="count">{selectedPhase} Review</Badge>
                  <span style={{ fontSize: "12px", color: "var(--text-dim, #64748b)" }}>
                    Client: <strong style={{ color: "var(--text-white, #fff)" }}>{currentClient?.name}</strong>
                  </span>
                </div>
              </div>

              {/* Survey Form Body */}
              <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Form Title & Context Card */}
                <div
                  style={{
                    background: "rgba(14, 30, 55, 0.6)",
                    border: "1px solid rgba(96, 165, 250, 0.15)",
                    borderRadius: "var(--radius-md, 10px)",
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                    <h2 style={{ fontSize: "19px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                      Customer Satisfaction Survey
                    </h2>
                  </div>

                  <div style={{ fontSize: "13px", color: "var(--primary-lt, #60a5fa)", fontWeight: 600 }}>
                    Project: {currentProject?.name}
                  </div>

                  <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", lineHeight: 1.6, margin: "4px 0 0 0" }}>
                    Thank you for partnering with Cloud Destinations. Please take a moment to rate your experience below.
                    Your feedback directly guides our engagement teams and continuous delivery improvements.
                  </p>

                  {/* Rating Scale Legend */}
                  <div
                    style={{
                      marginTop: "6px",
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

                {/* Overall Survey Evaluation Progress */}
                <div
                  style={{
                    background: "rgba(11, 23, 42, 0.85)",
                    border: "1px solid rgba(96, 165, 250, 0.2)",
                    borderRadius: "var(--radius-md, 12px)",
                    padding: "16px 22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-white, #ffffff)" }}>
                      Survey Progress
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: completionPercentage === 100 ? "var(--success, #22c55e)" : "var(--primary-lt, #60a5fa)",
                        fontWeight: 600,
                      }}
                    >
                      {ratedCount} of {totalStarCount} rated ({completionPercentage}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      width: "100%",
                      background: "rgba(96, 165, 250, 0.15)",
                      borderRadius: "3px",
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

                {/* Active Category Page (Page-by-page next/prev navigation simulation) */}
                {(() => {
                  if (categoryGroups.length === 0) return null;
                  const currentGroup = categoryGroups[previewCategoryIndex] || categoryGroups[0];
                  const isFirstCat = previewCategoryIndex === 0;
                  const isLastCat = previewCategoryIndex === categoryGroups.length - 1;

                  const currentStarQs = currentGroup.questions.filter((q) => q.response_type === "star_rating");
                  const currentRated = currentStarQs.filter((q) => previewRatings[q.uniqueKey] > 0).length;

                  return (
                    <div
                      style={{
                        background: "rgba(11, 23, 42, 0.85)",
                        border: "1.5px solid rgba(96, 165, 250, 0.22)",
                        borderRadius: "var(--radius-md, 14px)",
                        padding: "24px 26px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "18px",
                        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                      }}
                    >
                      {/* Category Header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "10px",
                          borderBottom: "1px solid rgba(96, 165, 250, 0.15)",
                          paddingBottom: "14px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "4px",
                              height: "20px",
                              background: "linear-gradient(180deg, #38bdf8, #2563eb)",
                              borderRadius: "2px",
                            }}
                          />
                          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                            {currentGroup.title}
                          </h3>
                        </div>

                        <Badge variant={currentGroup.responseType === "star_rating" ? "count" : "info"} size="sm">
                          {currentGroup.responseType === "star_rating" ? "★ 1-5 Star Ratings" : "✎ Feedback & Comments"}
                        </Badge>
                      </div>

                      {/* Questions in this Category */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {currentGroup.questions.map((q, idx) => {
                          const qKey = q.uniqueKey;
                          const isStar = q.response_type === "star_rating";
                          const currentRating = previewRatings[qKey] || 0;
                          const hoverRating = previewHover[qKey] || 0;
                          const activeRating = hoverRating || currentRating;

                          return (
                            <div
                              key={qKey}
                              style={{
                                background: currentRating > 0 ? "rgba(34, 197, 94, 0.05)" : "rgba(14, 28, 48, 0.6)",
                                border: currentRating > 0 ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid rgba(96, 165, 250, 0.12)",
                                borderRadius: "var(--radius-md, 9px)",
                                padding: "16px 20px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                                <span
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: currentRating > 0 ? "var(--success, #22c55e)" : "var(--primary-lt, #60a5fa)",
                                    background: currentRating > 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(37, 99, 235, 0.15)",
                                    minWidth: "28px",
                                    height: "24px",
                                    padding: "0 6px",
                                    borderRadius: "12px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {currentRating > 0 ? "✓" : `Q${idx + 1}`}
                                </span>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-white, #ffffff)", lineHeight: 1.5 }}>
                                    {q.question_text}
                                  </span>
                                  {q.is_custom && (
                                    <span style={{ fontSize: "10px", marginLeft: "8px", color: "var(--accent, #06b6d4)", background: "rgba(6, 182, 212, 0.12)", padding: "1px 5px", borderRadius: "3px" }}>
                                      Custom
                                    </span>
                                  )}
                                </div>
                              </div>

                              {isStar ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginLeft: "34px", flexWrap: "wrap" }}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    {[1, 2, 3, 4, 5].map((starValue) => {
                                      const isFilled = starValue <= activeRating;
                                      return (
                                        <button
                                          key={starValue}
                                          type="button"
                                          onClick={() =>
                                            setPreviewRatings((prev) => ({
                                              ...prev,
                                              [qKey]: prev[qKey] === starValue ? 0 : starValue,
                                            }))
                                          }
                                          onMouseEnter={() =>
                                            setPreviewHover((prev) => ({
                                              ...prev,
                                              [qKey]: starValue,
                                            }))
                                          }
                                          onMouseLeave={() =>
                                            setPreviewHover((prev) => ({
                                              ...prev,
                                              [qKey]: 0,
                                            }))
                                          }
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
                                            width="26"
                                            height="26"
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

                                  <div style={{ fontSize: "12px", minWidth: "120px" }}>
                                    {activeRating > 0 ? (
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
                                        {activeRating} — {RATING_LABELS[activeRating]}
                                      </span>
                                    ) : (
                                      <span style={{ color: "var(--text-dim, #64748b)" }}>
                                        Click stars to test rating
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ marginLeft: "34px" }}>
                                  <textarea
                                    rows={3}
                                    placeholder="Type feedback here (client response simulation)..."
                                    value={previewComments[qKey] || ""}
                                    onChange={(e) =>
                                      setPreviewComments((prev) => ({
                                        ...prev,
                                        [qKey]: e.target.value,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      background: "rgba(10, 20, 36, 0.6)",
                                      border: "1px solid rgba(96, 165, 250, 0.2)",
                                      borderRadius: "var(--radius-md, 8px)",
                                      padding: "10px 14px",
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

                      {/* In-Card Page Navigation Bar (Previous, Category Status, Next) */}
                      <div
                        style={{
                          borderTop: "1px solid rgba(96, 165, 250, 0.15)",
                          paddingTop: "18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        {!isFirstCat ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => setPreviewCategoryIndex((prev) => Math.max(0, prev - 1))}
                          >
                            ← Previous
                          </Button>
                        ) : (
                          <div />
                        )}

                        <span style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", fontWeight: 500 }}>
                          {currentStarQs.length > 0
                            ? `${currentRated} of ${currentStarQs.length} rated in this category`
                            : "Feedback & Comments"}
                        </span>

                        {!isLastCat ? (
                          <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={() => setPreviewCategoryIndex((prev) => Math.min(categoryGroups.length - 1, prev + 1))}
                          >
                            Next Category →
                          </Button>
                        ) : (
                          <span style={{ fontSize: "13px", color: "#34d399", fontWeight: 600 }}>
                            ✓ All 6 Categories Reviewed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Stakeholder Details Box (Order: Preview form, then Stakeholder Details, then button) */}
            <div
              style={{
                background: "var(--bg-surface, #0d1b2a)",
                border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
                borderRadius: "var(--radius-lg, 12px)",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div>
                <h4 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                  Client Stakeholder Details
                </h4>
                <p style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                  Enter the client stakeholder contact name and email address who will receive this survey invitation.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                <Input
                  id="previewStakeholderName"
                  label="Client Stakeholder Contact Name *"
                  placeholder="e.g. Sarah Jenkins"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
                <Input
                  id="previewStakeholderEmail"
                  label="Client Stakeholder Contact Email *"
                  type="email"
                  placeholder="e.g. sjenkins@acmeglobal.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Submission Error Banner */}
            {submitError && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: "var(--radius-md, 9px)",
                  padding: "12px 18px",
                  color: "#fca5a5",
                  fontSize: "13px",
                }}
              >
                ⚠ {submitError}
              </div>
            )}

            {/* Step 4 Single Unified Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
              <Button variant="secondary" size="md" disabled={submitting} onClick={() => setCurrentStep(2)}>
                ← Back to Questions
              </Button>
              <Button
                variant="primary"
                size="lg"
                loading={submitting}
                disabled={submitting || !contactName.trim() || !contactEmail.trim()}
                onClick={handleFinalSubmit}
              >
                Create Survey & Dispatch
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
