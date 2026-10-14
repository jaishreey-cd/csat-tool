import { useState } from "react";
import { Link } from "react-router-dom";
import Badge from "./Badge";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import Button from "./Button";

export default function ClientProjectList({
  clients = [],
  loading = false,
  error = null,
  onRetry = null,
  viewMode = "grid", // 'grid' | 'table'
}) {
  // Color palette for client avatar gradients
  const avatarGradients = [
    "linear-gradient(135deg, #2563eb, #06b6d4)",
    "linear-gradient(135deg, #7c3aed, #ec4899)",
    "linear-gradient(135deg, #059669, #10b981)",
    "linear-gradient(135deg, #d97706, #f59e0b)",
    "linear-gradient(135deg, #4f46e5, #6366f1)",
  ];

  // Helper to generate initials for avatar
  const getClientInitials = (name) => {
    if (!name) return "CL";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(440px, 1fr))" : "1fr",
          gap: "20px",
          width: "100%",
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: "220px",
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
  // RENDER 1: GRID CARDS VIEW (Modern Showcase)
  // ─────────────────────────────────────────────────────────────
  if (viewMode === "grid") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))",
          gap: "20px",
          width: "100%",
        }}
        className="client-cards-grid"
      >
        {clients.map((client, index) => {
          const isArchived = !client.is_active;
          const projects = client.projects || [];
          const projectCount = projects.length;
          const avatarGradient = avatarGradients[index % avatarGradients.length];

          return (
            <div
              key={client.id}
              className="client-card"
              style={{
                background: "var(--bg-surface, #0d1b2a)",
                border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
                borderRadius: "var(--radius-lg, 12px)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
                position: "relative",
                transition: "all 0.2s ease",
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  {/* Client Avatar Monogram */}
                  <div
                    style={{
                      width: "46px",
                      height: "46px",
                      borderRadius: "10px",
                      background: avatarGradient,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "#ffffff",
                      letterSpacing: "0.5px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                      flexShrink: 0,
                    }}
                  >
                    {getClientInitials(client.name)}
                  </div>

                  {/* Client Name & Code */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <h3
                        style={{
                          fontSize: "17px",
                          fontWeight: 700,
                          color: isArchived ? "var(--text-dim, #64748b)" : "var(--text-white, #ffffff)",
                          margin: 0,
                          letterSpacing: "-0.2px",
                        }}
                      >
                        {client.name}
                      </h3>
                      {isArchived && <Badge variant="archived">Archived</Badge>}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <code
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--primary-lt, #60a5fa)",
                          background: "rgba(37, 99, 235, 0.12)",
                          border: "1px solid rgba(96, 165, 250, 0.25)",
                          padding: "2px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {client.client_code}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Project Count Pill */}
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-main, #e2e8f0)",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-full, 9999px)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {projectCount} {projectCount === 1 ? "Project" : "Projects"}
                </span>
              </div>

              {/* Projects Divider / Sub-header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: "6px",
                  borderTop: "1px solid var(--border, rgba(96, 165, 250, 0.1))",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                    color: "var(--text-dim, #64748b)",
                  }}
                >
                  Projects Portfolio
                </span>
              </div>

              {/* Projects List */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "320px",
                  overflowY: "auto",
                }}
              >
                {projects.length === 0 ? (
                  <div
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      color: "var(--text-dim, #64748b)",
                      fontSize: "13px",
                      background: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "var(--radius-md, 9px)",
                    }}
                  >
                    No projects found for this client.
                  </div>
                ) : (
                  projects.map((proj) => {
                    const isProjArchived = !proj.is_active;

                    return (
                      <div
                        key={proj.id}
                        className="project-tile"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "var(--bg-card, rgba(14, 30, 50, 0.6))",
                          border: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
                          borderRadius: "var(--radius-md, 9px)",
                          gap: "12px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* Project Info */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          {/* Active / Status Dot */}
                          <span
                            style={{
                              width: "7px",
                              height: "7px",
                              borderRadius: "50%",
                              background: isProjArchived ? "#64748b" : "var(--success, #22c55e)",
                              boxShadow: isProjArchived ? "none" : "0 0 8px rgba(34, 197, 94, 0.6)",
                              flexShrink: 0,
                            }}
                            aria-hidden="true"
                          />

                          {/* Code */}
                          <code
                            style={{
                              color: "var(--accent, #06b6d4)",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: "rgba(6, 182, 212, 0.1)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              flexShrink: 0,
                            }}
                          >
                            {proj.project_code}
                          </code>

                          {/* Name */}
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 500,
                              color: isProjArchived ? "var(--text-dim, #64748b)" : "var(--text-main, #e2e8f0)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={proj.name}
                          >
                            {proj.name}
                          </span>
                        </div>

                        {/* Action Link: Create Survey */}
                        <div style={{ flexShrink: 0 }}>
                          <Link to={`/surveys/new?client=${client.id}&project=${proj.id}`}>
                            <button
                              type="button"
                              className="survey-action-btn"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "rgba(37, 99, 235, 0.15)",
                                border: "1px solid rgba(96, 165, 250, 0.3)",
                                color: "var(--primary-lt, #60a5fa)",
                                borderRadius: "var(--radius-sm, 6px)",
                                padding: "4px 10px",
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
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        <style>{`
          .client-card:hover {
            border-color: rgba(96, 165, 250, 0.45) !important;
            box-shadow: 0 8px 30px rgba(37, 99, 235, 0.18) !important;
          }
          .project-tile:hover {
            background: rgba(30, 58, 95, 0.35) !important;
            border-color: rgba(96, 165, 250, 0.3) !important;
          }
          .survey-action-btn:hover {
            background: var(--primary, #2563eb) !important;
            color: #ffffff !important;
            border-color: var(--primary-lt, #60a5fa) !important;
          }
          @media (max-width: 600px) {
            .client-cards-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER 2: TABLE / DIRECTORY VIEW (Executive List)
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "130px 1fr 140px 100px",
          gap: "16px",
          padding: "14px 24px",
          background: "rgba(10, 22, 40, 0.6)",
          borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
          fontSize: "12px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: "var(--text-dim, #64748b)",
        }}
      >
        <span>Client Code</span>
        <span>Client & Associated Projects</span>
        <span>Projects Count</span>
        <span style={{ textAlign: "right" }}>Action</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {clients.map((client) => {
          const isArchived = !client.is_active;
          const projects = client.projects || [];

          return (
            <div
              key={client.id}
              style={{
                borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.08))",
                padding: "18px 24px",
                display: "grid",
                gridTemplateColumns: "130px 1fr 140px 100px",
                gap: "16px",
                alignItems: "flex-start",
              }}
            >
              {/* Client Code */}
              <div>
                <code
                  style={{
                    color: "var(--primary-lt, #60a5fa)",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: "rgba(37, 99, 235, 0.1)",
                    border: "1px solid rgba(96, 165, 250, 0.2)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {client.client_code}
                </code>
              </div>

              {/* Client Name & Nested Projects */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: isArchived ? "var(--text-dim, #64748b)" : "var(--text-white, #ffffff)",
                    }}
                  >
                    {client.name}
                  </span>
                  {isArchived && <Badge variant="archived">Archived</Badge>}
                </div>

                {/* Inline project chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "var(--bg-card, rgba(14, 30, 50, 0.7))",
                        border: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                        borderRadius: "var(--radius-sm, 6px)",
                        padding: "4px 8px",
                        fontSize: "12px",
                      }}
                    >
                      <code style={{ color: "var(--accent, #06b6d4)", fontSize: "11px", fontWeight: 600 }}>
                        {proj.project_code}
                      </code>
                      <span style={{ color: "var(--text-main, #e2e8f0)" }}>{proj.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Count */}
              <div>
                <Badge variant="count">
                  {projects.length} {projects.length === 1 ? "project" : "projects"}
                </Badge>
              </div>

              {/* Action */}
              <div style={{ textAlign: "right" }}>
                <Link to={`/surveys/new?client=${client.id}`}>
                  <Button variant="ghost" size="sm" style={{ fontSize: "12px" }}>
                    ＋ Survey
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
