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

const RATING_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

export default function CreateSurveyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Initial client/project from query params
  const initialClientId = searchParams.get("client") || "";
  const initialProjectId = searchParams.get("project") || "";

  // Stepper state (0: Client/Project, 1: Phase, 2: Questions, 3: Preview, 4: Review)
  const [currentStep, setCurrentStep] = useState(0);

  // Data fetching state
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Form selections
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [selectedPhase, setSelectedPhase] = useState("Weekly");

  // Selected questions by section ID: { [sectionNumber]: [questionObjects] }
  // Starts EMPTY so the creator selects questions manually (1 to 5 per section)
  const [selectedQuestions, setSelectedQuestions] = useState(() => {
    const initial = {};
    QUESTION_BANK.forEach((section) => {
      initial[section.number] = [];
    });
    return initial;
  });

  // State for simulated client preview interactions
  const [previewCategory, setPreviewCategory] = useState(1);
  const [previewRatings, setPreviewRatings] = useState({});
  const [previewHover, setPreviewHover] = useState({});
  const [previewComments, setPreviewComments] = useState({});

  // Active question section tab (1 to 6)
  const [activeSectionTab, setActiveSectionTab] = useState(1);

  // Custom question input state
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [customQuestionError, setCustomQuestionError] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdSurvey, setCreatedSurvey] = useState(null);

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
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

  // Add custom question to active section
  const handleAddCustomQuestion = (e) => {
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

    setSelectedQuestions((prev) => ({
      ...prev,
      [activeSectionTab]: [
        ...currentList,
        {
          section_number: activeSectionTab,
          section_title: currentSectionMeta.title,
          question_text: trimmed,
          response_type: currentSectionMeta.responseType,
          is_custom: true,
        },
      ],
    }));

    setCustomQuestionText("");
    setCustomQuestionError("");
  };

  // Remove a question
  const removeQuestion = (sectionNumber, questionText) => {
    setSelectedQuestions((prev) => ({
      ...prev,
      [sectionNumber]: (prev[sectionNumber] || []).filter((q) => q.question_text !== questionText),
    }));
  };

  // Validation checkers across all 6 sections
  const totalQuestionsCount = Object.values(selectedQuestions).reduce((acc, list) => acc + list.length, 0);
  const allSectionsHaveQuestions = [1, 2, 3, 4, 5, 6].every(
    (sec) => (selectedQuestions[sec]?.length || 0) >= 1 && (selectedQuestions[sec]?.length || 0) <= 5
  );
  const emptySections = [1, 2, 3, 4, 5, 6].filter((sec) => (selectedQuestions[sec]?.length || 0) === 0);

  // Stepper definition (5 steps)
  const steps = [
    { label: "Client & Project" },
    { label: "Survey Phase" },
    { label: "Question Bank (6 Sections)" },
    { label: "Client Form Preview" },
    { label: "Review & Create" },
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

    const payload = {
      client_id: parseInt(selectedClientId, 10),
      project_id: parseInt(selectedProjectId, 10),
      phase: selectedPhase,
      questions: flatQuestions,
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

  // SUCCESS STATE
  if (createdSurvey) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 20px",
          maxWidth: "600px",
          margin: "0 auto",
          textAlign: "center",
          gap: "20px",
        }}
      >
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
            fontSize: "30px",
          }}
        >
          ✓
        </div>

        <div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: "0 0 8px 0" }}>
            Survey Created Successfully!
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: 0, lineHeight: 1.5 }}>
            Your survey has been configured and is ready to be dispatched to the client.
          </p>
        </div>

        {/* Survey Reference Box */}
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.25))",
            borderRadius: "var(--radius-md, 9px)",
            padding: "16px 24px",
            width: "100%",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "var(--text-muted, #94a3b8)" }}>Survey Code:</span>
            <code style={{ color: "var(--primary-lt, #60a5fa)", fontWeight: 700 }}>{createdSurvey.survey_code}</code>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "var(--text-muted, #94a3b8)" }}>Status:</span>
            <Badge variant="active">Ready</Badge>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "var(--text-muted, #94a3b8)" }}>Questions:</span>
            <span style={{ color: "var(--text-white, #ffffff)", fontWeight: 600 }}>
              {createdSurvey.questions?.length || totalQuestionsCount} questions across 6 sections
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
          <Link to="/surveys">
            <Button variant="primary" size="md">
              View All Surveys
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="secondary" size="md">
              Dashboard
            </Button>
          </Link>
        </div>
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
                  label: `${c.name} (${c.client_code})`,
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
                  label: `${p.name} (${p.project_code})`,
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
                    <code style={{ color: "var(--accent, #06b6d4)", fontSize: "12px", fontWeight: 700 }}>
                      {currentProject.project_code}
                    </code>
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
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-white, #ffffff)", margin: 0 }}>
              Step 2: Select Project Phase
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
              Indicate the current project milestone or phase being evaluated.
            </p>
          </div>

          {/* Phase Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
            {SURVEY_PHASES.map((phase) => {
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
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-white, #ffffff)" }}>
                      {phase.label}
                    </span>
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
                </div>
              );
            })}
          </div>

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
                Each of the 6 sections must have between <strong>1 and 5 questions</strong> (max 30 total). No section can be skipped.
              </p>
            </div>

            {/* Total Questions Count Badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Badge variant={allSectionsHaveQuestions ? "active" : "warning"}>
                {totalQuestionsCount} / 30 Total Questions
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
              const isValid = count >= 1 && count <= 5;

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
                      {count}/5
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

                {/* Question Selection List (from 25 questions) */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    maxHeight: "360px",
                    overflowY: "auto",
                    paddingRight: "6px",
                  }}
                >
                  {currentSection.questions.map((q) => {
                    const isChecked = currentSelected.some((sel) => sel.question_text === q.text);
                    const disabled = !isChecked && atLimit;

                    return (
                      <label
                        key={q.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                          padding: "10px 14px",
                          background: isChecked ? "rgba(37, 99, 235, 0.12)" : "var(--bg-card, rgba(14, 30, 50, 0.5))",
                          border: `1px solid ${isChecked ? "rgba(96, 165, 250, 0.3)" : "var(--border, rgba(96, 165, 250, 0.1))"}`,
                          borderRadius: "var(--radius-md, 9px)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.45 : 1,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={disabled}
                          onChange={() =>
                            toggleQuestion(
                              currentSection.number,
                              currentSection.title,
                              q.text,
                              currentSection.responseType
                            )
                          }
                          style={{
                            accentColor: "var(--primary, #2563eb)",
                            width: "16px",
                            height: "16px",
                            marginTop: "2px",
                            cursor: disabled ? "not-allowed" : "pointer",
                          }}
                        />
                        <span style={{ fontSize: "13px", color: "var(--text-main, #e2e8f0)", lineHeight: 1.4 }}>
                          {q.text}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Add Custom Question Form */}
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
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted, #94a3b8)", textTransform: "uppercase" }}>
                    + Add Custom Question to Section {currentSection.number}
                  </span>
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
                Section {emptySections.join(", ")} {emptySections.length === 1 ? "has" : "have"} 0 questions selected. Each section requires at least 1 question (max 5).
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
                Please select between 1 and 5 questions for each of the 6 sections above to configure your survey.
              </span>
            </div>
          )}

          {/* Step 3 Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
            <Button variant="secondary" size="md" onClick={() => setCurrentStep(1)}>
              ← Back to Phase
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!allSectionsHaveQuestions}
              onClick={() => setCurrentStep(3)}
            >
              Continue to Preview →
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 4: CLIENT FORM PREVIEW (CATEGORY-WISE CLIENT EXPERIENCE)
         ───────────────────────────────────────────────────────────── */}
      {currentStep === 3 && (() => {
        const activeSectionMeta = QUESTION_BANK.find((s) => s.number === previewCategory) || QUESTION_BANK[0];
        const activeQuestions = selectedQuestions[previewCategory] || [];
        const isLastCategory = previewCategory === 6;
        const isFirstCategory = previewCategory === 1;

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
                    Step 4: Client Form Preview (Category-Wise)
                  </h3>
                  <Badge variant="active">Live Simulation</Badge>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
                  This simulates how the client will experience the survey section by section. Complete each category and click &quot;Next Section&quot; to proceed.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Badge variant="count">{totalQuestionsCount} Questions Configured</Badge>
              </div>
            </div>

            {/* Client Form Simulation Canvas */}
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
                  <Badge variant="count">{selectedPhase} Evaluation</Badge>
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
                    <Badge variant="active">{currentProject?.project_code}</Badge>
                  </div>

                  <div style={{ fontSize: "13px", color: "var(--primary-lt, #60a5fa)", fontWeight: 600 }}>
                    Project: {currentProject?.name}
                  </div>

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

                {/* Section Navigation Tabs (Category Stepper) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted, #94a3b8)", letterSpacing: "0.5px" }}>
                      Survey Categories ({previewCategory}/6)
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--primary-lt, #60a5fa)", fontWeight: 600 }}>
                      Click any category tab or use Next Section below
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
                    {QUESTION_BANK.map((sec) => {
                      const isCurrent = previewCategory === sec.number;
                      const qCount = (selectedQuestions[sec.number] || []).length;
                      const ratedCount = (selectedQuestions[sec.number] || []).filter((_, qIdx) => {
                        const qKey = `${sec.number}_${qIdx}`;
                        return (previewRatings[qKey] || 0) > 0 || (previewComments[qKey] || "").trim().length > 0;
                      }).length;
                      const isComplete = qCount > 0 && ratedCount >= qCount;

                      return (
                        <button
                          key={sec.number}
                          type="button"
                          onClick={() => setPreviewCategory(sec.number)}
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
                            padding: "10px 8px",
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
                              {isComplete ? "✓" : sec.number}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: isCurrent
                                  ? "var(--text-white, #fff)"
                                  : isComplete
                                  ? "var(--success, #22c55e)"
                                  : "var(--text-muted, #94a3b8)",
                              }}
                            >
                              Sec {sec.number}
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
                            {sec.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Category Question Card */}
                <div
                  style={{
                    background: "rgba(11, 23, 42, 0.85)",
                    border: "1.5px solid rgba(96, 165, 250, 0.25)",
                    borderRadius: "var(--radius-md, 12px)",
                    padding: "26px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "22px",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  {/* Category Header */}
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
                          Section {activeSectionMeta.number} of 6
                        </span>
                        <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
                          {activeSectionMeta.title}
                        </h3>
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", margin: "6px 0 0 0" }}>
                        {activeSectionMeta.description}
                      </p>
                    </div>

                    <Badge variant={activeSectionMeta.responseType === "star_rating" ? "count" : "info"}>
                      {activeSectionMeta.responseType === "star_rating" ? "★ 1-5 Star Ratings" : "✎ Free-Text Comments"}
                    </Badge>
                  </div>

                  {/* Questions in Active Category */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    {activeQuestions.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "13px" }}>
                        No questions selected in this section. Please return to Step 3 to add questions.
                      </div>
                    ) : (
                      activeQuestions.map((q, qIdx) => {
                        const qKey = `${activeSectionMeta.number}_${qIdx}`;
                        const isStarRating = activeSectionMeta.responseType === "star_rating";
                        const currentRating = previewRatings[qKey] || 0;
                        const hoverRating = previewHover[qKey] || 0;
                        const activeRating = hoverRating || currentRating;

                        return (
                          <div
                            key={qIdx}
                            style={{
                              background: "rgba(14, 28, 48, 0.6)",
                              border: "1px solid rgba(96, 165, 250, 0.12)",
                              borderRadius: "var(--radius-md, 9px)",
                              padding: "18px 20px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "14px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--primary-lt, #60a5fa)", minWidth: "24px" }}>
                                {qIdx + 1}.
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

                            {/* Response Options */}
                            {isStarRating ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginLeft: "34px", flexWrap: "wrap" }}>
                                {/* 5 Star Interactive Buttons */}
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

                                {/* Active Rating Indicator */}
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
                              /* Free-Text Input Area for Section 6 */
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
                      })
                    )}
                  </div>

                  {/* Category-Wise In-Form Navigation Bar */}
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
                    {!isFirstCategory ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => setPreviewCategory((prev) => prev - 1)}
                      >
                        ← Previous Section ({previewCategory - 1}/6)
                      </Button>
                    ) : (
                      <div />
                    )}

                    <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontWeight: 600 }}>
                      Section {previewCategory} of 6: {activeSectionMeta.title}
                    </span>

                    {!isLastCategory ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => setPreviewCategory((prev) => prev + 1)}
                      >
                        Next Section ({previewCategory + 1}/6) →
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => setCurrentStep(4)}
                      >
                        Proceed to Review & Create →
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
              <Button variant="secondary" size="md" onClick={() => setCurrentStep(2)}>
                ← Back to Questions
              </Button>
              <Button variant="primary" size="md" onClick={() => setCurrentStep(4)}>
                Continue to Review & Create →
              </Button>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          STEP 5: REVIEW & CREATE SURVEY (NO APPROVAL STATE)
         ───────────────────────────────────────────────────────────── */}
      {currentStep === 4 && (
        <div
          style={{
            background: "var(--bg-surface, #0d1b2a)",
            border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
              Step 5: Review & Create Survey
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
              Please review all survey details before creating your survey.
            </p>
          </div>

          {/* Survey Summary Tile */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              background: "rgba(10, 22, 40, 0.6)",
              border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
              borderRadius: "var(--radius-md, 9px)",
              padding: "18px",
            }}
          >
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", textTransform: "uppercase", fontWeight: 600 }}>
                Client Organization
              </span>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-white, #ffffff)", marginTop: "2px" }}>
                {currentClient?.name || "Selected Client"}
              </div>
            </div>

            <div>
              <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", textTransform: "uppercase", fontWeight: 600 }}>
                Project
              </span>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--primary-lt, #60a5fa)", marginTop: "2px" }}>
                {currentProject?.name} ({currentProject?.project_code})
              </div>
            </div>

            <div>
              <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", textTransform: "uppercase", fontWeight: 600 }}>
                Phase
              </span>
              <div style={{ marginTop: "2px" }}>
                <Badge variant="count">{selectedPhase}</Badge>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", textTransform: "uppercase", fontWeight: 600 }}>
                Total Questions
              </span>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--success, #22c55e)", marginTop: "2px" }}>
                {totalQuestionsCount} across 6 sections
              </div>
            </div>
          </div>

          {/* Section-by-Section Breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted, #94a3b8)", margin: 0 }}>
              Questions Breakdown
            </h4>

            {QUESTION_BANK.map((sec) => {
              const qList = selectedQuestions[sec.number] || [];
              return (
                <div
                  key={sec.number}
                  style={{
                    background: "var(--bg-card, rgba(14, 30, 50, 0.5))",
                    border: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
                    borderRadius: "var(--radius-md, 9px)",
                    padding: "14px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--primary-lt, #60a5fa)" }}>
                        Section {sec.number}: {sec.title}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
                        ({sec.responseType === "star_rating" ? "★ Star Rating" : "✎ Free Text"})
                      </span>
                    </div>
                    <Badge variant="count">{qList.length}/5</Badge>
                  </div>

                  <ul style={{ margin: "4px 0 0 18px", padding: 0, fontSize: "13px", color: "var(--text-main, #e2e8f0)", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {qList.map((q, idx) => (
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

          {/* Step 5 Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
            <Button variant="secondary" size="md" disabled={submitting} onClick={() => setCurrentStep(3)}>
              ← Back to Preview
            </Button>
            <Button
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={submitting}
              onClick={handleFinalSubmit}
            >
              Create Survey
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
