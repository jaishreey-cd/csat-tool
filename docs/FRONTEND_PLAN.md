# CSAT — Frontend Architecture & Implementation Plan

> **Application Name:** CSAT  
> **Brand Rule:** The application name is strictly and exactly **"CSAT"** everywhere (logo, title, browser tab, emails). No subtitle, no tagline, no other words.

---

## 1. System Overview & Workflow

CSAT is an internal customer satisfaction platform designed to collect, evaluate, and benchmark client satisfaction scores across client project engagements.

```
+-------------------------------------------------------------------------------------------------+
|                                       CSAT SYSTEM LIFECYCLE                                     |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   +---------------+       +------------------+       +---------------+       +--------------+   |
|   | 1. Auth       |  -->  | 2. Create Survey |  -->  | 3. Approval   |  -->  | 4. Dispatch  |   |
|   | Temp / SSO    |       | Stepper (6 Secs) |       | Maker-Checker |       | Unique URL   |   |
|   +---------------+       +------------------+       +---------------+       +--------------+   |
|                                                                                      |          |
|                                                                                      v          |
|   +---------------+       +------------------+       +---------------+       +--------------+   |
|   | 8. Export     |  <--  | 7. Analytics     |  <--  | 6. Response   |  <--  | 5. Follow-up |   |
|   | CSV / Reports |       | Team & Project   |       | Stars & Text  |       | 15-Day Auto  |   |
|   +---------------+       +------------------+       +---------------+       +--------------+   |
|                                                                                                 |
+-------------------------------------------------------------------------------------------------+
```

---

## 2. Route Map & Route Access Table

| Route | Access | Shell / Layout | Description |
| :--- | :--- | :--- | :--- |
| `/login` | Public | Centered Card (`LoginPage`) | Dual sign-in: Microsoft SSO (disabled until approved) + Email & Password |
| `/dashboard` | Protected | `AppLayout` | Main analytics dashboard (all projects, averages, trends, response rates, Update Data action) |
| `/projects/:projectId` | Protected | `AppLayout` | Project analytics dashboard (team-wise ratings, historical trends, client comments) |
| `/surveys/new` | Protected | `AppLayout` | Multi-step survey creation wizard (Client $\to$ Project $\to$ Phase $\to$ Questions) |
| `/surveys` | Protected | `AppLayout` | Surveys listing with statuses, filters, quick actions (dispatch, preview, export) |
| `/approvals` | Protected | `AppLayout` | Maker-checker approval queue (Pending reviews, approve, reject with comment) |
| `/s/:token` | Public | Public Survey Shell | Client response portal (no authentication, 1-5 star ratings + free text comments) |
| `*` | Public / Both | Clean Error Card | 404 Not Found fallback with navigation back to `/dashboard` |

---

## 3. Detailed Screen Specifications

### Screen 1: Login (`/login`)
- **Purpose:** Secure entry point for all internal team members.
- **Components:**
  - `Logo` ("CSAT" wordmark only)
  - `Button` (Microsoft SSO styled button: white background, blue border, 4-color square Microsoft logo)
  - `Input` (Email input with validation, Password input with eye show/hide toggle)
  - Error Banners (401 Invalid Credentials banner, separate Network/Server Error banner)
- **States:**
  - `isSsoEnabled`: Controlled via `import.meta.env.VITE_SSO_ENABLED === "true"`. When false, SSO button is disabled with caption *"🔒 SSO pending organization approval"*.
  - `email`, `password`: Form inputs with validation on blur and submit.
  - `fieldErrors`: `{ email: "", password: "" }` (email format regex, password $\ge$ 8 chars).
  - `loading`: Boolean indicating submission in progress.
  - `authError` (401), `networkError` (network/server failure).
- **Validation Rules:**
  - Email: Required, valid RFC-compliant format.
  - Password: Required, minimum 8 characters.
  - No default credentials displayed or hardcoded in UI.
- **Expected API Calls:**
  - `POST /api/auth/login` $\to$ `{ access_token, token_type, user }`
  - `GET /api/auth/me` $\to$ Session restore on page load.

---

### Screen 2: Main Dashboard & Analytics (`/dashboard`)
- **Purpose:** Central command center displaying aggregated analytics across all projects, client & project directory, and the safe "Update Data" action.
- **Components:**
  - KPI Stat Cards: Overall CSAT Average (1.0–5.0 scale), Active Projects Count, Response Rate (%), Surveys Pending/Overdue.
  - Comparison & Trend Charts: Overall rating distribution, time-series monthly trend line.
  - `ClientProjectList`: Accordion view of clients and nested projects with team assignments and active survey count.
  - `UpdateDataModal`: Non-destructive client/project synchronization modal.
  - `ImportHistory`: Drawer displaying historical batch audit logs and rollback triggers.
- **States:**
  - `analyticsSummary`: `{ overall_rating, total_responses, response_rate, pending_count }`.
  - `clients`: Hierarchical list of active clients and projects.
  - `searchQuery` & `debouncedSearch`: Filter across client and project names/codes.
  - `isUpdateModalOpen`, `isHistoryDrawerOpen`: Modal visibility controls.
- **Expected API Calls:**
  - `GET /api/analytics/overview` $\to$ Aggregated metrics and trends.
  - `GET /api/clients?search=&include_archived=` $\to$ Client project tree.
  - `POST /api/data-sync/preview` $\to$ File diff before applying.
  - `POST /api/data-sync/confirm` $\to$ Atomic batch commit.
  - `POST /api/data-sync/rollback/{batch_id}` $\to$ Non-destructive rollback.

---

### Screen 3: Project Analytics (`/projects/:projectId`)
- **Purpose:** Deep-dive analytics for an individual client project.
- **Components:**
  - Project Header: Project Code, Project Name, Client Name, Team Name, Active Phase.
  - Team-Wise Rating Breakdown: Visual cards for each functional team (Development, QA, DevOps, PMO).
  - Section-by-Section Star Averages: Star ratings (1 to 5) for Sections 1–5.
  - Qualitative Feedback Feed: Verbatim free-text responses from Section 6 (descriptive section), displayed chronologically without averaging.
  - Export Button: Downloads project-specific PDF/Excel report.
- **States:**
  - `projectDetails`: Project metadata.
  - `ratingsByTeam`: Dictionary of team names to numerical averages.
  - `ratingsBySection`: Section 1 to 5 numerical scores.
  - `qualitativeComments`: Array of `{ client_contact, date, comment_text }`.
- **Expected API Calls:**
  - `GET /api/projects/:projectId/analytics` $\to$ Project analytics breakdown.
  - `GET /api/projects/:projectId/responses` $\to$ Raw response history.

---

### Screen 4: Create Survey Stepper (`/surveys/new`)
- **Purpose:** Guided 4-step wizard to configure, populate, and submit a survey for approval.
- **Components:**
  - `Stepper`: Steps `[1. Client & Project, 2. Phase, 3. Question Bank, 4. Review & Submit]`.
  - Dependent Dropdowns: Client Select $\to$ Project Select (filtered to chosen client's active projects).
  - Phase Selector: Segmented radio group (`Kickoff`, `Mid-Execution`, `Pre-UAT`, `Final Delivery`).
  - Question Bank Builder:
    - 6 Tabbed or Accordion sections.
    - Checkbox selection from 25 hardcoded questions per section.
    - Counter per section: e.g. `"3/5 questions selected"`.
    - "Add Custom Question" input per section.
  - Review Summary: Displays full survey configuration before submitting.
- **Validation Rules:**
  - Step 1: Client and Project selection required.
  - Step 2: Phase selection required.
  - Step 3 (CRITICAL):
    - Each section MUST have $\ge 1$ and $\le 5$ selected questions.
    - Maximum total questions across all 6 sections is 30.
    - **No section can be skipped.** User cannot advance while any section has 0 selected questions.
    - Sections 1–5 are locked to 1–5 star rating response type.
    - Section 6 is locked to descriptive free-text response type.
- **States:**
  - `currentStep`: `0 | 1 | 2 | 3`.
  - `formData`: `{ clientId, projectId, phase, sections: { [sectionId]: [questionIds] } }`.
  - `customQuestions`: `{ [sectionId]: [customQuestionObjects] }`.
- **Expected API Calls:**
  - `GET /api/clients` $\to$ Available clients and active projects.
  - `GET /api/question-bank` $\to$ Hardcoded question bank (6 sections $\times$ 25 questions).
  - `POST /api/surveys` $\to$ Creates survey in `Draft` state.
  - `POST /api/surveys/:id/submit-approval` $\to$ Moves survey to `Pending Approval`.

---

### Screen 5: Surveys List (`/surveys`)
- **Purpose:** Management table of all created surveys with status badges and dispatch triggers.
- **Components:**
  - Search & Filter bar (Filter by Client, Project, Phase, Status).
  - Surveys Table: ID, Project, Client, Phase, Status Badge, Creator, Approver, Created Date, Actions.
  - Send Survey Modal: Appears when clicking "Send to Client" on an `Approved` survey.
    - Fields: Client Contact Name, Client Email Address.
    - Unique Link preview (e.g., `https://csat.domain/s/{unique_token}`).
    - "Send Survey Email" button.
- **States:**
  - `surveys`: List of survey summary objects.
  - `filters`: `{ status, clientId, search }`.
  - `sendModal`: `{ isOpen, surveyId, clientName, clientEmail, uniqueToken }`.
- **Expected API Calls:**
  - `GET /api/surveys` $\to$ Filtered list of surveys.
  - `POST /api/surveys/:id/send` $\to$ Generates unique token, stores contact info, sends initial email.

---

### Screen 6: Approvals Queue (`/approvals`)
- **Purpose:** Maker-Checker review interface for peer PMO members to approve or reject surveys.
- **Maker-Checker Rule:**
  - The reviewer/approver MUST be a different user from the survey creator (`current_user.id !== survey.creator_id`).
  - Creators cannot approve their own surveys; action buttons are disabled with tooltip *"You cannot approve a survey you created"*.
- **Components:**
  - Pending Approvals Table: Project, Client, Creator Name, Created Date, Question Count (X/30), Review Action.
  - Survey Preview Drawer: Side drawer displaying all 6 sections and chosen questions.
  - Approval Modal: Confirmation dialog.
  - Rejection Modal: Requires a mandatory rejection comment (sent back to creator; status returns to `Draft`).
- **States:**
  - `pendingSurveys`: Array of surveys with `status === 'Pending Approval'`.
  - `selectedSurvey`: Currently previewed survey object.
  - `rejectionComment`: String, required when rejecting.
- **Expected API Calls:**
  - `GET /api/approvals/pending` $\to$ List of pending surveys.
  - `POST /api/surveys/:id/approve` $\to$ Transitions status to `Approved`.
  - `POST /api/surveys/:id/reject` $\to$ Payload: `{ comment }`, transitions to `Draft`.

---

### Screen 7: Client Survey Response Portal (`/s/:token`)
- **Purpose:** Public-facing, unauthenticated response form completed by client stakeholders.
- **Components:**
  - Public Header: "CSAT" wordmark only.
  - Welcome Banner: Project Name and Phase context.
  - Section Cards (1 to 5): Interactive 5-Star rating widgets with hover highlights and numeric captions (1: Poor, 2: Fair, 3: Good, 4: Very Good, 5: Excellent).
  - Section 6 Card: Descriptive textarea questions for qualitative feedback.
  - Submit Button: Validates all questions are answered before submitting.
  - "Already Submitted" Screen: Displayed if `token` is already marked as submitted in database.
- **Validation Rules:**
  - Every single question presented in all 6 sections is required.
  - Star ratings must be between 1 and 5.
  - Free-text fields must contain at least 5 non-whitespace characters.
  - Submissions are idempotent and locked once submitted.
- **Expected API Calls:**
  - `GET /api/public/surveys/:token` $\to$ Survey configuration and project metadata (409 if already completed).
  - `POST /api/public/surveys/:token/submit` $\to$ Payload: `{ answers: [{ question_id, star_rating, comment_text }] }`.

---

## 4. Question Bank Data Shape

The question bank consists of **6 fixed sections**, each containing **25 standardized questions** (150 total):

```json
{
  "sections": [
    {
      "id": "sec_1",
      "number": 1,
      "title": "Project Management & Communication",
      "response_type": "star_rating",
      "min_rating": 1,
      "max_rating": 5,
      "questions": [
        { "id": "q1_01", "text": "Clarity of project milestones and deliverables" },
        { "id": "q1_02", "text": "Adherence to agreed project timelines and schedules" }
      ]
    },
    {
      "id": "sec_2",
      "number": 2,
      "title": "Technical Competence & Solution Quality",
      "response_type": "star_rating",
      "min_rating": 1,
      "max_rating": 5,
      "questions": [...]
    },
    {
      "id": "sec_3",
      "number": 3,
      "title": "Team Responsiveness & Collaboration",
      "response_type": "star_rating",
      "min_rating": 1,
      "max_rating": 5,
      "questions": [...]
    },
    {
      "id": "sec_4",
      "number": 4,
      "title": "Delivery & Execution Quality",
      "response_type": "star_rating",
      "min_rating": 1,
      "max_rating": 5,
      "questions": [...]
    },
    {
      "id": "sec_5",
      "number": 5,
      "title": "Value & Business Impact",
      "response_type": "star_rating",
      "min_rating": 1,
      "max_rating": 5,
      "questions": [...]
    },
    {
      "id": "sec_6",
      "number": 6,
      "title": "Qualitative Feedback & General Comments",
      "response_type": "free_text",
      "questions": [
        { "id": "q6_01", "text": "What aspects of the engagement exceeded your expectations?" },
        { "id": "q6_02", "text": "What are the most critical areas where the team can improve?" }
      ]
    }
  ]
}
```

---

## 5. Survey Status Lifecycle

```
  +---------+   Submit for Review    +--------------------+
  |  Draft  | ---------------------> |  Pending Approval  |
  +---------+                        +--------------------+
       ^                                  |            |
       | Reject with Comment              | Approve    |
       +----------------------------------+            v
                                                  +----------+
                                                  | Approved |
                                                  +----------+
                                                       |
                                                       | Dispatch Email (creates unique token)
                                                       v
                                                  +----------+
                                                  |   Sent   |
                                                  +----------+
                                                       |
                             +-------------------------+-------------------------+
                             | (After 15 days without response)                  | Client submits
                             v                                                   v
                    +-----------------+                                   +---------------+
                    | Follow-up Sent  |                                   |   Completed   |
                    +-----------------+                                   +---------------+
                             |                                                   ^
                             | Client submits                                    |
                             +---------------------------------------------------+
```

---

## 6. Shared Component Library

| Component | Props | Description |
| :--- | :--- | :--- |
| `Logo` | `size: 'sm' \| 'md' \| 'lg'` | Wordmark displaying strictly **"CSAT"** with stylized accent dot |
| `Button` | `variant, size, loading, disabled, icon` | Primary blue, secondary outline, ghost, and danger buttons |
| `Input` | `label, type, value, onChange, onBlur, error, helperText` | Accessible text input with built-in show/hide password toggle |
| `Select` | `label, options, value, onChange, onBlur, error` | Clean dropdown wrapper with theme tokens |
| `Modal` | `isOpen, onClose, title, size, children` | Centered dialog with backdrop, escape key handler, focus trap |
| `Drawer` | `isOpen, onClose, title, position, width` | Slide-out overlay drawer for details and preview |
| `Stepper` | `steps, currentStep, onStepClick` | Progress stepper for multi-step survey builder |
| `Badge` | `variant, size, children` | Colored status indicator pills (`Draft`, `Approved`, `Pending`, etc.) |
| `Toast` | `message, type, duration, onClose` | Transient alert notifications (success, error, info) |
| `Spinner` | `size: 'sm' \| 'md' \| 'lg'` | Smooth spinning indicator for asynchronous actions |
| `EmptyState` | `title, description, action` | Placeholder for empty tables, search results, and queues |
| `ErrorState` | `title, message, onRetry` | User-friendly error recovery card |

---

## 7. Next Task Implementation Sequence

1. **Phase 2 — Survey Builder & Question Bank:**
   - Implement Question Bank static dictionary (6 sections $\times$ 25 questions).
   - Implement Stepper form in `/surveys/new` with section counters and validation.
2. **Phase 3 — Maker-Checker Approval Workflow:**
   - Implement `/approvals` queue with maker-checker guard (`creator_id !== reviewer_id`).
   - Implement rejection comments and status progression.
3. **Phase 4 — Dispatch & Client Response Portal:**
   - Implement Send Survey modal with unique `/s/:token` URL generation.
   - Implement public client response screen with star ratings and comments.
   - Implement 15-day automated follow-up scheduler.
4. **Phase 5 — Analytics & Export:**
   - Implement Team-wise ratings radar/bar charts and aggregated analytics on `/dashboard`.
   - Implement CSV/Excel report generation.
