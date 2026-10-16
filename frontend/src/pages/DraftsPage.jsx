import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import surveysApi from "../api/surveysApi";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";

export default function DraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDrafts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await surveysApi.getSurveys({ status: "Draft" }, true);
      const allDrafts = (res.surveys || []).filter((s) => s.status === "Draft");
      setDrafts(allDrafts);
    } catch (err) {
      console.error("Failed to load drafts:", err);
      setError("Unable to load draft surveys. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  return (
    <div style={{ padding: "28px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-white, #ffffff)", margin: 0, letterSpacing: "-0.4px" }}>
          Draft Surveys
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", margin: "4px 0 0 0" }}>
          Surveys currently being drafted. Review or finalize for dispatch.
        </p>
      </div>

      {/* Main Drafts Table */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border-strong, rgba(96, 165, 250, 0.2))",
          borderRadius: "var(--radius-lg, 12px)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: "60px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <Spinner size="lg" />
            <span style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)" }}>Loading drafts...</span>
          </div>
        ) : error ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#fca5a5" }}>
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchDrafts} style={{ marginTop: "12px" }}>
              Retry
            </Button>
          </div>
        ) : drafts.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
            <div style={{ fontSize: "36px", opacity: 0.5 }}>📝</div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-white, #ffffff)", margin: 0 }}>
              No Draft Surveys
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)", maxWidth: "400px", margin: 0 }}>
              There are no pending draft surveys. When you begin creating a survey, you can save your progress here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(10, 22, 40, 0.8)",
                    borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))",
                    color: "var(--text-dim, #64748b)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Client & Project</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Phase</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Client Contact</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700 }}>Created Date</th>
                  <th style={{ padding: "14px 18px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    style={{
                      borderBottom: "1px solid rgba(96, 165, 250, 0.08)",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(14, 30, 50, 0.45)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-white, #ffffff)" }}>
                        {draft.client?.name || "Client"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", marginTop: "2px" }}>
                        {draft.project?.name || "Project"}
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <Badge variant="count">{draft.phase}</Badge>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      {draft.client_contact_name ? (
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-white, #fff)", fontSize: "12px" }}>
                            {draft.client_contact_name}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-dim, #64748b)" }}>
                            {draft.client_contact_email}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--text-dim, #64748b)", fontStyle: "italic" }}>
                          Not specified
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "14px 18px", color: "var(--text-muted, #94a3b8)", fontSize: "12px" }}>
                      {new Date(draft.created_at).toLocaleDateString()}
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <Link to="/surveys/new">
                        <Button variant="secondary" size="sm">
                          Resume
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
