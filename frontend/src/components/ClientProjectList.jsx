import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Badge from "./Badge";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";

export default function ClientProjectList({
  clients = [],
  loading = false,
  error = null,
  onRetry = null,
  searchQuery = "",
}) {
  // Set of expanded client IDs for the directory view
  const [expandedClients, setExpandedClients] = useState(new Set());

  // Auto-expand clients when search query matches project name/code or client name/code
  useEffect(() => {
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matched = new Set();
      clients.forEach((c) => {
        const clientMatches =
          c.name?.toLowerCase().includes(q) ||
          c.client_code?.toLowerCase().includes(q);
        const projectMatches = c.projects?.some(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.project_code?.toLowerCase().includes(q)
        );
        if (clientMatches || projectMatches) {
          matched.add(c.id);
        }
      });
      setExpandedClients(matched);
    }
  }, [searchQuery, clients]);

  // Accordion toggle: opening one client automatically closes/collapses the others
  const toggleClientExpand = (clientId) => {
    setExpandedClients((prev) => {
      if (prev.has(clientId)) {
        return new Set(); // Close if clicked again
      }
      return new Set([clientId]); // Open only the selected client and collapse others
    });
  };

  // Status badge styling helper for project statuses
  const renderStatusBadge = (status) => {
    const s = status || "Not Started";
    const lower = s.toLowerCase();

    if (lower.includes("overdue")) {
      return (
        <Badge
          variant="warning"
          size="sm"
          style={{
            background: "rgba(239, 68, 68, 0.14)",
            color: "#f87171",
            borderColor: "rgba(239, 68, 68, 0.35)",
            fontWeight: 600,
          }}
        >
          ● In Progress - Overdue
        </Badge>
      );
    }
    if (lower.includes("progress")) {
      return (
        <Badge
          variant="info"
          size="sm"
          style={{
            background: "rgba(6, 182, 212, 0.14)",
            color: "#06b6d4",
            borderColor: "rgba(6, 182, 212, 0.35)",
            fontWeight: 600,
          }}
        >
          ● In Progress
        </Badge>
      );
    }
    if (lower.includes("completed")) {
      return (
        <Badge
          variant="active"
          size="sm"
          style={{
            background: "rgba(34, 197, 94, 0.14)",
            color: "#22c55e",
            borderColor: "rgba(34, 197, 94, 0.35)",
            fontWeight: 600,
          }}
        >
          ● Completed
        </Badge>
      );
    }
    if (lower.includes("hold")) {
      return (
        <Badge
          variant="warning"
          size="sm"
          style={{
            background: "rgba(245, 158, 11, 0.14)",
            color: "#f59e0b",
            borderColor: "rgba(245, 158, 11, 0.35)",
            fontWeight: 600,
          }}
        >
          ● On Hold
        </Badge>
      );
    }
    if (lower.includes("not started")) {
      return (
        <Badge
          variant="archived"
          size="sm"
          style={{
            background: "rgba(148, 163, 184, 0.1)",
            color: "#94a3b8",
            borderColor: "rgba(148, 163, 184, 0.25)",
            fontWeight: 600,
          }}
        >
          ● Not Started
        </Badge>
      );
    }
    if (lower.includes("archived")) {
      return (
        <Badge
          variant="archived"
          size="sm"
          style={{
            background: "rgba(100, 116, 139, 0.14)",
            color: "#94a3b8",
            borderColor: "rgba(100, 116, 139, 0.25)",
            fontWeight: 600,
          }}
        >
          ● Archived
        </Badge>
      );
    }
    return (
      <Badge
        variant="archived"
        size="sm"
        style={{
          background: "rgba(148, 163, 184, 0.1)",
          color: "#94a3b8",
          borderColor: "rgba(148, 163, 184, 0.25)",
          fontWeight: 600,
        }}
      >
        ● {s}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              height: "56px",
              background: "var(--bg-surface, #0d1b2a)",
              borderRadius: "var(--radius-lg, 12px)",
              border: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
              animation: "pulse 1.5s infinite",
            }}
          />
        ))}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.25; }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (!clients || clients.length === 0) {
    return (
      <EmptyState
        title="No clients found"
        description="No matching clients or projects found. Try adjusting your search."
        icon="🏢"
      />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // EXPANDABLE CLIENT & PROJECT DIRECTORY VIEW
  // ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: "var(--bg-surface, #0d1b2a)",
        border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
        borderRadius: "var(--radius-lg, 12px)",
        overflow: "hidden",
        width: "100%",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
      }}
    >
      {/* Directory Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          background: "rgba(10, 22, 40, 0.7)",
          borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
          fontSize: "12px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: "var(--text-dim, #64748b)",
        }}
      >
        <span>Client Directory</span>
        <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", textTransform: "none", letterSpacing: "normal" }}>
          Click to view projects
        </span>
      </div>

      {/* Expandable Client Directory Rows */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {clients.map((client) => {
          const isArchived = !client.is_active;
          const projects = client.projects || [];
          const projectCount = projects.length;
          const isExpanded = expandedClients.has(client.id);

          return (
            <div
              key={client.id}
              style={{
                borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.08))",
                transition: "background 0.15s ease",
              }}
            >
              {/* Client Row: Only chevron, name, project count, and optional survey action */}
              <div
                className="client-directory-row"
                onClick={() => toggleClientExpand(client.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleClientExpand(client.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 24px",
                  cursor: "pointer",
                  background: isExpanded ? "rgba(14, 30, 50, 0.55)" : "transparent",
                  gap: "16px",
                  userSelect: "none",
                  outline: "none",
                }}
              >
                {/* Left: Expand/Collapse Chevron + Client Name + Project Count */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flexWrap: "wrap" }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      color: isExpanded ? "var(--primary-lt, #60a5fa)" : "var(--text-dim, #64748b)",
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>

                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: isArchived ? "var(--text-dim, #64748b)" : "var(--text-white, #ffffff)",
                      letterSpacing: "-0.2px",
                    }}
                  >
                    {client.name}
                  </span>

                  <span
                    style={{
                      color: "var(--text-dim, #64748b)",
                      fontSize: "14px",
                      fontWeight: 400,
                      userSelect: "none",
                    }}
                  >
                    —
                  </span>

                  <Badge variant="count" size="sm">
                    {projectCount} {projectCount === 1 ? "Project" : "Projects"}
                  </Badge>

                  <Badge variant="info" size="sm">
                    5 Survey Phases
                  </Badge>

                  {isArchived && (
                    <Badge variant="archived" size="sm">
                      Archived
                    </Badge>
                  )}
                </div>

                {/* Right: Expand/Collapse indicator */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: isExpanded ? "var(--primary-lt, #60a5fa)" : "var(--text-dim, #64748b)",
                    fontSize: "12px",
                    fontWeight: 500,
                    flexShrink: 0,
                    transition: "color 0.15s ease",
                  }}
                >
                  <span>{isExpanded ? "Hide Projects" : "View Projects"}</span>
                  <span style={{ fontSize: "10px" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Inline Expanded Client Projects */}
              {isExpanded && (
                <div
                  style={{
                    padding: "14px 24px 20px 24px",
                    background: "rgba(10, 22, 40, 0.45)",
                    borderTop: "1px solid rgba(96, 165, 250, 0.1)",
                    animation: "fadeIn 0.2s ease-in-out",
                  }}
                >
                  {projects.length === 0 ? (
                    <div
                      style={{
                        padding: "24px 20px",
                        textAlign: "center",
                        color: "var(--text-dim, #64748b)",
                        fontSize: "13px",
                        background: "rgba(255, 255, 255, 0.02)",
                        borderRadius: "10px",
                        border: "1px dashed var(--border, rgba(96, 165, 250, 0.15))",
                      }}
                    >
                      No projects associated with this client.
                    </div>
                  ) : (
                    <div
                      style={{
                        borderRadius: "10px",
                        border: "1px solid rgba(96, 165, 250, 0.18)",
                        overflowX: "auto",
                        background: "rgba(13, 27, 44, 0.7)",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
                      }}
                    >
                      <div style={{ minWidth: "660px" }}>
                        {/* Nested Projects Table Header */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(220px, 2.5fr) 140px 130px 110px",
                            gap: "14px",
                            padding: "12px 20px",
                            background: "rgba(15, 23, 42, 0.85)",
                            borderBottom: "1px solid rgba(96, 165, 250, 0.12)",
                            fontSize: "11px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.6px",
                            color: "var(--text-dim, #64748b)",
                          }}
                        >
                          <span>Project</span>
                          <span>Status</span>
                          <span>Phases</span>
                          <span style={{ textAlign: "right" }}>Action</span>
                        </div>

                        {/* Nested Project Rows */}
                        {projects.map((proj) => {
                          const isProjArchived = !proj.is_active;
                          const projectStatus =
                            proj.status || (isProjArchived ? "Archived" : "Not Started");
                          const hasSurvey =
                            proj.survey_id ||
                            (proj.survey_status &&
                              proj.survey_status !== "Survey Not Created" &&
                              proj.survey_status !== "Archived");

                          const qLower = searchQuery?.trim().toLowerCase();
                          const isMatchedBySearch =
                            Boolean(qLower) &&
                            proj.name?.toLowerCase().includes(qLower);

                          return (
                            <div
                              key={proj.id}
                              className="project-directory-row"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(220px, 2.5fr) 140px 130px 110px",
                                gap: "14px",
                                alignItems: "center",
                                padding: "13px 20px",
                                borderBottom: "1px solid rgba(96, 165, 250, 0.06)",
                                borderLeft: isMatchedBySearch
                                  ? "3px solid var(--accent, #06b6d4)"
                                  : "3px solid transparent",
                                background: isMatchedBySearch
                                  ? "rgba(6, 182, 212, 0.08)"
                                  : "transparent",
                                fontSize: "13px",
                                transition: "background 0.15s ease",
                              }}
                            >
                              {/* Project Name */}
                              <div style={{ minWidth: 0 }}>
                                <Link
                                  to={`/projects/${proj.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    textDecoration: "none",
                                    fontWeight: 600,
                                    color: isProjArchived
                                      ? "var(--text-dim, #64748b)"
                                      : "var(--text-white, #ffffff)",
                                    display: "block",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    transition: "color 0.15s ease",
                                  }}
                                  title={`View Analytics for ${proj.name}`}
                                >
                                  {proj.name}
                                </Link>
                                {proj.team_name && (
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--text-dim, #64748b)",
                                      display: "block",
                                      marginTop: "2px",
                                    }}
                                  >
                                    {proj.team_name}
                                  </span>
                                )}
                              </div>

                              {/* Accurate Status Badge */}
                              <div>{renderStatusBadge(projectStatus)}</div>

                              {/* Phases Column */}
                              <div>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: hasSurvey ? "#60a5fa" : "#94a3b8",
                                    background: hasSurvey ? "rgba(37, 99, 235, 0.14)" : "rgba(255, 255, 255, 0.04)",
                                    border: `1px solid ${hasSurvey ? "rgba(96, 165, 250, 0.3)" : "rgba(255, 255, 255, 0.08)"}`,
                                    padding: "3px 8px",
                                    borderRadius: "12px",
                                    display: "inline-block",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {hasSurvey ? "1/5 Complete" : "0/5 Phases"}
                                </span>
                              </div>

                              {/* Contextual Action */}
                              <div style={{ textAlign: "right" }}>
                                {hasSurvey ? (
                                  <Link
                                    to={`/surveys?search=${encodeURIComponent(proj.name)}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ textDecoration: "none" }}
                                  >
                                    <button
                                      type="button"
                                      className="survey-view-btn"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        background: "rgba(6, 182, 212, 0.12)",
                                        border: "1px solid rgba(6, 182, 212, 0.3)",
                                        color: "var(--accent, #06b6d4)",
                                        borderRadius: "var(--radius-sm, 6px)",
                                        padding: "5px 12px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                      }}
                                    >
                                      View Survey
                                    </button>
                                  </Link>
                                ) : (
                                  <Link
                                    to={`/surveys/new?client=${client.id}&project=${proj.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ textDecoration: "none" }}
                                  >
                                    <button
                                      type="button"
                                      className="survey-action-btn"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        background: "rgba(37, 99, 235, 0.15)",
                                        border: "1px solid rgba(96, 165, 250, 0.3)",
                                        color: "var(--primary-lt, #60a5fa)",
                                        borderRadius: "var(--radius-sm, 6px)",
                                        padding: "5px 12px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                      }}
                                    >
                                      <span>＋</span>
                                      <span>Survey</span>
                                    </button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .client-directory-row:hover {
          background: rgba(30, 58, 95, 0.35) !important;
        }
        .client-directory-row:focus-visible {
          background: rgba(30, 58, 95, 0.45) !important;
          outline: 2px solid var(--primary, #2563eb);
          outline-offset: -2px;
        }
        .project-directory-row:hover {
          background: rgba(30, 58, 95, 0.3) !important;
        }
        .survey-action-btn:hover {
          background: var(--primary, #2563eb) !important;
          color: #ffffff !important;
          border-color: var(--primary-lt, #60a5fa) !important;
        }
        .survey-view-btn:hover {
          background: var(--accent, #06b6d4) !important;
          color: #0b1329 !important;
          border-color: var(--accent, #06b6d4) !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 720px) {
          .project-directory-row {
            grid-template-columns: 1fr auto !important;
            row-gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}

