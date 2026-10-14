# CSAT

A web application for customer satisfaction evaluation across client projects.

> **App Name:** The application name is strictly **"CSAT"** everywhere (logo, title, browser tab, emails). No subtitle, no tagline, no other words.

---

## Architecture Overview

```
csat-tool/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py               # get_db & get_current_user dependencies
│   │   │   └── routes/               # /api/auth, /api/clients, /api/data_sync routes
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic Settings (.env, DATABASE_URL, JWT_SECRET, etc.)
│   │   │   └── security.py           # bcrypt password hashing & PyJWT token handling
│   │   ├── db/
│   │   │   ├── base.py               # Declarative Base
│   │   │   └── session.py            # SQLAlchemy engine & SessionLocal
│   │   ├── models/                   # User, Client, Project, ImportBatch, ImportChange
│   │   ├── schemas/                  # Pydantic v2 validation DTOs (auth, client, data_sync)
│   │   └── services/                 # auth_service, client_service, sync_service
│   ├── scripts/
│   │   └── seed.py                   # Idempotent seed script (admin@csat.local, reviewer@csat.local)
│   ├── seed/
│   │   └── clients_projects.csv      # Sample dataset (5 clients, 12 projects)
│   ├── tests/                        # Full Pytest test suite (17 comprehensive test cases)
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                      # axiosClient, authApi, clientsApi, dataSyncApi
│   │   ├── components/               # Button, Input, Select, Modal, Drawer, Badge, Toast, Stepper, Spinner, EmptyState, ErrorState, Logo
│   │   ├── context/                  # AuthContext (session restoration via /auth/me)
│   │   ├── layouts/                  # AppLayout, Sidebar (CSAT brand only), Topbar
│   │   ├── pages/                    # LoginPage, DashboardPage, ComingSoonPage, PublicSurveyPage, NotFoundPage
│   │   └── routes/                   # ProtectedRoute and route table
│   ├── .env.example
│   └── package.json
└── docs/
    └── FRONTEND_PLAN.md              # Complete frontend planning document for all workflows
```

---

## Getting Started

### 1. Backend Setup

From the root directory:

```bash
# Navigate to backend
cd backend

# Create .env from template
cp .env.example .env

# Activate virtual environment
..\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run the idempotent database seed script
python scripts/seed.py
```

### 2. Run Backend Tests

```bash
pytest -v
```
All 17 test cases will pass (covering auth, token verification, dry-run previews, rollbacks, and data safety).

### 3. Start Backend Server

```bash
python run.py
# or: uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend API will be running at:
- Health check: `http://localhost:8000/api/health`
- Interactive Swagger docs: `http://localhost:8000/docs`

---

### 4. Frontend Setup

In a new terminal window:

```bash
cd frontend

# Create .env from template
cp .env.example .env

# Install dependencies (if not already installed)
npm install

# Start Vite development server
npm run dev
```

Frontend application will be accessible at: `http://localhost:5173`.

---

## Verification & Walkthrough

1. **Sign-In Page (`/login`)**:
   - Open `http://localhost:5173`. You will automatically be directed to `/login`.
   - Brand displays strictly as **"CSAT"** with stylized wordmark. Browser tab is titled **"CSAT"**.
   - Primary button **"Sign in with Microsoft"** is visible and disabled with the note: *"🔒 SSO pending organization approval"* (since `VITE_SSO_ENABLED=false`).
   - Try submitting with empty fields or invalid email to observe inline validation messages.
   - Enter invalid credentials (e.g., `user@test.com` / `password123`) to observe the generic 401 banner: *"Invalid email or password"*.
   - Log in using either seeded account:
     - **Admin**: `admin@csat.local` / `AdminPassword123!`
     - **Reviewer**: `reviewer@csat.local` / `ReviewerPassword123!`
   - You are redirected to `/dashboard`.

2. **Session Persistence**:
   - Refresh the browser on `/dashboard`: session is automatically restored via `GET /api/auth/me`.
   - Logging out redirects back to `/login`.

3. **App Shell & Route Skeleton**:
   - Sidebar features **"CSAT"** brand header and 4 items: **Dashboard**, **Create Survey**, **Surveys**, **Approvals**.
   - Navigate to **Create Survey** (`/surveys/new`), **Surveys** (`/surveys`), or **Approvals** (`/approvals`): each renders a clean placeholder screen inside the app shell.
   - Project analytics placeholder route is accessible at `/projects/:projectId` (e.g., `/projects/1`).
   - Public client survey route is accessible at `/s/:token` (e.g., `/s/test-token-123`) without requiring login.
   - Visiting any unknown route renders the 404 Not Found page.

4. **Component Library**:
   - `Button`, `Input` (with password visibility toggle), `Select`, `Modal`, `Drawer`, `Badge`, `Toast`, `Stepper`, `Spinner`, `EmptyState`, `ErrorState`, and `Logo` are implemented and ready for subsequent workflow phases.
